#!/usr/bin/env python3
"""Normalize articulated Saltador Alado pose bases into the runtime PNG contract."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASES = ROOT / "scripts" / "saltador_alado_pose_bases"
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "saltadorAlado"
PREVIEW = ROOT / ".codex-tmp" / "convoy7" / "saltador_alado_animation_sheet.png"
SIZE = (192, 192)
COUNTS = {"idle": 8, "walking": 8, "attack": 8, "jumpPrep": 4, "jumpAir": 6, "jumpLand": 4, "rasante": 8}


def normalize(source: Path, airborne: bool) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"Missing alpha silhouette: {source}")
    image = image.crop(bbox)
    scale = min(172 / image.width, 158 / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    # jumpAir stays centered; the engine owns the horizontal arc and vertical parabola.
    y = (SIZE[1] - image.height) // 2 if airborne else 170 - image.height
    result.alpha_composite(image, ((SIZE[0] - image.width) // 2, y))
    return result


def preview(rows):
    longest = max(len(row) for row in rows)
    sheet = Image.new("RGBA", (192 * longest, 192 * len(rows)), (20, 28, 22, 255))
    for row, frames in enumerate(rows):
        for index, image in enumerate(frames): sheet.alpha_composite(image, (index * 192, row * 192))
    return sheet


def main() -> None:
    rows = []
    for state, count in COUNTS.items():
        folder = OUT / state; folder.mkdir(parents=True, exist_ok=True)
        frames = []
        for index in range(count):
            image = normalize(BASES / f"{state}_frame{index}.png", state == "jumpAir")
            image.save(folder / f"frame{index}.png", "PNG", optimize=True)
            frames.append(image)
        rows.append(frames)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    preview(rows).save(PREVIEW, "PNG", optimize=True)
    print("Exported 46 articulated Saltador Alado RGBA frames")


if __name__ == "__main__":
    main()
