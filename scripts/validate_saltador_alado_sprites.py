#!/usr/bin/env python3
"""Validate Saltador Alado sprite count, alpha, margins and airborne stability."""
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "saltadorAlado"
COUNTS = {"idle": 8, "walking": 8, "attack": 8, "jumpPrep": 4, "jumpAir": 6, "jumpLand": 4, "rasante": 8}


def alpha_box(path):
    image = Image.open(path)
    assert image.format == "PNG" and image.mode == "RGBA" and image.size == (192, 192)
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    assert box and box[0] >= 8 and box[1] >= 8 and box[2] <= 184 and box[3] <= 184
    assert any(value == 0 for value in alpha.getdata())
    return box


def main():
    hashes = set(); state_hashes = {}; airborne_centers = []
    for state, count in COUNTS.items():
        assert len(list((OUT / state).glob("frame*.png"))) == count
        for index in range(count):
            path = OUT / state / f"frame{index}.png"
            box = alpha_box(path); state_hashes.setdefault(state, []).append(hashlib.sha256(path.read_bytes()).hexdigest()); hashes.add(state_hashes[state][-1])
            if state == "jumpAir": airborne_centers.append(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2))
    assert len(hashes) == 46
    assert state_hashes["walking"][0] != state_hashes["walking"][4], "walking contacts must be opposite poses"
    assert state_hashes["attack"][3] != state_hashes["attack"][4], "attack impact must have a distinct pose"
    assert state_hashes["rasante"][3] != state_hashes["rasante"][4], "rasante impact must have a distinct pose"
    assert max(x for x, _ in airborne_centers) - min(x for x, _ in airborne_centers) <= 4
    assert max(y for _, y in airborne_centers) - min(y for _, y in airborne_centers) <= 4
    print("Validated 46 Saltador Alado PNGs: RGBA, 192x192, unique, stable jumpAir center")


if __name__ == "__main__":
    main()
