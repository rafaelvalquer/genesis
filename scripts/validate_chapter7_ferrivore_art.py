#!/usr/bin/env python3
"""Validate Chapter 7 arena art dimensions, format, palette and visual uniqueness."""
from pathlib import Path
import hashlib
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ARENAS = ROOT / "src" / "game" / "assets" / "arenas"
NAMES = ["chapter_07"] + [f"fase_{i}" for i in range(49, 57)]


def main() -> None:
    images = []
    for name in NAMES:
        path = ARENAS / f"{name}.webp"
        assert path.exists(), f"missing {path}"
        assert path.read_bytes()[:4] == b"RIFF", f"not WebP container: {path}"
        image = Image.open(path).convert("RGB")
        assert image.size == (1024, 512), f"wrong dimensions: {path} ({image.size})"
        # Reject accidental solid strips/matte borders while allowing natural dark edges.
        edge = [image.getpixel((x, 0)) for x in range(image.width)]
        assert len(set(edge)) > 32, f"uniform top border: {path}"
        stat = ImageStat.Stat(image)
        assert stat.mean[0] > 12 and stat.mean[2] > 10, f"empty image: {path}"
        # Ferrivore palette must contain warm mineral contrast and cyan biological light.
        pixels = list(image.resize((128, 64)).getdata())
        warm = sum(1 for r, g, b in pixels if r > g * 1.18 and r > b * 1.12)
        cyan = sum(1 for r, g, b in pixels if b > r * 1.18 and g > r * 0.95)
        assert warm > 80 and cyan > 20, f"palette drift: {path} warm={warm} cyan={cyan}"
        images.append(image)
    hashes = [hashlib.sha256(image.tobytes()).hexdigest() for image in images]
    assert len(set(hashes)) == len(hashes), "duplicate arena images"
    print(f"Validated {len(images)} WebP arenas: 1024x512, Ferrivore palette, unique scenes")


if __name__ == "__main__":
    main()
