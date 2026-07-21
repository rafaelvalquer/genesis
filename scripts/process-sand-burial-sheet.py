from pathlib import Path
import sys

from PIL import Image, ImageChops


FRAME_SIZE = 256
COLS = 4
ROWS = 2


def split(source: Path, target: Path) -> None:
    sheet = Image.open(source).convert("RGBA")
    if sheet.width < 1024 or sheet.height < 512:
        raise SystemExit(f"sand burial sheet is too small: {sheet.size}")

    target.mkdir(parents=True, exist_ok=True)
    previous = None
    for index in range(COLS * ROWS):
        col = index % COLS
        row = index // COLS
        left = round(col * sheet.width / COLS)
        top = round(row * sheet.height / ROWS)
        right = round((col + 1) * sheet.width / COLS)
        bottom = round((row + 1) * sheet.height / ROWS)
        frame = sheet.crop((left, top, right, bottom)).resize(
            (FRAME_SIZE, FRAME_SIZE),
            Image.Resampling.LANCZOS,
        )
        alpha = frame.getchannel("A")
        if alpha.getpixel((0, 0)) != 0 or alpha.getpixel((FRAME_SIZE - 1, FRAME_SIZE - 1)) != 0:
            raise SystemExit(f"frame {index} does not have transparent corners")
        if alpha.getbbox() is None:
            raise SystemExit(f"frame {index} is empty")
        if previous is not None and ImageChops.difference(previous, frame).getbbox() is None:
            raise SystemExit(f"frame {index} duplicates the previous frame")
        frame.save(target / f"frame{index}.png", optimize=True, compress_level=9)
        previous = frame


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: process-sand-burial-sheet.py SOURCE TARGET")
    split(Path(sys.argv[1]), Path(sys.argv[2]))
