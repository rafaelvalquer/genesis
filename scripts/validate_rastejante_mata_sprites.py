#!/usr/bin/env python3
"""Validate the 512px RGBA Rastejante runtime sprite contract."""
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "rastejanteMata"
STATES = ("idle", "walking", "attack")
FRAME_SIZE = (512, 512)
GROUND_Y = 499

def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise AssertionError("empty alpha silhouette")
    return bbox

def main() -> None:
    hashes: set[str] = set()
    state_hashes: dict[str, list[str]] = {}
    for state in STATES:
        bottoms = []
        widths = []
        for index in range(8):
            path = OUT / state / f"frame{index}.png"
            image = Image.open(path).convert("RGBA")
            assert image.size == FRAME_SIZE, f"invalid dimensions: {path}"
            alpha = image.getchannel("A")
            assert alpha.getextrema()[0] == 0, f"missing transparent pixels: {path}"
            bbox = alpha_bbox(image)
            bottoms.append(bbox[3] - 1)
            widths.append(bbox[2] - bbox[0])
            pixels = image.load()
            for y in range(image.height):
                for x in range(image.width):
                    red, green, blue, opacity = pixels[x, y]
                    if opacity == 0:
                        assert (red, green, blue) == (0, 0, 0), f"dirty transparent RGB: {path}"
                    if 0 < opacity < 255:
                        assert min(red, blue) - green <= 34, f"magenta fringe: {path}"
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            state_hashes.setdefault(state, []).append(digest)
            hashes.add(digest)
        assert max(bottoms) - min(bottoms) <= 1, f"foot drift in {state}: {bottoms}"
        assert max(abs(bottom - GROUND_Y) for bottom in bottoms) <= 1
        assert max(widths) <= 400, f"oversized {state}: {widths}"
    assert len(hashes) == 24, "frames are not visually distinct"
    assert state_hashes["walking"][0] != state_hashes["walking"][4]
    assert state_hashes["attack"][3] != state_hashes["attack"][4]
    print("Validated 24 Rastejante da Mata frames: 512px RGBA, clean alpha, shared ground root")

if __name__ == "__main__":
    main()
