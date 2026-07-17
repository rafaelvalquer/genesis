from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "reator"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "reator"
FRAME_SIZE = 256


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
        frame = sheet.crop((
            left,
            top,
            right,
            bottom,
        ))
        frame = frame.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
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
