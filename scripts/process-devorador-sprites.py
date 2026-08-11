from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/devoradorCaldeira"
SHEETS = {
    "idle": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-94b51efb-0ab2-4af6-b17e-99e0d5fc167e.png"),
    "walking": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-a3a9d707-39dc-43d1-8f04-57df8a3bc860.png"),
    "attack": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-26a442fa-0471-4e9d-adda-4e81d7c4bdc1.png"),
    "crushingBite": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-dcb16e2b-7c89-402f-ad9e-5048f63ece70.png"),
    "frenzyTransition": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-3f15692d-63bb-40ab-85fd-384a3db59be4.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-f381dbf8-e20f-495f-bb4a-a13f6aeee616.png"),
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
