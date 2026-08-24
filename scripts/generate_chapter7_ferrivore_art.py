#!/usr/bin/env python3
"""Normalize generated Chapter 7 Ferrivore arena art and export game assets."""
from pathlib import Path
import math
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASES = ROOT / "scripts" / "chapter7_ferrivore_bases"
OUT = ROOT / "src" / "game" / "assets" / "arenas"
PREVIEWS = ROOT / ".codex-tmp" / "convoy7"
NAMES = ["chapter_07"] + [f"fase_{i}" for i in range(49, 57)]
SIZE = (1024, 512)


def normalize(path: Path, index: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    # Cover-crop instead of stretching generated compositions.
    scale = max(SIZE[0] / image.width, SIZE[1] / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    image = ImageOps.fit(image, SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.48))
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image = ImageEnhance.Color(image).enhance(0.92)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=110, threshold=3))

    # Consistent Ferrivore grade: warm hematite shadows with restrained cyan lights.
    px = image.load()
    for y in range(image.height):
        depth = y / (image.height - 1)
        for x in range(image.width):
            r, g, b = px[x, y]
            warm = 5 + int(10 * depth)
            cyan = max(0, b - r // 2) if b > r * 1.12 else 0
            px[x, y] = (min(255, r + warm), min(255, g + warm // 3), min(255, b + cyan // 8))
    return image


def contact_sheet(images):
    thumb = (384, 192)
    sheet = Image.new("RGB", (thumb[0] * 4, thumb[1] * 2), (18, 14, 13))
    for i, image in enumerate(images):
        sheet.paste(image.resize(thumb, Image.Resampling.LANCZOS), ((i % 4) * thumb[0], (i // 4) * thumb[1]))
    return sheet


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    images = []
    for index, name in enumerate(NAMES):
        source = BASES / f"{name}.png"
        if not source.exists():
            raise FileNotFoundError(source)
        image = normalize(source, index)
        image.save(OUT / f"{name}.webp", "WEBP", lossless=True, method=6)
        images.append(image)

    contact_sheet(images[1:]).save(PREVIEWS / "ferrivore_phase_overview.png", "PNG", optimize=True)
    images[0].save(PREVIEWS / "ferrivore_cover.png", "PNG", optimize=True)
    contact_sheet(images[1:]).resize((896, 224), Image.Resampling.LANCZOS).save(
        PREVIEWS / "ferrivore_phase_overview_small.png", "PNG", optimize=True
    )
    print(f"Exported {len(NAMES)} Ferrivore arena images to {OUT}")


if __name__ == "__main__":
    main()
