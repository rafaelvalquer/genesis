from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "executorArco"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "executorArco"
FRAME_SIZE = (256, 256)
GRID = (4, 2)
PADDING = 8
ROOT_POINT = (128, 248)
ALPHA_THRESHOLD = 24
PROJECTION_THRESHOLD = 5
MIN_SPRITE_RUN = 64
STATES = {
    "idle": SHEETS / "executor-arco-idle.png",
    "attack1": SHEETS / "executor-arco-attack1.png",
    "attack2": SHEETS / "executor-arco-attack2.png",
    "attack3": SHEETS / "executor-arco-attack3.png",
    "attackRanged": SHEETS / "executor-arco-attackRanged.png",
}
BASE_STATES = ("idle", "attack1", "attack2", "attack3")
EFFECT_TARGET = ROOT / "src" / "game" / "assets" / "effects" / "executorArcSlash"
EFFECT_STATES = {
    "flying": (SHEETS / "executor-arc-slash-flying.png", (4, 2), (96, 48)),
    "impact": (SHEETS / "executor-arc-slash-impact.png", (3, 2), (64, 64)),
}


def visible_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    bbox = frame.getchannel("A").point(
        lambda value: 255 if value >= ALPHA_THRESHOLD else 0
    ).getbbox()
    if not bbox:
        raise SystemExit("empty executorArco sprite cell")
    return bbox


def projected_runs(alpha: Image.Image) -> list[tuple[int, int]]:
    pixels = alpha.load()
    counts = [
        sum(
            1
            for y in range(alpha.height)
            if pixels[x, y] >= ALPHA_THRESHOLD
        )
        for x in range(alpha.width)
    ]
    runs = []
    start = None
    for x, count in enumerate([*counts, 0]):
        if count >= PROJECTION_THRESHOLD and start is None:
            start = x
        elif count < PROJECTION_THRESHOLD and start is not None:
            if x - start >= 3:
                runs.append((start, x))
            start = None

    return [
        (start, end)
        for start, end in runs
        if end - start >= MIN_SPRITE_RUN
    ]


def split_sheet(sheet: Image.Image) -> list[Image.Image]:
    width, height = sheet.size
    cells = []
    for row in range(GRID[1]):
        top = round(row * height / GRID[1])
        bottom = round((row + 1) * height / GRID[1])
        row_image = sheet.crop((0, top, width, bottom))
        runs = projected_runs(row_image.getchannel("A"))
        if len(runs) != GRID[0]:
            raise SystemExit(
                f"expected {GRID[0]} sprites in row {row}, found {len(runs)}: {runs}"
            )
        for start, end in runs:
            rough = row_image.crop((
                max(0, start - PADDING),
                0,
                min(width, end + PADDING),
                row_image.height,
            ))
            bbox = visible_bbox(rough)
            cells.append(rough.crop((
                max(0, bbox[0] - PADDING),
                max(0, bbox[1] - PADDING),
                min(rough.width, bbox[2] + PADDING),
                min(rough.height, bbox[3] + PADDING),
            )))
    return cells


def support_point(cell: Image.Image) -> tuple[float, float]:
    alpha = cell.getchannel("A")
    bbox = visible_bbox(cell)
    support_top = max(bbox[1], bbox[3] - max(12, round((bbox[3] - bbox[1]) * 0.09)))
    weighted_x = 0
    total_weight = 0
    for y in range(support_top, bbox[3]):
        for x in range(bbox[0], bbox[2]):
            value = alpha.getpixel((x, y))
            if value >= ALPHA_THRESHOLD:
                weighted_x += x * value
                total_weight += value
    center_x = weighted_x / total_weight if total_weight else (bbox[0] + bbox[2]) / 2
    return center_x, bbox[3]


def normalize_cell(cell: Image.Image, scale: float) -> Image.Image:
    resized = cell.resize(
        (round(cell.width * scale), round(cell.height * scale)),
        Image.Resampling.LANCZOS,
    )
    alpha = resized.getchannel("A")
    rgb = resized.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=0.7, percent=105, threshold=2)
    )
    resized = Image.merge("RGBA", (*rgb.split(), alpha))
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    source_center_x, source_baseline_y = support_point(cell)
    offset_x = round(ROOT_POINT[0] - source_center_x * scale)
    offset_y = round(ROOT_POINT[1] - source_baseline_y * scale)
    frame.alpha_composite(resized, (offset_x, offset_y))
    return frame


