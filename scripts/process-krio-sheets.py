import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "art" / "spritesheets" / "krio"
TARGET = ROOT / "src" / "game" / "assets" / "troop" / "krio"
FRAME_SIZE = 256
NORMALIZED_SIZE = 400
ROOT_X = 200
ROOT_Y = 370
STATE_SCALE = {"idle": 0.75, "attack": 0.98}
STATE_ROOT_X = {"idle": ROOT_X, "attack": 165}


def retain_subject_and_effects(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    visible = {(x, y) for y in range(frame.height) for x in range(frame.width) if alpha.getpixel((x, y)) > 0}
    components = []
    while visible:
        start = visible.pop()
        component = {start}
        pending = [start]
        while pending:
            x, y = pending.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in visible:
                    visible.remove(neighbor)
                    component.add(neighbor)
                    pending.append(neighbor)
        components.append(component)

    if not components:
        raise SystemExit("empty sprite cell")
    subject = max(components, key=len)
    minimum_effect_size = max(64, len(subject) // 500)
    retained = set().union(*(component for component in components if component is subject or len(component) >= minimum_effect_size))
    cleaned = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    source = frame.load()
    target = cleaned.load()
    for x, y in retained:
        target[x, y] = source[x, y]
    return cleaned


def support_point(frame: Image.Image) -> tuple[float, int]:
    alpha = frame.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
    if not bbox:
        raise SystemExit("cannot calculate an anchor for an empty frame")

    bottom = bbox[3] - 1
    support_x = []
    for y in range(max(bbox[1], bottom - 14), bottom + 1):
        for x in range(bbox[0], bbox[2]):
            if alpha.getpixel((x, y)) >= 128:
                support_x.append(x)
    if not support_x:
        raise SystemExit("cannot find the character's ground support")
    return (min(support_x) + max(support_x)) / 2, bottom


def normalize_cell(cell: Image.Image, state: str) -> Image.Image:
    subject = retain_subject_and_effects(cell)
    source_scale = STATE_SCALE[state]
    subject = subject.resize(
        (round(subject.width * source_scale), round(subject.height * source_scale)),
        Image.Resampling.LANCZOS,
    )
    root_x, root_y = support_point(subject)
    normalized = Image.new("RGBA", (NORMALIZED_SIZE, NORMALIZED_SIZE), (0, 0, 0, 0))
    normalized.alpha_composite(subject, (round(STATE_ROOT_X[state] - root_x), ROOT_Y - root_y))
    return normalized


def root_anchor(frame: Image.Image) -> tuple[float, float]:
    root_x, bottom = support_point(frame)
    return round(root_x / FRAME_SIZE, 4), round(bottom / FRAME_SIZE, 4)


def split_sheet(source: Path, state: str) -> list[tuple[float, float]]:
    sheet = Image.open(source).convert("RGBA")
    output = TARGET / state
    output.mkdir(parents=True, exist_ok=True)
    for old_frame in output.glob("frame*.png"):
        old_frame.unlink()

    anchors = []
    for index in range(8):
        column = index % 4
        row = index // 4
        left = round(column * sheet.width / 4)
        right = round((column + 1) * sheet.width / 4)
        top = round(row * sheet.height / 2)
        bottom = round((row + 1) * sheet.height / 2)
        cell = sheet.crop((left, top, right, bottom))
        frame = normalize_cell(cell, state).resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
        frame.save(output / f"frame{index}.png", optimize=True, compress_level=9)
        anchors.append(root_anchor(frame))
    return anchors


def validate_frames() -> None:
    for state in ("idle", "attack"):
        frames = sorted((TARGET / state).glob("frame*.png"))
        if len(frames) != 8:
            raise SystemExit(f"expected 8 {state} frames, found {len(frames)}")
        for frame_path in frames:
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (FRAME_SIZE, FRAME_SIZE):
                raise SystemExit(f"unexpected dimensions in {frame_path}: {frame.size}")
            alpha = frame.getchannel("A")
            if any(alpha.getpixel(point) != 0 for point in ((0, 0), (255, 0), (0, 255), (255, 255))):
                raise SystemExit(f"opaque corner in {frame_path}")
            if not alpha.getbbox():
                raise SystemExit(f"empty frame: {frame_path}")


def write_preview() -> None:
    preview = Image.new("RGBA", (FRAME_SIZE * 8, FRAME_SIZE * 2), (15, 23, 42, 255))
    for row, state in enumerate(("idle", "attack")):
        for index in range(8):
            frame = Image.open(TARGET / state / f"frame{index}.png").convert("RGBA")
            preview.alpha_composite(frame, (index * FRAME_SIZE, row * FRAME_SIZE))
    preview.save(SHEETS / "krio-preview.png", optimize=True, compress_level=9)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Krio sprite sheets.")
    parser.add_argument("--state", choices=("idle", "attack", "both"), default="both")
    args = parser.parse_args()

    anchors = {}
    if args.state in ("idle", "both"):
        anchors["idle"] = split_sheet(SHEETS / "krio-idle.png", "idle")
    if args.state in ("attack", "both"):
        anchors["attack"] = split_sheet(SHEETS / "krio-attack.png", "attack")
    validate_frames()
    write_preview()
    print(f"Krio sprites written to {TARGET}")
    for state, state_anchors in anchors.items():
        print(f"{state} anchors: {state_anchors}")
