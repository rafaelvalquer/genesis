#!/usr/bin/env python3
"""Validate the 512px Saltador Alado runtime sprite contract."""
from pathlib import Path
import hashlib
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "saltadorAlado"
COUNTS = {"idle": 8, "walking": 8, "attack": 8, "jumpPrep": 4, "jumpAir": 6, "jumpLand": 4, "rasante": 8}
GROUND_STATES = {"idle", "walking", "attack", "jumpPrep", "jumpLand", "rasante"}


def alpha_box(path: Path):
    image = Image.open(path)
    assert image.format == "PNG" and image.mode == "RGBA" and image.size == (512, 512), path
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    assert box and box[0] >= 4 and box[1] >= 4 and box[2] <= 508 and box[3] <= 508, (path, box)
    assert 0 in alpha.get_flattened_data(), f"Missing real transparency: {path}"
    pixels = list(image.get_flattened_data())
    assert all((a != 0 or (r == 0 and g == 0 and b == 0)) for r, g, b, a in pixels), f"Dirty transparent RGB: {path}"
    assert not any(a and min(r, b) - g > 34 for r, g, b, a in pixels), f"Magenta fringe: {path}"
    return box


def body_center(path: Path):
    image = Image.open(path).convert("RGBA")
    points = []
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x, y))
            if a >= 96 and g >= r * 1.03 and g >= b * 1.08 and g >= 55:
                points.append((x, y))
    assert len(points) >= 100, path
    xs = sorted(x for x, _ in points)
    ys = sorted(y for _, y in points)
    return xs[len(xs) // 2], ys[len(ys) // 2]


def main() -> None:
    hashes = set()
    state_hashes = {}
    air_centers = []
    terrestrial_bottoms = []
    for state, count in COUNTS.items():
        files = list((OUT / state).glob("frame*.png"))
        assert len(files) == count, (state, len(files), count)
        for index in range(count):
            path = OUT / state / f"frame{index}.png"
            box = alpha_box(path)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            hashes.add(digest)
            state_hashes.setdefault(state, []).append(digest)
            if state in GROUND_STATES:
                terrestrial_bottoms.append(box[3] - 1)
            if state == "jumpAir":
                air_centers.append(body_center(path))
    assert len(hashes) == 46, "Every runtime frame must be unique"
    assert max(terrestrial_bottoms) - min(terrestrial_bottoms) <= 4, terrestrial_bottoms
    assert state_hashes["walking"][0] != state_hashes["walking"][4]
    assert state_hashes["attack"][3] != state_hashes["attack"][4]
    assert state_hashes["rasante"][3] != state_hashes["rasante"][4]
    assert max(x for x, _ in air_centers) - min(x for x, _ in air_centers) <= 3, air_centers
    assert max(y for _, y in air_centers) - min(y for _, y in air_centers) <= 3, air_centers
    print("Validated 46 Saltador Alado frames: 512px RGBA, global body scale, clean alpha and stable roots")


if __name__ == "__main__":
    main()
