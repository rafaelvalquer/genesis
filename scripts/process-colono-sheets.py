from pathlib import Path
from collections import deque
import shutil
import sys

from PIL import Image, ImageFilter, ImageOps


FRAME_SIZE = 560
SUBJECT_HEIGHT = 450
GROUND_Y = 510


def keep_largest_component(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    alpha = rgba.getchannel("A")
    pixels = alpha.load()
    visited = bytearray(alpha.width * alpha.height)
    largest: list[tuple[int, int]] = []

    for y in range(alpha.height):
        for x in range(alpha.width):
            offset = y * alpha.width + x
            if visited[offset] or pixels[x, y] <= 16:
                continue
            component = []
            queue = deque([(x, y)])
            visited[offset] = 1
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if not (0 <= next_x < alpha.width and 0 <= next_y < alpha.height):
                        continue
                    next_offset = next_y * alpha.width + next_x
                    if visited[next_offset] or pixels[next_x, next_y] <= 16:
                        continue
                    visited[next_offset] = 1
                    queue.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component

    keep = Image.new("L", rgba.size, 0)
    keep_pixels = keep.load()
    for x, y in largest:
        keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5))
    rgba.putalpha(Image.composite(alpha, Image.new("L", rgba.size, 0), keep))
    return rgba


def find_components(alpha: Image.Image, minimum_size: int = 100) -> list[dict]:
    pixels = alpha.load()
    width, height = alpha.size
    visited = bytearray(width * height)
    components = []
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or pixels[x, y] <= 16:
                continue
            points = []
            bounds = [x, y, x, y]
            queue = deque([(x, y)])
            visited[offset] = 1
            while queue:
                current_x, current_y = queue.popleft()
                points.append((current_x, current_y))
                bounds[0] = min(bounds[0], current_x)
                bounds[1] = min(bounds[1], current_y)
                bounds[2] = max(bounds[2], current_x)
                bounds[3] = max(bounds[3], current_y)
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_offset = next_y * width + next_x
                    if visited[next_offset] or pixels[next_x, next_y] <= 16:
                        continue
                    visited[next_offset] = 1
                    queue.append((next_x, next_y))
            if len(points) >= minimum_size:
                components.append({"points": points, "bounds": tuple(bounds), "size": len(points)})
    return components


