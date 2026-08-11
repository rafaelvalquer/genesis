from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/salamandraCinerea"
SHEETS = {
    "idle": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-c78968bb-7f7a-4b9e-8d80-648f22126cbe.png"),
    "walking": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-33ad1834-5877-456a-b46d-6c9c654a9292.png"),
    "attack": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7f7a-b46d-6c9c654a9292.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-4dfc-8462-324f829f97a8.png"),
}

# The attack output is corrected below after generation if its path differs.
SHEETS["attack"] = Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-33ad1834-5877-456a-b46d-6c9c654a9292.png")

SHEETS["attack"] = Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-fed6f8a1-87cb-4ea1-a690-5442f41480ce.png")
SHEETS["death"] = Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-a0ad7016-bf0c-4dfc-8462-324f829f97a8.png")

def cut(sheet_path, state, columns, rows):
    image = Image.open(sheet_path).convert("RGBA")
    cell_w, cell_h = image.width // columns, image.height // rows
    count = columns * rows
    target = OUT / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(count):
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        frame = image.crop((x, y, x + cell_w, y + cell_h))
        px = frame.load()
        for yy in range(frame.height):
            for xx in range(frame.width):
                r, g, b, a = px[xx, yy]
                green = max(0, g - max(r, b))
                if g > 120 and g > r * 1.18 and g > b * 1.12:
                    px[xx, yy] = (r, min(g, max(r, b) + 12), b, max(0, a - min(255, green * 3)))
        bbox = frame.getchannel("A").getbbox()
        if bbox:
            frame = frame.crop(bbox)
        scale = min(236 / max(1, frame.width), 236 / max(1, frame.height))
        frame = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        canvas.alpha_composite(frame, ((256 - frame.width) // 2, (256 - frame.height) // 2))
        canvas.save(target / f"frame{index}.png")

for state, path in SHEETS.items():
    if path.exists():
        cut(path, state, 3 if state == "attack" else 4, 2)
