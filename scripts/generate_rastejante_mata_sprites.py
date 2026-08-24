#!/usr/bin/env python3
"""Build the 24 production Rastejante da Mata PNGs from one transparent master cutout."""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "rastejante_mata_source" / "master.png"
OUT = ROOT / "src" / "game" / "assets" / "enemy" / "rastejanteMata"
SIZE = (192, 192)


def fitted_master() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("master has no visible pixels")
    source = source.crop(bbox)
    # Keep the feet inside a shared 82-88% baseline and leave attack padding.
    scale = min(166 / source.width, 150 / source.height)
    return source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)


def frame(master: Image.Image, phase: str, index: int) -> Image.Image:
    canvas = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    # Deliberately small transforms preserve the same individual and root/pivot.
    if phase == "idle":
        dy = [1, 0, -1, -2, -1, 0, 1, 1][index]
        sx = [1.00, 1.002, 1.004, 1.002, 1.00, .998, .997, 1.00][index]
        shear = [0, -0.003, -0.005, -0.003, 0, .003, .005, .002][index]
        brightness = [1.00, 1.01, 1.015, 1.01, 1.00, .995, .99, 1.00][index]
    elif phase == "walking":
        dy = [1, 0, -1, 0, 1, 0, -1, 0][index]
        sx = [1.00, 1.01, 1.015, 1.01, 1.00, 1.01, 1.015, 1.005][index]
        shear = [-.01, -.016, -.008, .01, .016, .008, -.004, -.01][index]
        brightness = [1.00, 1.005, 1.01, 1.005, 1.00, .995, .99, .998][index]
    else:
        dy = [1, 0, -1, -1, -2, -1, 0, 1][index]
        sx = [1.00, 1.005, 1.01, 1.02, 1.025, 1.018, 1.008, 1.00][index]
        shear = [0, -.012, -.024, -.045, -.06, -.045, -.018, 0][index]
        brightness = [1.00, 1.01, 1.02, 1.03, 1.035, 1.02, 1.01, 1.00][index]
    w, h = round(master.width * sx), round(master.height * sx)
    image = master.resize((w, h), Image.Resampling.BICUBIC)
    # Affine shear makes the attack/walk read as body motion without moving the root.
    image = image.transform((w + 12, h), Image.Transform.AFFINE, (1, shear, 4, 0, 1, 0), Image.Resampling.BICUBIC)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    # A minute phase-specific contrast change keeps every exported frame distinct
    # after PNG quantization while remaining invisible during playback.
    image = ImageEnhance.Contrast(image).enhance(1.0 + (index + (0 if phase == "idle" else 8 if phase == "walking" else 16)) * 0.002)
    x = (SIZE[0] - image.width) // 2 - (2 if phase == "attack" and index in (3, 4, 5) else 0)
    y = SIZE[1] - image.height - 24 + dy
    canvas.alpha_composite(image, (x, y))
    return canvas


def main() -> None:
    master = fitted_master()
    for phase in ("idle", "walking", "attack"):
        folder = OUT / phase
        folder.mkdir(parents=True, exist_ok=True)
        for index in range(8):
            frame(master, phase, index).save(folder / f"frame{index}.png", "PNG", optimize=True)
    print("Exported 24 Rastejante da Mata RGBA frames")


if __name__ == "__main__":
    main()
