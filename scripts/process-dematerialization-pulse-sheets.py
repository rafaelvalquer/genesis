import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "pulsoDesmaterializacao"
TARGET = ROOT / "src" / "game" / "assets" / "defense" / "pulsoDesmaterializacao"
FRAME_SIZE = 256
GRID_COLUMNS = 4
GRID_ROWS = 2
STATES = ("idle", "attack", "dead")


def crop_subject(cell: Image.Image) -> Image.Image:
    alpha = cell.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 12 else 0).getbbox()
    if not bbox:
        raise SystemExit("empty pulse sprite cell")
    return cell.crop(bbox)


def normalize_cell(cell: Image.Image) -> Image.Image:
    subject = crop_subject(cell)
    max_width = FRAME_SIZE - 12
    max_height = FRAME_SIZE - 12
    scale = min(max_width / subject.width, max_height / subject.height)
    resized = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - resized.width) // 2
    y = FRAME_SIZE - resized.height - 4
    frame.alpha_composite(resized, (x, y))
    return frame


def split_sheet(source: Path, state: str) -> None:
    sheet = Image.open(source).convert("RGBA")
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)
    for previous in output.glob("frame*.png"):
        previous.unlink()

    for index in range(GRID_COLUMNS * GRID_ROWS):
        column = index % GRID_COLUMNS
        row = index // GRID_COLUMNS
        left = round(column * sheet.width / GRID_COLUMNS)
        right = round((column + 1) * sheet.width / GRID_COLUMNS)
        top = round(row * sheet.height / GRID_ROWS)
        bottom = round((row + 1) * sheet.height / GRID_ROWS)
        frame = normalize_cell(sheet.crop((left, top, right, bottom)))
        optimized = frame.quantize(
            colors=128,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
        optimized.save(output / f"frame{index}.png", optimize=True, compress_level=9)


def validate_frames() -> None:
    for state in STATES:
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for frame_path in frames:
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (FRAME_SIZE, FRAME_SIZE):
                raise SystemExit(f"unexpected dimensions in {frame_path}: {frame.size}")
            alpha = frame.getchannel("A")
            if not alpha.getbbox():
                raise SystemExit(f"empty frame: {frame_path}")
            edge = FRAME_SIZE - 1
            if any(alpha.getpixel(point) > 8 for point in ((0, 0), (edge, 0), (0, edge), (edge, edge))):
                raise SystemExit(f"opaque corner in {frame_path}")
            if frame_path.stat().st_size > 700_000:
                raise SystemExit(f"frame exceeds 700 KB: {frame_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Pulso de Desmaterializacao sprite sheets.")
    parser.add_argument("--state", choices=(*STATES, "all"), default="all")
    args = parser.parse_args()
    selected = STATES if args.state == "all" else (args.state,)
    for state in selected:
        split_sheet(SHEETS / f"pulso-desmaterializacao-{state}.png", state)
    validate_frames()
    print(f"Pulso de Desmaterializacao sprites written to {TARGET}")
