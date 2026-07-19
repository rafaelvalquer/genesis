from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "colossoImpacto"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "colossoImpacto"
FRAME_SIZE = (256, 256)
ROOT_POINT = (128, 248)
PADDING = 8
STATES = {
    "idle": SHEETS / "colosso-impacto-idle.png",
    "attack": SHEETS / "colosso-impacto-attack.png",
    "special": SHEETS / "colosso-impacto-special-v2.png",
}


def split_cells(sheet: Image.Image) -> list[Image.Image]:
    return [
        sheet.crop((
            round((index % 4) * sheet.width / 4),
            round((index // 4) * sheet.height / 2),
            round(((index % 4) + 1) * sheet.width / 4),
            round(((index // 4) + 1) * sheet.height / 2),
        ))
        for index in range(8)
    ]


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


def common_scale(cells: list[Image.Image]) -> float:
    boxes = [visible_bbox(cell) for cell in cells]
    return min(
        (FRAME_SIZE[0] - PADDING * 2) / max(box[2] - box[0] for box in boxes),
        (FRAME_SIZE[1] - PADDING * 2) / max(box[3] - box[1] for box in boxes),
    )


def normalize_cell(cell: Image.Image, scale: float) -> Image.Image:
    bbox = visible_bbox(cell)
    support_x, support_y = support_point(cell, bbox)
    resized = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    frame.alpha_composite(resized, (round(ROOT_POINT[0] - support_x * scale), round(ROOT_POINT[1] - support_y * scale)))
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
    scale = common_scale([cell for cells in cells_by_state.values() for cell in cells])
    anchors = {}
    for state, cells in cells_by_state.items():
        output = TARGET / state
        output.mkdir(parents=True, exist_ok=True)
        for old_frame in output.glob("frame*.png"):
            old_frame.unlink()
        anchors[state] = []
        for index, cell in enumerate(cells):
            frame = normalize_cell(cell, scale)
            frame.save(output / f"frame{index}.png", optimize=True, compress_level=9)
            anchors[state].append(root_anchor(frame))
    validate()
    print(f"Colosso de Impacto sprites written to {TARGET}")
    print(f"shared scale: {scale:.6f}")
    for state, state_anchors in anchors.items():
        print(f"{state} anchors: {state_anchors}")
