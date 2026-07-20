from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "colossoImpacto"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "colossoImpacto"
FRAME_SIZE = (256, 256)
ROOT_POINT = (128, 248)
PADDING = 8
TARGET_VISIBLE_HEIGHT = 222
STATES = {
    "idle": SHEETS / "colosso-impacto-idle.png",
    "attack": SHEETS / "colosso-impacto-attack.png",
    "special": SHEETS / "colosso-impacto-special-v2.png",
}


def split_cells(sheet: Image.Image) -> list[Image.Image]:
    cells = [
        sheet.crop((
            round((index % 4) * sheet.width / 4),
            round((index // 4) * sheet.height / 2),
            round(((index % 4) + 1) * sheet.width / 4),
            round(((index // 4) + 1) * sheet.height / 2),
        ))
        for index in range(8)
    ]
    return [keep_largest_component(cell) for cell in cells]


def keep_largest_component(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    width, height = frame.size
    foreground = bytearray(1 if value >= 24 else 0 for value in alpha.tobytes())
    visited = bytearray(width * height)
    largest: list[int] = []
    for start, opaque in enumerate(foreground):
        if not opaque or visited[start]:
            continue
        component = []
        queue = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = next_y * width + next_x
                    if foreground[neighbor] and not visited[neighbor]:
                        visited[neighbor] = 1
                        queue.append(neighbor)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise SystemExit("empty sprite cell")
    mask_data = bytearray(width * height)
    for index in largest:
        mask_data[index] = 255
    mask = Image.frombytes("L", frame.size, bytes(mask_data)).filter(ImageFilter.MaxFilter(5))
    cleaned = frame.copy()
    cleaned.putalpha(ImageChops.multiply(alpha, mask))
    return cleaned


def visible_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    bbox = frame.getchannel("A").point(lambda value: 255 if value >= 24 else 0).getbbox()
    if not bbox:
        raise SystemExit("empty sprite cell")
    return bbox


def support_point(frame: Image.Image, bbox: tuple[int, int, int, int]) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bottom = bbox[3] - 1
    support = [
        x
        for y in range(max(bbox[1], bottom - 12), bottom + 1)
        for x in range(bbox[0], bbox[2])
        if alpha.getpixel((x, y)) >= 96
    ]
    if not support:
        raise SystemExit("cannot find the unit ground support")
    return (min(support) + max(support)) / 2, bottom


def frame_scale(cell: Image.Image) -> float:
    box = visible_bbox(cell)
    return min(
        (FRAME_SIZE[0] - PADDING * 2) / (box[2] - box[0]),
        (FRAME_SIZE[1] - PADDING * 2) / (box[3] - box[1]),
        TARGET_VISIBLE_HEIGHT / (box[3] - box[1]),
    )


def normalize_cell(cell: Image.Image, scale: float) -> Image.Image:
    bbox = visible_bbox(cell)
    support_x, support_y = support_point(cell, bbox)
    resized = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
    alpha = resized.getchannel("A")
    sharpened_rgb = resized.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=0.8, percent=110, threshold=2)
    )
    resized = Image.merge("RGBA", (*sharpened_rgb.split(), alpha))
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    offset_x = round(ROOT_POINT[0] - support_x * scale)
    min_offset_x = round(PADDING - bbox[0] * scale)
    max_offset_x = round(FRAME_SIZE[0] - PADDING - bbox[2] * scale)
    offset_x = max(min_offset_x, min(offset_x, max_offset_x))
    offset_y = round(ROOT_POINT[1] - support_y * scale)
    frame.alpha_composite(resized, (offset_x, offset_y))
    return frame


def root_anchor(frame: Image.Image) -> tuple[float, float]:
    bbox = visible_bbox(frame)
    x, y = support_point(frame, bbox)
    return round(x / frame.width, 4), round(y / frame.height, 4)


def validate() -> None:
    for state in STATES:
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for path in frames:
            frame = Image.open(path).convert("RGBA")
            if frame.size != FRAME_SIZE or not frame.getchannel("A").getbbox():
                raise SystemExit(f"invalid frame: {path}")
            alpha = frame.getchannel("A")
            if any(alpha.getpixel(point) for point in ((0, 0), (255, 0), (0, 255), (255, 255))):
                raise SystemExit(f"opaque corner: {path}")


if __name__ == "__main__":
    cells_by_state = {state: split_cells(Image.open(path).convert("RGBA")) for state, path in STATES.items()}
    anchors = {}
    scales = {}
    for state, cells in cells_by_state.items():
        output = TARGET / state
        output.mkdir(parents=True, exist_ok=True)
        for old_frame in output.glob("frame*.png"):
            old_frame.unlink()
        anchors[state] = []
        scales[state] = []
        for index, cell in enumerate(cells):
            scale = frame_scale(cell)
            frame = normalize_cell(cell, scale)
            anchors[state].append(root_anchor(frame))
            scales[state].append(round(scale, 6))
            indexed = frame.quantize(
                colors=192,
                method=Image.Quantize.FASTOCTREE,
                dither=Image.Dither.NONE,
            )
            indexed.save(output / f"frame{index}.png", optimize=True, compress_level=9)
    validate()
    print(f"Colosso de Impacto sprites written to {TARGET}")
    for state, state_anchors in anchors.items():
        print(f"{state} scales: {scales[state]}")
        print(f"{state} anchors: {state_anchors}")
