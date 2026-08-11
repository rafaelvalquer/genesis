from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/vermeIncubador"
SHEETS = {
    "idle": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-fca02344-924c-4390-be62-4058f1df9a43.png"),
    "attack": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-49722ad0-a9c6-4583-86b5-02df30ad90ae.png"),
    "burrowing": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-45464fd2-c336-4436-86ed-3a7ec3eb2ca7.png"),
    "emerging": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-104f8d8f-9dca-44be-b750-39c8eac181b7.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-6bd00782-2234-44cd-a9a1-1990724fa8c6.png"),
}

def cut(sheet_path, state):
    image = Image.open(sheet_path).convert("RGBA")
    cell_w, cell_h = image.width // 4, image.height // 2
    target = OUT / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        x, y = (index % 4) * cell_w, (index // 4) * cell_h
        frame = image.crop((x, y, x + cell_w, y + cell_h))
        pixels = frame.load()
        for yy in range(frame.height):
            for xx in range(frame.width):
                r, g, b, a = pixels[xx, yy]
                if g > 120 and g > r * 1.18 and g > b * 1.12:
                    green = max(0, g - max(r, b))
                    pixels[xx, yy] = (r, min(g, max(r, b) + 12), b, max(0, a - min(255, green * 3)))
        bbox = frame.getchannel("A").getbbox()
        if bbox:
            frame = frame.crop(bbox)
        scale = min(236 / max(1, frame.width), 236 / max(1, frame.height))
        frame = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        canvas.alpha_composite(frame, ((256 - frame.width) // 2, (256 - frame.height) // 2))
        canvas.save(target / f"frame{index}.png")

for state, sheet in SHEETS.items():
    if sheet.exists():
        cut(sheet, state)
