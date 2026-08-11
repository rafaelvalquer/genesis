from pathlib import Path
from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "tmp" / "imagegen"
OUTPUT_DIR = ROOT / "src" / "game" / "assets" / "troop" / "cryo7"


def alpha_bbox(image: Image.Image):
    alpha = image.getchannel("A")
    return alpha.getbbox()


def lower_body_bbox(image: Image.Image):
    alpha = image.getchannel("A").crop((0, round(image.height * 0.82), image.width, image.height))
    bbox = alpha.getbbox()
    if not bbox:
        return None
    return bbox[0], bbox[1] + round(image.height * 0.82), bbox[2], bbox[3] + round(image.height * 0.82)


def keep_largest_alpha_component(image: Image.Image):
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
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
                for next_x, next_y in (
                    (current_x - 1, current_y), (current_x + 1, current_y),
                    (current_x, current_y - 1), (current_x, current_y + 1),
                    (current_x - 1, current_y - 1), (current_x + 1, current_y - 1),
                    (current_x - 1, current_y + 1), (current_x + 1, current_y + 1),
                ):
                    if 0 <= next_x < width and 0 <= next_y < height \
                            and (next_x, next_y) not in seen and pixels[next_x, next_y] >= 20:
                        seen.add((next_x, next_y))
                        stack.append((next_x, next_y))
            components.append(component)
    if not components:
        return image
    largest = set(max(components, key=len))
    for y in range(height):
        for x in range(width):
            if (x, y) not in largest:
                pixels[x, y] = 0
    image.putalpha(alpha)
    return image


def process(state: str):
    sheet = Image.open(SOURCE_DIR / f"cryo7-{state}-alpha.png").convert("RGBA")
    panel_width = sheet.width // 8
    frames = [sheet.crop((index * panel_width, 0, (index + 1) * panel_width, sheet.height)) for index in range(8)]
    boxes = [alpha_bbox(frame) for frame in frames]
    boxes = [box for box in boxes if box]
    if len(boxes) != 8:
        raise RuntimeError(f"{state}: expected 8 non-empty frames, got {len(boxes)}")

    left = min(box[0] for box in boxes)
    top = min(box[1] for box in boxes)
    right = max(box[2] for box in boxes)
    bottom = max(box[3] for box in boxes)
    common = (left, top, right, bottom)

    out_dir = OUTPUT_DIR / state
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        cropped = frame.crop(common)
        scale = min(360 / cropped.width, 500 / cropped.height)
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        resized = cropped.resize(size, Image.Resampling.LANCZOS)
        if state == "idle":
            resized = keep_largest_alpha_component(resized)
        if state == "attack" and index == 5:
            # The generated release panel contained one detached grey speck left of the tank.
            # Remove only that isolated artifact; the muzzle puff on the right stays intact.
            resized.putalpha(resized.getchannel("A").copy())
            alpha = resized.getchannel("A")
            alpha.paste(0, (0, round(resized.height * 0.28), round(resized.width * 0.35), round(resized.height * 0.58)))
            resized.putalpha(alpha)
        canvas = Image.new("RGBA", (384, 512), (0, 0, 0, 0))
        if state in ("idle", "attack"):
            lower = lower_body_bbox(resized)
            x = round(canvas.width / 2 - (lower[0] + lower[2]) / 2) if lower else (canvas.width - resized.width) // 2
        else:
            x = (canvas.width - resized.width) // 2
        y = canvas.height - resized.height - 6
        canvas.alpha_composite(resized, (x, y))
        canvas.save(out_dir / f"frame{index}.png", optimize=True)

    print(f"{state}: {len(frames)} frames -> {out_dir} (common source bbox {common})")


for state_name in ("idle", "attack", "death"):
    process(state_name)
