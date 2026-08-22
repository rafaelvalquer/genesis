"""Apply the shared semi-cartoon tactical treatment to every Chapter 7 convoy.

This is intentionally asset-side: it cleans legacy matte strips, preserves
alpha/canvas/pivots, and applies the same restrained posterized palette to all
frames without changing the animation contract or renderer.
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src/game/assets/convoy"
VEHICLES = ("tr7_pioneiro", "tr7r_peregrino", "tr7a_bastilha", "tr7f_ferrum", "tr9_atlas", "tr9p_vertice", "tr9s_sobrevivente", "trx_exodo")
STATES = ("idle", "run", "destroyed_transition", "destroyed_loop")


def clean_matte(image):
    image = image.convert("RGBA"); px = image.load(); width, height = image.size
    # Remove broad opaque near-black strips only at the outer canvas margins.
    dark_columns = []
    for x in range(width):
        dark = sum(1 for y in range(48, height - 48) if px[x, y][3] and max(px[x, y][:3]) < 8)
        if dark > (height - 96) * .68: dark_columns.append(x)
    runs = []
    if dark_columns:
        start = previous = dark_columns[0]
        for x in dark_columns[1:]:
            if x != previous + 1: runs.append((start, previous)); start = x
            previous = x
        runs.append((start, previous))
    for start, end in runs:
        if end - start < 18 or not (end < width * .38 or start > width * .62): continue
        for x in range(start, end + 1):
            for y in range(height): px[x, y] = (*px[x, y][:3], 0)
    dark_rows = []
    for y in range(height):
        dark = sum(1 for x in range(48, width - 48) if px[x, y][3] and max(px[x, y][:3]) < 8)
        if dark > (width - 96) * .68: dark_rows.append(y)
    if dark_rows:
        start = previous = dark_rows[0]; row_runs = []
        for y in dark_rows[1:]:
            if y != previous + 1: row_runs.append((start, previous)); start = y
            previous = y
        row_runs.append((start, previous))
        for start, end in row_runs:
            if end - start < 8 or not (end < height * .38 or start > height * .62): continue
            for y in range(start, end + 1):
                for x in range(width): px[x, y] = (*px[x, y][:3], 0)
    image.putalpha(image.getchannel("A").point(lambda alpha: 0 if alpha < 8 else alpha))
    return image


def tactical_grade(image):
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    # Fewer tonal steps and a restrained contrast lift create a readable,
    # semi-cartoon panel language while retaining each vehicle's palette.
    flat = ImageOps.posterize(rgb, 6)
    flat = ImageEnhance.Color(flat).enhance(1.06)
    flat = ImageEnhance.Contrast(flat).enhance(1.04)
    graded = Image.blend(rgb, flat, .55).convert("RGBA")
    graded.putalpha(alpha)
    return graded


def build():
    for vehicle in VEHICLES:
        for state in STATES:
            for path in sorted((ASSETS / vehicle / state).glob("*.webp")):
                image = tactical_grade(clean_matte(Image.open(path)))
                image.save(path, "WEBP", lossless=True, method=6)


if __name__ == "__main__": build()
