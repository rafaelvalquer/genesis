#!/usr/bin/env python3
"""Normalize the articulated Rastejante da Mata pose bases into runtime PNGs."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASES = ROOT / "scripts" / "rastejante_mata_pose_bases"
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "rastejanteMata"
PREVIEW = ROOT / ".codex-tmp" / "convoy7" / "rastejante_mata_animation_sheet.png"
STATES = ("idle", "walking", "attack")
SIZE = (192, 192)


def normalize(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"Missing alpha silhouette: {source}")
    image = image.crop(bbox)
    # A fixed fit frame preserves each authored pose and leaves a safe 10px margin.
    scale = min(172 / image.width, 155 / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    frame.alpha_composite(image, ((SIZE[0] - image.width) // 2, 170 - image.height))
    return frame


def contact_sheet(rows):
    sheet = Image.new("RGBA", (192 * 8, 192 * 3), (21, 28, 22, 255))
    for row, frames in enumerate(rows):
        for index, image in enumerate(frames):
            sheet.alpha_composite(image, (index * 192, row * 192))
    return sheet


def main() -> None:
    rows = []
    for state in STATES:
        folder = OUT / state
        folder.mkdir(parents=True, exist_ok=True)
        frames = []
        for index in range(8):
            image = normalize(BASES / f"{state}_frame{index}.png")
            image.save(folder / f"frame{index}.png", "PNG", optimize=True)
            frames.append(image)
        rows.append(frames)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    contact_sheet(rows).save(PREVIEW, "PNG", optimize=True)
    print("Exported 24 articulated Rastejante da Mata RGBA frames")


if __name__ == "__main__":
    main()