def split_fixed_grid(sheet: Image.Image, grid: tuple[int, int]) -> list[Image.Image]:
    cells = []
    for row in range(grid[1]):
        for col in range(grid[0]):
            left = round(col * sheet.width / grid[0])
            top = round(row * sheet.height / grid[1])
            right = round((col + 1) * sheet.width / grid[0])
            bottom = round((row + 1) * sheet.height / grid[1])
            rough = sheet.crop((left, top, right, bottom))
            bbox = visible_bbox(rough)
            cells.append(rough.crop((
                max(0, bbox[0] - PADDING),
                max(0, bbox[1] - PADDING),
                min(rough.width, bbox[2] + PADDING),
                min(rough.height, bbox[3] + PADDING),
            )))
    return cells


def normalize_effect_cell(cell: Image.Image, frame_size: tuple[int, int]) -> Image.Image:
    scale = min(
        (frame_size[0] - 4) / cell.width,
        (frame_size[1] - 4) / cell.height,
    )
    resized = cell.resize(
        (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    frame.alpha_composite(resized, (
        (frame_size[0] - resized.width) // 2,
        (frame_size[1] - resized.height) // 2,
    ))
    return frame


def validate() -> None:
    total_bytes = 0
    for state in STATES:
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for path in frames:
            frame = Image.open(path).convert("RGBA")
            if frame.size != FRAME_SIZE or not frame.getchannel("A").getbbox():
                raise SystemExit(f"invalid frame: {path}")
            if any(frame.getchannel("A").getpixel(point) for point in ((0, 0), (255, 0), (0, 255), (255, 255))):
                raise SystemExit(f"opaque corner: {path}")
            total_bytes += path.stat().st_size
    if total_bytes > 900_000:
        raise SystemExit(f"executorArco frame budget exceeded: {total_bytes} bytes")

    for state, (_, grid, frame_size) in EFFECT_STATES.items():
        frames = sorted((EFFECT_TARGET / state).glob("frame*.png"))
        if len(frames) != grid[0] * grid[1]:
            raise SystemExit(f"expected {grid[0] * grid[1]} {state} effect frames, found {len(frames)}")
        for path in frames:
            frame = Image.open(path).convert("RGBA")
            if frame.size != frame_size or not frame.getchannel("A").getbbox():
                raise SystemExit(f"invalid effect frame: {path}")


if __name__ == "__main__":
    cells_by_state = {
        state: (
            split_fixed_grid(Image.open(path).convert("RGBA"), GRID)
            if state == "attackRanged"
            else split_sheet(Image.open(path).convert("RGBA"))
        )
        for state, path in STATES.items()
    }
    all_boxes = [
        visible_bbox(cell)
        for state in BASE_STATES
        for cell in cells_by_state[state]
    ]
    max_width = max(box[2] - box[0] for box in all_boxes)
    max_height = max(box[3] - box[1] for box in all_boxes)
    scale = min(
        (FRAME_SIZE[0] - PADDING * 2) / max_width,
        (FRAME_SIZE[1] - PADDING * 2) / max_height,
    )

    for state, cells in cells_by_state.items():
        output = TARGET / state
        output.mkdir(parents=True, exist_ok=True)
        for index, cell in enumerate(cells):
            frame = normalize_cell(cell, scale)
            indexed = frame.quantize(
                colors=192,
                method=Image.Quantize.FASTOCTREE,
                dither=Image.Dither.NONE,
            )
            indexed.save(output / f"frame{index}.png", optimize=True, compress_level=9)

    for state, (path, grid, frame_size) in EFFECT_STATES.items():
        cells = split_fixed_grid(Image.open(path).convert("RGBA"), grid)
        output = EFFECT_TARGET / state
        output.mkdir(parents=True, exist_ok=True)
        for index, cell in enumerate(cells):
            frame = normalize_effect_cell(cell, frame_size)
            indexed = frame.quantize(
                colors=128,
                method=Image.Quantize.FASTOCTREE,
                dither=Image.Dither.NONE,
            )
            indexed.save(output / f"frame{index}.png", optimize=True, compress_level=9)

    validate()
    print(f"Vortice sprites written to {TARGET} with scale {scale:.6f}")