def split_component_sheet(
    source_path: Path,
    expected_count: int,
    apply_crystal_tint: bool = False,
) -> list[Image.Image]:
    source = Image.open(source_path).convert("RGBA")
    components = sorted(
        find_components(source.getchannel("A")),
        key=lambda component: component["size"],
        reverse=True,
    )[:expected_count]
    if len(components) != expected_count:
        raise SystemExit(f"expected {expected_count} subjects, found {len(components)}: {source_path}")
    components.sort(key=lambda component: (component["bounds"][1] // (source.height // 2), component["bounds"][0]))
    max_height = max(component["bounds"][3] - component["bounds"][1] + 1 for component in components)
    scale = SUBJECT_HEIGHT / max_height
    frames = []
    source_alpha = source.getchannel("A")

    for component in components:
        left, top, right, bottom = component["bounds"]
        mask = Image.new("L", (right - left + 1, bottom - top + 1), 0)
        mask_pixels = mask.load()
        for x, y in component["points"]:
            mask_pixels[x - left, y - top] = 255
        mask = mask.filter(ImageFilter.MaxFilter(5))
        subject = source.crop((left, top, right + 1, bottom + 1))
        alpha = source_alpha.crop((left, top, right + 1, bottom + 1))
        subject.putalpha(Image.composite(alpha, Image.new("L", subject.size, 0), mask))
        resized = subject.resize(
            (round(subject.width * scale), round(subject.height * scale)),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.alpha_composite(resized, ((FRAME_SIZE - resized.width) // 2, GROUND_Y - resized.height))
        frames.append(tint_crystal_halo(frame) if apply_crystal_tint else frame)
    return frames
def tint_crystal_halo(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    pixels = rgba.load()
    cyan = Image.new("L", rgba.size, 0)
    cyan_pixels = cyan.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha > 40 and blue > 210 and green > 180 and red < 120 and blue > red * 1.8:
                cyan_pixels[x, y] = 255

    nearby_crystal = cyan.filter(ImageFilter.MaxFilter(31))
    nearby_pixels = nearby_crystal.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if not alpha or not nearby_pixels[x, y]:
                continue
            spread = max(red, green, blue) - min(red, green, blue)
            if spread < 70 and max(red, green, blue) > 24:
                luminance = max(red, green, blue) / 255
                glow_alpha = alpha if luminance >= 0.72 else min(alpha, int(255 * (luminance ** 1.45) * 0.72))
                pixels[x, y] = (
                    int(45 + 85 * luminance),
                    int(165 + 75 * luminance),
                    255,
                    glow_alpha,
                )
    return rgba


def split_sheet(source_path: Path, columns: int, rows: int) -> list[Image.Image]:
    source = Image.open(source_path).convert("RGBA")
    if source.width % columns or source.height % rows:
        raise SystemExit(f"sheet does not divide into a {columns}x{rows} grid: {source_path} {source.size}")

    cell_width = source.width // columns
    cell_height = source.height // rows
    frames = []
    for row in range(rows):
        for column in range(columns):
            cell = source.crop((
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            ))
            fitted = ImageOps.contain(cell, (FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
            frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            frame.alpha_composite(fitted, ((FRAME_SIZE - fitted.width) // 2, (FRAME_SIZE - fitted.height) // 2))
            frames.append(tint_crystal_halo(keep_largest_component(frame)))
    return frames


def validate_frame(frame: Image.Image, label: str) -> None:
    if frame.size != (FRAME_SIZE, FRAME_SIZE) or frame.mode != "RGBA":
        raise SystemExit(f"invalid frame geometry: {label} {frame.mode} {frame.size}")
    alpha = frame.getchannel("A")
    corners = [alpha.getpixel(point) for point in ((0, 0), (559, 0), (0, 559), (559, 559))]
    if any(corners):
        raise SystemExit(f"non-transparent corner: {label} {corners}")
    opaque_bounds = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
    if not opaque_bounds:
        raise SystemExit(f"empty frame: {label}")


def write_state(
    source: Path,
    state: str,
    art_dir: Path,
    troop_dir: Path,
    columns: int = 2,
    rows: int = 2,
    component_split: bool = False,
    character_name: str = "colono",
    apply_crystal_tint: bool = False,
) -> None:
    frames = (
        split_component_sheet(source, columns * rows, apply_crystal_tint)
        if component_split
        else split_sheet(source, columns, rows)
    )
    runtime_dir = troop_dir / state
    runtime_dir.mkdir(parents=True, exist_ok=True)

    for old_frame in runtime_dir.glob("frame*.png"):
        old_frame.unlink()
    legacy = runtime_dir / "antigo"
    if legacy.exists():
        shutil.rmtree(legacy)

    sheet_size = (FRAME_SIZE * columns, FRAME_SIZE * rows)
    sheet = Image.new("RGBA", sheet_size, (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        validate_frame(frame, f"{state}/frame{index}")
        frame.save(runtime_dir / f"frame{index}.png", optimize=True)
        sheet.alpha_composite(frame, ((index % columns) * FRAME_SIZE, (index // columns) * FRAME_SIZE))

    art_dir.mkdir(parents=True, exist_ok=True)
    sheet_path = art_dir / f"{character_name}-{state}-sheet.png"
    sheet.save(sheet_path, optimize=True)
    if sheet.size != sheet_size:
        raise SystemExit(f"invalid final sheet: {sheet_path} {sheet.size}")


def main() -> None:
    if len(sys.argv) == 4:
        idle_source, art_dir, troop_dir = map(Path, sys.argv[1:])
        write_state(
            idle_source,
            "idle",
            art_dir,
            troop_dir,
            columns=4,
            rows=2,
            component_split=True,
            apply_crystal_tint=True,
        )
        return
    if len(sys.argv) == 6:
        idle_source, attack_source, art_dir, troop_dir = map(Path, sys.argv[1:5])
        character_name = sys.argv[5]
        write_state(
            idle_source, "idle", art_dir, troop_dir,
            columns=4, rows=2, component_split=True, character_name=character_name,
        )
        write_state(
            attack_source, "attack", art_dir, troop_dir,
            columns=4, rows=2, component_split=True, character_name=character_name,
        )
        return
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: process-colono-sheets.py IDLE_8_RGBA ART_DIR TROOP_DIR\n"
            "   or: process-colono-sheets.py IDLE_8_RGBA ATTACK_8_RGBA ART_DIR TROOP_DIR CHARACTER\n"
            "   or: process-colono-sheets.py IDLE_RGBA ATTACK_RGBA ART_DIR TROOP_DIR"
        )
    idle_source, attack_source, art_dir, troop_dir = map(Path, sys.argv[1:])
    write_state(idle_source, "idle", art_dir, troop_dir)
    write_state(attack_source, "attack", art_dir, troop_dir)


if __name__ == "__main__":
    main()
