from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "src" / "game" / "assets" / "troop" / "cryo7" / "idle"


def clean(path: Path):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size
    seen = set()
    components = []
    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y] < 20:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            component = []
            while stack:
                current_x, current_y = stack.pop()
                component.append((current_x, current_y))
                for next_x, next_y in ((current_x - 1, current_y), (current_x + 1, current_y),
                                        (current_x, current_y - 1), (current_x, current_y + 1),
                                        (current_x - 1, current_y - 1), (current_x + 1, current_y - 1),
                                        (current_x - 1, current_y + 1), (current_x + 1, current_y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height and (next_x, next_y) not in seen and pixels[next_x, next_y] >= 20:
                        seen.add((next_x, next_y))
                        stack.append((next_x, next_y))
            components.append(component)
    largest = set(max(components, key=len))
    for y in range(height):
        for x in range(width):
            if (x, y) not in largest:
                pixels[x, y] = 0
    image.putalpha(alpha)
    image.save(path, optimize=True)


for frame in sorted(ROOT.glob("frame*.png")):
    clean(frame)
    print(f"cleaned {frame.name}")
