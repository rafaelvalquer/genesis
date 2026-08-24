#!/usr/bin/env python3
"""Validate Rastejante da Mata sprite contracts and shared baseline."""
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "rastejanteMata"


def main() -> None:
    hashes = set()
    for phase in ("idle", "walking", "attack"):
        for index in range(8):
            path = OUT / phase / f"frame{index}.png"
            image = Image.open(path)
            assert image.format == "PNG" and image.mode == "RGBA"
            assert image.size == (192, 192)
            alpha = image.getchannel("A")
            bbox = alpha.getbbox()
            assert bbox and bbox[0] >= 2 and bbox[1] >= 2 and bbox[2] <= 190 and bbox[3] <= 190
            assert any(a == 0 for a in alpha.getdata()), f"missing transparency: {path}"
            hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
    assert len(hashes) == 24, "frames are not visually distinct"
    print("Validated 24 Rastejante da Mata PNGs: RGBA, 192x192, transparent, unique")


if __name__ == "__main__":
    main()
