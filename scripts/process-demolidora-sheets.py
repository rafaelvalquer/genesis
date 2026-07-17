from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "demolidora"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "demolidora"
FRAME_SIZE = 256
CANVAS_SIZE = 400
ROOT_X = 155
ROOT_Y = 372
MAX_WIDTH = 340
MAX_HEIGHT = 350


def support_point(frame: Image.Image) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 96 else 0).getbbox()
    if not bbox:
        raise SystemExit("empty sprite cell")
    bottom = bbox[3] - 1
    points = []
    for y in range(max(bbox[1], bottom - 12), bottom + 1):
        for x in range(bbox[0], bbox[2]):
            if alpha.getpixel((x, y)) >= 96:
                points.append(x)
    return ((min(points) + max(points)) / 2 if points else (bbox[0] + bbox[2]) / 2, bottom)


def normalize_character(cell: Image.Image) -> Image.Image:
    bbox = cell.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("empty sprite cell")
    subject = cell.crop(bbox)
    scale = min(MAX_WIDTH / subject.width, MAX_HEIGHT / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    root_x, root_y = support_point(subject)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(subject, (round(ROOT_X - root_x), ROOT_Y - root_y))
    return canvas.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)


def split_sheet(filename: str, state: str) -> None:
    sheet = Image.open(SHEETS / filename).convert("RGBA")
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)
    for old in output.glob("frame*.png"):
        old.unlink()
    for index in range(8):
        column = index % 4
        row = index // 4
        cell = sheet.crop((
            round(column * sheet.width / 4),
            round(row * sheet.height / 2),
            round((column + 1) * sheet.width / 4),
            round((row + 1) * sheet.height / 2),
        ))
        normalize_character(cell).save(output / f"frame{index}.png", optimize=True, compress_level=9)


def process_mine() -> None:
    source = Image.open(SHEETS / "demolidora-mine.png").convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("empty mine asset")
    mine = source.crop(bbox)
    scale = min(232 / mine.width, 150 / mine.height)
    mine = mine.resize((round(mine.width * scale), round(mine.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(mine, ((FRAME_SIZE - mine.width) // 2, (FRAME_SIZE - mine.height) // 2))
    output = TARGET / "mine"
    output.mkdir(parents=True, exist_ok=True)
    frame.save(output / "frame0.png", optimize=True, compress_level=9)


def validate() -> None:
    for state, expected in (("idle", 8), ("attackMine", 8), ("attackGun", 8), ("mine", 1)):
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != expected:
            raise SystemExit(f"expected {expected} {state} frames, found {len(frames)}")
        for path in frames:
            frame = Image.open(path).convert("RGBA")
            if frame.size != (FRAME_SIZE, FRAME_SIZE) or not frame.getchannel("A").getbbox():
                raise SystemExit(f"invalid frame: {path}")
            if any(frame.getchannel("A").getpixel(point) != 0 for point in ((0, 0), (255, 0), (0, 255), (255, 255))):
                raise SystemExit(f"opaque corner: {path}")


if __name__ == "__main__":
    split_sheet("demolidora-idle.png", "idle")
    split_sheet("demolidora-attack-mine.png", "attackMine")
    split_sheet("demolidora-attack-gun.png", "attackGun")
    process_mine()
    validate()
    print(f"Demolidora sprites written to {TARGET}")
