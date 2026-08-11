from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sources = {"idle": ROOT / "tmp/imagegen/ares-idle.png", "attack": ROOT / "tmp/imagegen/ares-attack.png", "death": ROOT / "tmp/imagegen/ares-death.png"}
out_root = ROOT / "src/game/assets/troop/aresT"

for state, source in sources.items():
    image = Image.open(source).convert("RGBA")
    frame_w, frame_h = image.width // 4, image.height // 2
    target = out_root / state
    target.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        col, row = index % 4, index // 4
        frame = image.crop((col * frame_w, row * frame_h, (col + 1) * frame_w, (row + 1) * frame_h))
        frame.save(target / f"frame{index}.png")
    print(state, frame_w, frame_h)
