from pathlib import Path
import sys

from PIL import Image


def split(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    if image.size != (1536, 1024):
        raise SystemExit(f"unexpected sheet size for {source}: {image.size}")
    cell_width, cell_height = image.width // 4, image.height // 2
    for state, row in (("idle", 0), ("attack", 1)):
        folder = target / state
        folder.mkdir(parents=True, exist_ok=True)
        for column in range(4):
            cell = image.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
            square = Image.new("RGBA", (cell_height, cell_height), (0, 0, 0, 0))
            square.alpha_composite(cell, ((cell_height - cell_width) // 2, 0))
            frame = square.resize((560, 560), Image.Resampling.LANCZOS)
            frame.save(folder / f"frame{column}.png", optimize=True)
    alpha = image.getchannel("A")
    transparent = sum(1 for value in alpha.getdata() if value == 0)
    if transparent < image.width * image.height * 0.5:
        raise SystemExit(f"insufficient transparency in {source}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: split-sprite-sheet.py SOURCE TARGET")
    split(Path(sys.argv[1]), Path(sys.argv[2]))
