"""Clean and rebuild the TR-7 idle loop from the canonical idle master."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src/game/assets/convoy/tr7_pioneiro"
MASTER = ASSETS / "idle/tr7_pioneiro_idle_00.webp"


def clean_matte(image):
    image = image.convert("RGBA")
    px = image.load()
    dark = {(x, y) for x in range(image.width) for y in range(image.height)
            if px[x, y][3] and max(px[x, y][:3]) < 8}
    while dark:
        seed = dark.pop(); component = [seed]; stack = [seed]
        while stack:
            x, y = stack.pop()
            for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if n in dark:
                    dark.remove(n); stack.append(n); component.append(n)
        xs = [p[0] for p in component]; ys = [p[1] for p in component]
        if max(ys) - min(ys) > 260 and max(xs) - min(xs) < 48:
            for x, y in component: px[x, y] = (*px[x, y][:3], 0)
    image.putalpha(image.getchannel("A").point(lambda a: 0 if a < 8 else a))
    return image


def build():
    master = clean_matte(Image.open(MASTER))
    for frame in range(6):
        image = master.copy(); px = image.load()
        pulse = (-10, 0, 12, 20, 5, -4)[frame]
        # Pulse only cyan emitters, leaving wheels, chassis and silhouette fixed.
        for y in range(60, 285):
            for x in range(80, 930):
                r, g, b, a = px[x, y]
                if a and g > 100 and b > 120 and b >= g and r < 120:
                    px[x, y] = (r, max(0, min(255, g + pulse)), max(0, min(255, b + pulse)), a)
        image.save(ASSETS / "idle" / f"tr7_pioneiro_idle_{frame:02d}.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    build()
