from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "src/game/assets/troop/aresT/attack"
target_bottom_y = 476

for path in sorted(root.glob("frame*.png")):
    image = Image.open(path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        continue
    dy = target_bottom_y - bbox[3]
    aligned = Image.new("RGBA", image.size, (0, 0, 0, 0))
    aligned.alpha_composite(image, (0, dy))
    aligned.save(path)
    print(path.name, "vertical shift", dy)
