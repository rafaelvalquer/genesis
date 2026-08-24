#!/usr/bin/env python3
"""Export the 46 Saltador Alado frames from one transparent master reference."""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "saltador_alado_source" / "master.png"
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "saltadorAlado"
SIZE = (192, 192)
COUNTS = {"idle": 8, "walking": 8, "attack": 8, "jumpPrep": 4, "jumpAir": 6, "jumpLand": 4, "rasante": 8}


def master_image():
    image = Image.open(SOURCE).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Saltador master has no alpha silhouette")
    image = image.crop(bbox)
    scale = min(166 / image.width, 166 / image.height)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)


def make_frame(master, state, index):
    angles = {
        "idle": [0, -1, -1, -2, -1, 0, 1, 0],
        "walking": [-2, -3, -1, 2, 3, 1, -1, -2],
        "attack": [0, -2, -4, -7, -10, -7, -3, 0],
        "jumpPrep": [0, 2, 4, 6],
        "jumpAir": [4, 2, 0, -2, -4, -2],
        "jumpLand": [-4, -2, 0, 1],
        "rasante": [0, -3, -8, -15, -19, -12, -5, 0],
    }[state]
    scales = {
        "idle": [1, 1.005, 1.01, 1.012, 1.01, 1.005, 1, 1],
        "walking": [1, 1.01, 1.015, 1.01, 1, 1.01, 1.015, 1],
        "attack": [1, 1.01, 1.015, 1.025, 1.03, 1.025, 1.01, 1],
        "jumpPrep": [1, .99, .985, .98], "jumpAir": [1, 1.005, 1.01, 1.01, 1.005, 1],
        "jumpLand": [1.01, 1.02, 1.01, 1], "rasante": [1, 1.01, 1.02, 1.035, 1.04, 1.025, 1.01, 1],
    }[state]
    image = master.resize((round(master.width * scales[index]), round(master.height * scales[index])), Image.Resampling.BICUBIC)
    image = image.rotate(angles[index], resample=Image.Resampling.BICUBIC, expand=True)
    image = ImageOps.contain(image, (174, 174), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1 + (index + list(COUNTS).index(state) * 2) * .0015)
    canvas = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    if state == "jumpAir":
        # Keep the airborne body fixed in the PNG; the engine owns the parabola.
        x = (SIZE[0] - image.width) // 2
        y = 26 + (index % 2)
    else:
        x = (SIZE[0] - image.width) // 2 - (2 if state == "rasante" and index in (3, 4, 5) else 0)
        y = SIZE[1] - image.height - 18 + ([0, -1, -2, -1, 0, 1, 1, 0][index] if index < 8 else 0)
    canvas.alpha_composite(image, (x, y))
    return canvas


def main():
    master = master_image()
    for state, count in COUNTS.items():
        folder = OUT / state
        folder.mkdir(parents=True, exist_ok=True)
        for index in range(count):
            make_frame(master, state, index).save(folder / f"frame{index}.png", "PNG", optimize=True)
    print("Exported 46 Saltador Alado RGBA frames")


if __name__ == "__main__":
    main()
