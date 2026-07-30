from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "reator"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "reator"
FRAME_SIZE = 384
TARGET_VISIBLE_HEIGHT = 326
MAX_VISIBLE_WIDTH = 360
ROOT_POINT = (192, 372)
ALPHA_THRESHOLD = 24


def support_point(frame: Image.Image) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bbox = alpha.point(
        lambda value: 255 if value >= ALPHA_THRESHOLD else 0
    ).getbbox()
    if not bbox:
        raise SystemExit("empty reactor sprite cell")
    bottom = bbox[3] - 1
    support_xs = [
        x
        for y in range(max(bbox[1], bottom - 12), bottom + 1)
        for x in range(bbox[0], bbox[2])
        if alpha.getpixel((x, y)) >= 96
    ]
    return (
        (min(support_xs) + max(support_xs)) / 2
        if support_xs
        else (bbox[0] + bbox[2]) / 2,
        bottom,
    )


def normalize_cell(cell: Image.Image) -> Image.Image:
    bbox = cell.getchannel("A").point(
        lambda value: 255 if value >= ALPHA_THRESHOLD else 0
    ).getbbox()
    if not bbox:
        raise SystemExit("empty reactor sprite cell")
    subject = cell.crop(bbox)
    scale = min(
        TARGET_VISIBLE_HEIGHT / subject.height,
        MAX_VISIBLE_WIDTH / subject.width,
    )
    subject = subject.resize(
        (round(subject.width * scale), round(subject.height * scale)),
        Image.Resampling.LANCZOS,
    )
    root_x, root_y = support_point(subject)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(
        subject,
        (round(ROOT_POINT[0] - root_x), ROOT_POINT[1] - root_y),
    )
    return frame


def split_sheet(source: Path, state: str) -> None:
    sheet = Image.open(source).convert("RGBA")
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)

    for index in range(8):
        column = index % 4
        row = index // 4
        left = round(column * sheet.width / 4)
        right = round((column + 1) * sheet.width / 4)
        top = round(row * sheet.height / 2)
        bottom = round((row + 1) * sheet.height / 2)
        cell = sheet.crop((
            left,
            top,
            right,
            bottom,
        ))
        frame = normalize_cell(cell)
        frame.save(output / f"frame{index}.png", optimize=True)


def validate_frames() -> None:
    for state in ("idle", "attack"):
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for frame_path in frames:
            frame = Image.open(frame_path).convert("RGBA")
            alpha = frame.getchannel("A")
            if alpha.getpixel((0, 0)) != 0 or alpha.getpixel((FRAME_SIZE - 1, FRAME_SIZE - 1)) != 0:
                raise SystemExit(f"opaque corner in {frame_path}")
            coverage = alpha.getbbox()
            if not coverage:
                raise SystemExit(f"empty frame: {frame_path}")


if __name__ == "__main__":
    split_sheet(SHEETS / "reator-idle.png", "idle")
    split_sheet(SHEETS / "reator-descarga.png", "attack")
    validate_frames()
    print(f"Reactor sprites written to {TARGET}")
