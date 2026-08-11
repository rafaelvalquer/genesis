from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/predadorCaldeira"
SHEETS = {
    "idle": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-61ce088b-bab9-4fc5-adf5-341418d72e47.png"),
    "walking": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-2e337572-d157-4f02-86d7-a319ae70b79e.png"),
    "hunting": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-9390c456-6b48-4796-a615-41176339ecc9.png"),
    "attackCombo": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-3be2cf66-2156-46a4-8fc7-34d95d2a2ddd.png"),
    "frenzyTransition": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-f2f10f7d-a456-4254-b69d-14545f55dddb.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-06d11972-94a0-4def-b837-f0531b5b87f6.png"),
}

def cut(sheet_path, state):
    image = Image.open(sheet_path).convert("RGBA")
    cell_w, cell_h = image.width // 4, image.height // 2
    target = OUT / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        x, y = (index % 4) * cell_w, (index // 4) * cell_h
        frame = image.crop((x, y, x + cell_w, y + cell_h))
        if state == "walking" and index >= 4:
            frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if state in ("attackCombo", "death"):
            frame = frame.crop((28, 28, frame.width - 28, frame.height - 28))
        pixels = frame.load()
        for yy in range(frame.height):
            for xx in range(frame.width):
                r, g, b, a = pixels[xx, yy]
                if state in ("idle", "attackCombo", "death") and max(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 24 and (xx < 32 or yy < 32 or xx >= frame.width - 32 or yy >= frame.height - 32):
                    pixels[xx, yy] = (r, g, b, 0)
                    continue
                if g > 120 and g > r * 1.18 and g > b * 1.12:
                    green = max(0, g - max(r, b))
                    pixels[xx, yy] = (r, min(g, max(r, b) + 12), b, max(0, a - min(255, green * 3)))
                if pixels[xx, yy][3] < 40:
                    pixels[xx, yy] = (*pixels[xx, yy][:3], 0)
        bbox = frame.getchannel("A").getbbox()
        if bbox:
            frame = frame.crop(bbox)
        scale = min(236 / max(1, frame.width), 236 / max(1, frame.height))
        frame = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        canvas.alpha_composite(frame, ((256 - frame.width) // 2, max(4, 246 - frame.height)))
        canvas.save(target / f"frame{index}.png")

for state, sheet in SHEETS.items():
    if sheet.exists():
        cut(sheet, state)
