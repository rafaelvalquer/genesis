from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(r"C:\Projetos\Genesis")
ASSETS = ROOT / "src" / "game" / "assets" / "enemy"
OUTPUT = ROOT / "tmp" / "sprite-refinement"
MONSTERS = ("estilha", "vitrarca", "obsidonte", "refrator")
STATES = ("idle", "walking", "attack")


def checkerboard(size):
    image = Image.new("RGBA", size, "#101827")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 16):
        for x in range(0, size[0], 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill="#1f2937")
    return image


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    overview = checkerboard((8 * 256, len(MONSTERS) * len(STATES) * 256))

    for monster_index, monster in enumerate(MONSTERS):
        for state_index, state in enumerate(STATES):
            red_sheet = Image.new("RGBA", (4 * 256, 2 * 256), "#ff0000")
            for frame_index in range(8):
                frame = Image.open(
                    ASSETS / monster / state / f"frame{frame_index}.png"
                ).convert("RGBA")
                red_sheet.alpha_composite(
                    frame,
                    ((frame_index % 4) * 256, (frame_index // 4) * 256),
                )
                overview.alpha_composite(
                    frame,
                    (
                        frame_index * 256,
                        (monster_index * len(STATES) + state_index) * 256,
                    ),
                )
            red_sheet.convert("RGB").save(
                OUTPUT / f"{monster}-{state}-current.png", optimize=True
            )

    overview.convert("RGB").save(OUTPUT / "current-overview.webp", "WEBP", quality=88)


if __name__ == "__main__":
    main()
