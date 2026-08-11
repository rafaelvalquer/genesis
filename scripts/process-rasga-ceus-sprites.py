from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/rasgaCeusCinereo"
SHEETS = {
    "flying": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-a3bce58f-3e41-4a83-95bb-8cd68df2fa71.png"),
    "diveAttack": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-d871f64b-756b-41d3-b9c5-fd3a7ae35c01.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-c8941f61-76fc-4275-8f8a-1a7cd3a1c63f.png"),
}

def cut(path, state):
    source = Image.open(path).convert("RGBA")
    cols, rows = 4, 2
    cw, ch = source.width // cols, source.height // rows
    target = OUT / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        x, y = index % cols * cw, index // cols * ch
        frame = source.crop((x, y, x + cw, y + ch))
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

for state, sheet in SHEETS.items():
    if sheet.exists():
        cut(sheet, state)
