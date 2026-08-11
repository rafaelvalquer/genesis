from pathlib import Path
from PIL import Image

ROOT = Path(r"C:\Projetos\Genesis")
OUT = ROOT / "src/game/assets/enemy/cuspidorBrasa"
SHEETS = {
    "idle": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-3e1263e2-c271-4021-88e0-c23e29fee6ee.png"),
    "walking": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-1f33dbcd-a1c9-4290-9ece-a528a062bcd2.png"),
    "attack": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-a1a832c9-d4c8-4f36-a40a-0d9b8206edcf.png"),
    "death": Path(r"C:\Users\Z565244\.codex\generated_images\019fed32-f462-7a31-b10d-89a686456a8c\exec-50e26bb0-eaee-46c5-8974-848491c173da.png"),
}


def remove_green(frame):
    frame = frame.convert("RGBA")
    pixels = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = pixels[x, y]
            green_dominance = g - max(r, b)
            if g > 100 and green_dominance > 18:
                alpha = max(0, min(255, 255 - green_dominance * 7))
                pixels[x, y] = (r, g, b, min(a, alpha))
            elif green_dominance > 4:
                pixels[x, y] = (r, g, b, max(0, min(a, 255 - green_dominance * 10)))
            if pixels[x, y][3] < 32:
                pixels[x, y] = (*pixels[x, y][:3], 0)
    return frame


def cut(sheet_path, state):
    image = Image.open(sheet_path).convert("RGBA")
    cell_w, cell_h = image.width // 4, image.height // 2
    target = OUT / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        x, y = (index % 4) * cell_w, (index // 4) * cell_h
        frame = remove_green(image.crop((x, y, x + cell_w, y + cell_h)))
        bbox = frame.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"No sprite pixels found in {state} frame {index}")
        frame = frame.crop(bbox)
        scale = min(232 / max(1, frame.width), 232 / max(1, frame.height))
        frame = frame.resize(
            (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        canvas.alpha_composite(frame, ((256 - frame.width) // 2, max(4, 244 - frame.height)))
        canvas.save(target / f"frame{index}.png")


for state, sheet in SHEETS.items():
    if sheet.exists():
        cut(sheet, state)
    else:
        raise FileNotFoundError(sheet)
