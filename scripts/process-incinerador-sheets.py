import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "incinerador"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "incinerador"
FRAME_SIZE = 256
NORMALIZED_SIZE = 400
ROOT_X = 165
ROOT_Y = 370
SUBJECT_MAX_WIDTH = 380
SUBJECT_MAX_HEIGHT = 340
REFERENCE_CHARACTER_HEIGHT = 222


def remove_magenta_fringe(frame: Image.Image) -> Image.Image:
    cleaned = frame.copy().convert("RGBA")
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            magenta_dominance = min(red, blue) - green
            if alpha and magenta_dominance > 20 and abs(red - blue) < 110:
                pixels[x, y] = (red, green, blue, 0)
    return cleaned


def retain_meaningful_components(frame: Image.Image) -> Image.Image:
    frame = remove_magenta_fringe(frame)
    alpha = frame.getchannel("A")
    visible = {
        (x, y)
        for y in range(frame.height)
        for x in range(frame.width)
        if alpha.getpixel((x, y)) > 8
    }
    components = []
    while visible:
        start = visible.pop()
        component = {start}
        pending = [start]
        while pending:
            x, y = pending.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in visible:
                    visible.remove(neighbor)
                    component.add(neighbor)
                    pending.append(neighbor)
        components.append(component)

    if not components:
        raise SystemExit("empty sprite cell")
    subject = max(components, key=len)
    minimum_effect_size = max(48, len(subject) // 900)
    retained = set().union(*(
        component
        for component in components
        if component is subject or len(component) >= minimum_effect_size
    ))
    cleaned = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    source = frame.load()
    target = cleaned.load()
    for x, y in retained:
        target[x, y] = source[x, y]
    return cleaned


def support_point(frame: Image.Image) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 96 else 0).getbbox()
    if not bbox:
        raise SystemExit("cannot calculate an anchor for an empty frame")

    bottom = bbox[3] - 1
    support_x = []
    for y in range(max(bbox[1], bottom - 12), bottom + 1):
        for x in range(bbox[0], bbox[2]):
            if alpha.getpixel((x, y)) >= 96:
                support_x.append(x)
    if not support_x:
        raise SystemExit("cannot find the character's ground support")
    return (min(support_x) + max(support_x)) / 2, bottom


def normalize_cell(cell: Image.Image) -> Image.Image:
    subject = retain_meaningful_components(cell)
    bbox = subject.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("empty sprite cell after cleanup")
    cropped = subject.crop(bbox)
    scale = min(
        SUBJECT_MAX_WIDTH / cropped.width,
        SUBJECT_MAX_HEIGHT / cropped.height,
    )
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    root_x, root_y = support_point(resized)
    normalized = Image.new("RGBA", (NORMALIZED_SIZE, NORMALIZED_SIZE), (0, 0, 0, 0))
    normalized.alpha_composite(resized, (round(ROOT_X - root_x), ROOT_Y - root_y))
    return normalized


def root_anchor(frame: Image.Image, state: str) -> dict[str, float]:
    root_x, bottom = support_point(frame)
    bbox = frame.getchannel("A").getbbox()
    visible_height = bbox[3] - bbox[1]
    scale = 1 if state == "idle" else round(REFERENCE_CHARACTER_HEIGHT / visible_height, 4)
    return {
        "x": round(root_x / FRAME_SIZE, 4),
        "y": round(bottom / FRAME_SIZE, 4),
        "scale": scale,
    }


def muzzle_point(frame: Image.Image) -> tuple[float, float]:
    pixels = frame.convert("RGBA").load()
    flame_pixels = []
    for y in range(frame.height):
        for x in range(frame.width):
            red, green, blue, alpha = pixels[x, y]
            if x >= frame.width * 0.7 and alpha >= 128 and red >= 235 and green >= 105 and blue <= 125:
                flame_pixels.append((x, y))
    if not flame_pixels:
        raise SystemExit("cannot find the Incinerador muzzle flame")
    flame_start = min(x for x, _ in flame_pixels)
    root_band = [y for x, y in flame_pixels if x <= flame_start + 5]
    muzzle_y = sum(root_band) / len(root_band)
    return round(flame_start / FRAME_SIZE, 4), round(muzzle_y / FRAME_SIZE, 4)


def split_sheet(source: Path, state: str) -> tuple[list[dict[str, float]], list[tuple[float, float]]]:
    sheet = Image.open(source).convert("RGBA")
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)
    for old_frame in output.glob("frame*.png"):
        old_frame.unlink()

    anchors = []
    muzzles = []
    for index in range(8):
        column = index % 4
        row = index // 4
        left = round(column * sheet.width / 4)
        right = round((column + 1) * sheet.width / 4)
        top = round(row * sheet.height / 2)
        bottom = round((row + 1) * sheet.height / 2)
        cell = sheet.crop((left, top, right, bottom))
        frame = normalize_cell(cell).resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
        frame.save(output / f"frame{index}.png", optimize=True, compress_level=9)
        anchors.append(root_anchor(frame, state))
        if state == "attack":
            muzzles.append(muzzle_point(frame))
    return anchors, muzzles


def validate_frames() -> None:
    for state in ("idle", "attack"):
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        unique_frames = set()
        for frame_path in frames:
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (FRAME_SIZE, FRAME_SIZE):
                raise SystemExit(f"unexpected dimensions in {frame_path}: {frame.size}")
            alpha = frame.getchannel("A")
            if any(alpha.getpixel(point) != 0 for point in ((0, 0), (255, 0), (0, 255), (255, 255))):
                raise SystemExit(f"opaque corner in {frame_path}")
            if not alpha.getbbox():
                raise SystemExit(f"empty frame: {frame_path}")
            if frame_path.stat().st_size > 700_000:
                raise SystemExit(f"frame exceeds 700 KB: {frame_path}")
            unique_frames.add(frame.tobytes())
        if len(unique_frames) != 8:
            raise SystemExit(f"expected 8 distinct {state} frames, found {len(unique_frames)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Incinerador sprite sheets.")
    parser.add_argument("--state", choices=("idle", "attack", "both"), default="both")
    args = parser.parse_args()

    anchors = {}
    muzzles = {}
    if args.state in ("idle", "both"):
        anchors["idle"], muzzles["idle"] = split_sheet(SHEETS / "incinerador-idle.png", "idle")
    if args.state in ("attack", "both"):
        anchors["attack"], muzzles["attack"] = split_sheet(SHEETS / "incinerador-attack.png", "attack")
    validate_frames()
    print(f"Incinerador sprites written to {TARGET}")
    for state, state_anchors in anchors.items():
        print(f"{state} anchors: {state_anchors}")
    if muzzles.get("attack"):
        print(f"attack muzzles: {muzzles['attack']}")
