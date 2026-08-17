from pathlib import Path
import argparse

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STATES = ["idle", "targetLock", "arcSpikeAttack", "rearm", "paralyzed", "death"]
SOURCE_ROOT = ROOT / "art" / "spritesheets" / "mantis" / "sources"
ART_ROOT = ROOT / "art" / "sprites" / "mantis"
RUNTIME_ROOT = ROOT / "src" / "game" / "assets" / "troop" / "mantis"
FRAME_SIZE = 384
MAIN_COMPONENTS = 8
IDLE_BODY_ANCHOR_X = 186


def connected_components(image: Image.Image, threshold: int = 32):
    width, height = image.size
    mask = bytearray(1 if alpha > threshold else 0 for alpha in image.getchannel("A").tobytes())
    visited = bytearray(width * height)
    components = []
    for start, active in enumerate(mask):
        if not active or visited[start]:
            continue
        stack = [start]
        visited[start] = 1
        pixels = []
        min_x, min_y, max_x, max_y = width, height, 0, 0
        while stack:
            index = stack.pop()
            pixels.append(index)
            x, y = index % width, index // width
            min_x, min_y = min(min_x, x), min(min_y, y)
            max_x, max_y = max(max_x, x), max(max_y, y)
            for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= next_x < width and 0 <= next_y < height:
                    next_index = next_y * width + next_x
                    if mask[next_index] and not visited[next_index]:
                        visited[next_index] = 1
                        stack.append(next_index)
        components.append({
            "pixels": pixels,
            "area": len(pixels),
            "bbox": (min_x, min_y, max_x + 1, max_y + 1),
            "center_x": (min_x + max_x + 1) / 2,
        })
    return components


def extract_frames(strip: Image.Image, state: str):
    components = connected_components(strip)
    main = sorted(components, key=lambda component: component["area"], reverse=True)[:MAIN_COMPONENTS]
    if len(main) != MAIN_COMPONENTS or main[-1]["area"] < 4_000:
        raise ValueError(f"{state}: expected 8 complete high-resolution subjects")
    main.sort(key=lambda component: component["center_x"])
    assignments = {id(component): [component] for component in main}
    main_ids = set(assignments)
    for component in components:
        if id(component) in main_ids or component["area"] < 40:
            continue
        # The actual spike is rendered by the projectile system from the bow
        # muzzle. Detached flecks in the generated attack strip are cell
        # residue, not part of the character animation.
        if state == "arcSpikeAttack":
            continue
        nearest = min(main, key=lambda candidate: abs(candidate["center_x"] - component["center_x"]))
        assignments[id(nearest)].append(component)

    pixels = strip.load()
    alpha = strip.getchannel("A").tobytes()
    width, height = strip.size
    layers = [Image.new("RGBA", strip.size, (0, 0, 0, 0)) for _ in main]
    layer_pixels = [layer.load() for layer in layers]
    layer_masks = [bytearray(width * height) for _ in main]
    for frame_index, subject_component in enumerate(main):
        for component in assignments[id(subject_component)]:
            for index in component["pixels"]:
                x, y = index % width, index // width
                layer_pixels[frame_index][x, y] = pixels[x, y]
                layer_masks[frame_index][index] = 1

    # Preserve the faint antialiased fringe without letting it bridge two frames
    # during connected-component detection.
    for index, opacity in enumerate(alpha):
        if not 0 < opacity <= 32:
            continue
        x, y = index % width, index // width
        frame_index = min(range(len(main)), key=lambda candidate: abs(main[candidate]["center_x"] - x))
        mask = layer_masks[frame_index]
        touches_subject = any(
            mask[near_y * width + near_x]
            for near_y in range(max(0, y - 2), min(height, y + 3))
            for near_x in range(max(0, x - 2), min(width, x + 3))
        )
        if touches_subject:
            layer_pixels[frame_index][x, y] = pixels[x, y]

    frames = []
    for layer in layers:
        bbox = layer.getbbox()
        if not bbox:
            raise ValueError(f"{state}: empty frame after component extraction")
        frames.append(layer.crop(bbox))
    return frames


def place_subject(subject: Image.Image, state: str):
    target_height = 382 if state == "arcSpikeAttack" else 374
    target_width = 382 if state == "arcSpikeAttack" else 374
    # Never enlarge generated art: the previous pipeline upscaled ~157px cells,
    # permanently baking pixelation into the runtime PNGs.
    scale = min(target_width / subject.width, target_height / subject.height, 1.0)
    if scale < 1:
        subject = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    baseline = 382 if state == "arcSpikeAttack" else 378
    left = (FRAME_SIZE - subject.width) // 2
    top = max(4, baseline - subject.height)
    canvas.alpha_composite(subject, (left, top))
    return canvas, scale


def lower_body_anchor_x(frame: Image.Image):
    alpha = frame.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("Cannot align an empty MANTIS frame")
    left, top, right, bottom = bbox
    lower_body_top = top + round((bottom - top) * 0.48)
    alpha_pixels = alpha.load()
    occupied_x = [
        x
        for y in range(lower_body_top, bottom)
        for x in range(left, right)
        if alpha_pixels[x, y] > 32
    ]
    if not occupied_x:
        raise ValueError("Cannot find the MANTIS lower-body anchor")
    occupied_x.sort()
    return occupied_x[len(occupied_x) // 2]


def align_idle_frame(frame: Image.Image):
    offset_x = IDLE_BODY_ANCHOR_X - lower_body_anchor_x(frame)
    if offset_x == 0:
        return frame
    aligned = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    aligned.alpha_composite(frame, (offset_x, 0))
    return aligned


def main():
    parser = argparse.ArgumentParser(description="Process high-resolution MANTIS animation strips.")
    parser.add_argument(
        "--source-dir",
        default=str(SOURCE_ROOT),
        help="Directory containing one transparent <state>-8x1.png strip per state.",
    )
    args = parser.parse_args()
    source_root = Path(args.source_dir).resolve()

    final_sheet = Image.new("RGBA", (FRAME_SIZE * 8, FRAME_SIZE * 6), (0, 0, 0, 0))
    minimum_scale = 1.0
    for row, state in enumerate(STATES):
        source = source_root / f"{state}-8x1.png"
        if not source.is_file():
            raise FileNotFoundError(f"Missing MANTIS source strip: {source}")
        strip = Image.open(source).convert("RGBA")
        frames = extract_frames(strip, state)
        for col, subject in enumerate(frames):
            canvas, scale = place_subject(subject, state)
            if state == "idle":
                canvas = align_idle_frame(canvas)
            minimum_scale = min(minimum_scale, scale)
            for output_root in (ART_ROOT, RUNTIME_ROOT):
                state_root = output_root / state
                state_root.mkdir(parents=True, exist_ok=True)
                canvas.save(state_root / f"frame{col}.png", optimize=True)
            final_sheet.alpha_composite(canvas, (col * FRAME_SIZE, row * FRAME_SIZE))

    final_sheet.save(ROOT / "art" / "spritesheets" / "mantis" / "mantis-6x8.png", optimize=True)
    print(f"Processed {len(STATES) * 8} high-resolution MANTIS frames; minimum scale={minimum_scale:.3f}")


if __name__ == "__main__":
    main()
