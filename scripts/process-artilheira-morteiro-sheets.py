import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "artilheiraMorteiro"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "artilheiraMorteiro"
FRAME_SIZE = (384, 256)
ROOT_POINT = (192, 248)
PADDING = 8
STATES = {
    "idle": SHEETS / "artilheira-morteiro-idle.png",
    "attack": SHEETS / "artilheira-morteiro-attack.png",
}


def split_cells(sheet: Image.Image) -> list[Image.Image]:
    cells = []
    for index in range(8):
        column = index % 4
        row = index // 4
        left = round(column * sheet.width / 4)
        right = round((column + 1) * sheet.width / 4)
        top = round(row * sheet.height / 2)
        bottom = round((row + 1) * sheet.height / 2)
        cells.append(sheet.crop((left, top, right, bottom)))
    return cells


def visible_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    bbox = frame.getchannel("A").point(lambda value: 255 if value >= 24 else 0).getbbox()
    if not bbox:
        raise SystemExit("empty sprite cell")
    return bbox


def support_point(frame: Image.Image, bbox: tuple[int, int, int, int]) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bottom = bbox[3] - 1
    support_x = []
    for y in range(max(bbox[1], bottom - 12), bottom + 1):
        for x in range(bbox[0], bbox[2]):
            if alpha.getpixel((x, y)) >= 96:
                support_x.append(x)
    if not support_x:
        raise SystemExit("cannot find the unit ground support")
    return (min(support_x) + max(support_x)) / 2, bottom


def common_scale(cells: list[Image.Image]) -> float:
    boxes = [visible_bbox(cell) for cell in cells]
    max_width = max(box[2] - box[0] for box in boxes)
    max_height = max(box[3] - box[1] for box in boxes)
    return min(
        (FRAME_SIZE[0] - PADDING * 2) / max_width,
        (FRAME_SIZE[1] - PADDING * 2) / max_height,
    )


def normalize_cell(cell: Image.Image, scale: float) -> Image.Image:
    bbox = visible_bbox(cell)
    support_x, support_y = support_point(cell, bbox)
    resized = cell.resize(
        (round(cell.width * scale), round(cell.height * scale)),
        Image.Resampling.LANCZOS,
    )
    normalized = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    offset = (
        round(ROOT_POINT[0] - support_x * scale),
        round(ROOT_POINT[1] - support_y * scale),
    )
    normalized.alpha_composite(resized, offset)
    return normalized


def root_anchor(frame: Image.Image) -> tuple[float, float]:
    bbox = visible_bbox(frame)
    support_x, support_y = support_point(frame, bbox)
    return round(support_x / frame.width, 4), round(support_y / frame.height, 4)


def load_state_cells(state: str) -> list[Image.Image]:
    return split_cells(Image.open(STATES[state]).convert("RGBA"))


def process_state(
    state: str,
    cells: list[Image.Image],
    scale: float,
) -> list[tuple[float, float]]:
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)
    for old_frame in output.glob("frame*.png"):
        old_frame.unlink()

    anchors = []
    for index, cell in enumerate(cells):
        frame = normalize_cell(cell, scale)
        frame.save(output / f"frame{index}.png", optimize=True, compress_level=9)
        anchors.append(root_anchor(frame))
    return anchors


def validate_frames() -> None:
    for state in STATES:
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for frame_path in frames:
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != FRAME_SIZE:
                raise SystemExit(f"unexpected dimensions in {frame_path}: {frame.size}")
            alpha = frame.getchannel("A")
            if not alpha.getbbox():
                raise SystemExit(f"empty frame: {frame_path}")
            if any(alpha.getpixel(point) != 0 for point in ((0, 0), (383, 0), (0, 255), (383, 255))):
                raise SystemExit(f"opaque corner in {frame_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Artilheira de Morteiro sprite sheets.")
    parser.add_argument("--state", choices=("idle", "attack", "both"), default="both")
    args = parser.parse_args()
    selected = STATES if args.state == "both" else (args.state,)
    cells_by_state = {state: load_state_cells(state) for state in STATES}
    shared_scale = common_scale([
        cell
        for state_cells in cells_by_state.values()
        for cell in state_cells
    ])
    anchors_by_state = {
        state: process_state(state, cells_by_state[state], shared_scale)
        for state in selected
    }
    validate_frames()
    print(f"Artilheira de Morteiro sprites written to {TARGET}")
    print(f"shared scale: {shared_scale:.6f}")
    for state, anchors in anchors_by_state.items():
        print(f"{state} anchors: {anchors}")
