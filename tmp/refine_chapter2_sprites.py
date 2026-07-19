from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(r"C:\Projetos\Genesis")
SOURCE = ROOT / "tmp" / "sprite-refinement" / "transparent"
DESTINATION = ROOT / "src" / "game" / "assets" / "enemy"
PREVIEWS = ROOT / "tmp" / "sprite-refinement" / "previews"
MONSTERS = ("estilha", "vitrarca", "obsidonte", "refrator")
STATES = ("idle", "walking", "attack")
AIRBORNE = {"refrator"}
GENERATED = Path(
    r"C:\Users\Z565244\.codex\generated_images"
    r"\019f6dc6-0c5d-7bf2-a642-9e2ab44ec027"
)
ORIGINALS = {
    ("estilha", "idle"): "call_PvB4Oy76wYoAUn3agTdlUCra.png",
    ("estilha", "walking"): "call_AbSTaPlGjwSgEVNKHDdpVr91.png",
    ("estilha", "attack"): "call_6my97uAZWCjUdUkgVxzxMGBw.png",
    ("vitrarca", "idle"): "call_5OnKDjk4O2gjdVP8GwWdlKVy.png",
    ("vitrarca", "walking"): "call_30nGXPun3de2kBekGunWf6Ph.png",
    ("vitrarca", "attack"): "call_w4YZrypMjrmHS03F8hX1m0Wx.png",
    ("obsidonte", "idle"): "call_c0i27GEvextfEQuOvqfyLPn7.png",
    ("obsidonte", "walking"): "call_oxdiehV6tAlQjzm6RoPML29Y.png",
    ("obsidonte", "attack"): "call_JaveBiCcFt5Z9oINPu2Y4ixT.png",
    ("refrator", "idle"): "call_qiKX0Mch2LPMchb5sjtY1YIF.png",
    ("refrator", "walking"): "call_K3IRriIeLNhqWKE5QtztwMol.png",
    ("refrator", "attack"): "call_lt6RT5Nviv2SO8WqSCglvLh1.png",
}


def split_sheet(monster: str, state: str) -> list[Image.Image]:
    keyed = Image.open(SOURCE / f"{monster}-{state}.png").convert("RGBA")
    original = Image.open(GENERATED / ORIGINALS[(monster, state)]).convert("RGBA")
    keyed_pixels = np.asarray(keyed).copy()
    original_pixels = np.asarray(original)
    opaque = keyed_pixels[:, :, 3] >= 230
    amber = (
        (original_pixels[:, :, 0] > 130)
        & (original_pixels[:, :, 1] > 28)
        & (original_pixels[:, :, 1] < 190)
        & (original_pixels[:, :, 2] < 95)
    )
    keyed_pixels[amber, 3] = 255
    opaque |= amber
    keyed_pixels[opaque, :3] = original_pixels[opaque, :3]
    sheet = Image.fromarray(keyed_pixels, "RGBA")
    frames = []
    for index in range(8):
        column, row = index % 4, index // 4
        bounds = (
            round(column * sheet.width / 4),
            round(row * sheet.height / 2),
            round((column + 1) * sheet.width / 4),
            round((row + 1) * sheet.height / 2),
        )
        frames.append(
            sheet.crop(bounds).resize((256, 256), Image.Resampling.LANCZOS)
        )
    return frames


def body_anchor(frame: Image.Image, monster: str) -> tuple[float, float]:
    pixels = np.asarray(frame)
    rgb = pixels[:, :, :3].astype(np.float32)
    alpha = pixels[:, :, 3]
    luminance = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    yy, xx = np.indices(alpha.shape)

    # Dark cel-shaded mass tracks the creature itself while ignoring bright
    # slashes, beams, shards and ground-impact effects.
    mask = (alpha > 150) & (luminance < 118)
    mask &= (xx > 28) & (xx < 238) & (yy > 18) & (yy < 238)
    if mask.sum() < 100:
        mask = alpha > 150

    weights = np.clip((130 - luminance) / 80, 0.2, 1.0) * mask
    total = weights.sum()
    center_x = float((xx * weights).sum() / total)

    if monster in AIRBORNE:
        center_y = float((yy * weights).sum() / total)
    else:
        ys = yy[mask]
        center_y = float(np.percentile(ys, 94))
    return center_x, center_y


def shift_frame(frame: Image.Image, dx: int, dy: int) -> Image.Image:
    shifted = Image.new("RGBA", frame.size)
    shifted.alpha_composite(frame, (dx, dy))
    return shifted


def align_frames(frames: list[Image.Image], monster: str) -> list[Image.Image]:
    anchors = [body_anchor(frame, monster) for frame in frames]
    target_x = float(np.median([anchor[0] for anchor in anchors]))
    target_y = float(np.median([anchor[1] for anchor in anchors]))
    aligned = []
    for frame, (anchor_x, anchor_y) in zip(frames, anchors):
        dx = int(round(np.clip(target_x - anchor_x, -28, 28)))
        dy = int(round(np.clip(target_y - anchor_y, -28, 28)))
        aligned.append(shift_frame(frame, dx, dy))
    return aligned


def save_frames(monster: str, state: str, frames: list[Image.Image]) -> None:
    destination = DESTINATION / monster / state
    destination.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        indexed = frame.quantize(colors=96, method=Image.Quantize.FASTOCTREE)
        indexed.save(destination / f"frame{index}.png", optimize=True)


def checkerboard(size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, "#111827")
    draw = ImageDraw.Draw(canvas)
    tile = 16
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill="#1f2937")
    return canvas


def build_preview(monster: str) -> Path:
    preview = checkerboard((8 * 256, 3 * 256))
    for row, state in enumerate(STATES):
        for column in range(8):
            frame = Image.open(
                DESTINATION / monster / state / f"frame{column}.png"
            ).convert("RGBA")
            preview.alpha_composite(frame, (column * 256, row * 256))
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    output = PREVIEWS / f"{monster}.webp"
    preview.convert("RGB").save(output, "WEBP", quality=90, method=6)
    return output


def main() -> None:
    outputs = []
    for monster in MONSTERS:
        for state in STATES:
            frames = align_frames(split_sheet(monster, state), monster)
            save_frames(monster, state, frames)
            outputs.extend(
                DESTINATION / monster / state / f"frame{index}.png"
                for index in range(8)
            )
        build_preview(monster)
    print(
        f"Wrote {len(outputs)} aligned frames "
        f"({sum(path.stat().st_size for path in outputs) / 1024 / 1024:.2f} MiB)"
    )


if __name__ == "__main__":
    main()
