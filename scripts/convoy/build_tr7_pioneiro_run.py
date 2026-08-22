"""Build the TR-7 Pioneiro RUN animation from one stable transparent master.

Only the three visible wheel regions are transformed. The chassis, cabin and
cargo remain pixel-identical across frames; the engine still owns translation
and procedural dust.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "src/game/assets/convoy/tr7_pioneiro"
MASTER = ASSET_ROOT / "idle/ tr7_pioneiro_idle_00.webp".replace("/ ", "/")
OUT = ASSET_ROOT / "run"
ANGLES = (0, 45, 90, 135, 180, 225, 270, 315)
# Centers/radii are in the 1024x512 source canvas.
WHEELS = ((205, 345, 66, 62), (378, 345, 66, 62), (676, 345, 66, 62))


def wheel_mask(size, center, rx, ry):
    mask = Image.new("L", size, 0)
    local = Image.new("L", (rx * 2 + 8, ry * 2 + 8), 0)
    draw = ImageDraw.Draw(local)
    draw.ellipse((4, 4, rx * 2 + 3, ry * 2 + 3), fill=255)
    local = local.filter(ImageFilter.GaussianBlur(1.2))
    mask.paste(local, (center[0] - rx - 4, center[1] - ry - 4))
    return mask


def build():
    master = Image.open(MASTER).convert("RGBA")
    if master.size != (1024, 512):
        raise ValueError(f"unexpected master size: {master.size}")
    # Remove the legacy opaque black matte by flood-filling only dark pixels
    # connected to the canvas edge; enclosed dark metal on the truck remains.
    pixels = master.load()
    pending = [(x, y) for x in range(master.width) for y in (0, master.height - 1)]
    pending += [(x, y) for y in range(master.height) for x in (0, master.width - 1)]
    seen = set()
    while pending:
        x, y = pending.pop()
        if (x, y) in seen or not (0 <= x < master.width and 0 <= y < master.height):
            continue
        seen.add((x, y)); r, g, b, a = pixels[x, y]
        if a == 0 or max(r, g, b) > 42:
            continue
        pixels[x, y] = (r, g, b, 0)
        pending.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    # The legacy matte also contains two detached black vertical strips. Remove
    # only connected near-black components that are tall and narrow, never the
    # enclosed dark metal components of the truck.
    dark = {(x, y) for x in range(master.width) for y in range(master.height)
            if pixels[x, y][3] and max(pixels[x, y][:3]) < 8}
    while dark:
        seed = dark.pop(); component = [seed]; stack = [seed]
        while stack:
            x, y = stack.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in dark:
                    dark.remove(neighbor); stack.append(neighbor); component.append(neighbor)
        xs = [point[0] for point in component]; ys = [point[1] for point in component]
        if max(ys) - min(ys) > 260 and max(xs) - min(xs) < 48:
            for x, y in component:
                pixels[x, y] = (*pixels[x, y][:3], 0)
    alpha = master.getchannel("A").point(lambda value: 0 if value < 8 else value)
    master.putalpha(alpha)
    for frame, angle in enumerate(ANGLES):
        result = master.copy()
        for cx, cy, rx, ry in WHEELS:
            patch_box = (cx - rx - 5, cy - ry - 5, cx + rx + 6, cy + ry + 6)
            patch = master.crop(patch_box)
            rotated = patch.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False, center=(patch.width / 2, patch.height / 2))
            mask = wheel_mask(master.size, (cx, cy), rx, ry).crop(patch_box)
            result.paste(rotated, patch_box, mask)
        result.save(OUT / f"tr7_pioneiro_run_{frame:02d}.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    build()
