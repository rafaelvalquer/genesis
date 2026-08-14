from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "tmp" / "imagegen" / "mantis-sheet-alpha.png"
art_root = ROOT / "art" / "sprites" / "mantis"
runtime_root = ROOT / "src" / "game" / "assets" / "troop" / "mantis"
states = ["idle", "targetLock", "attackBurst", "reload", "paralyzed", "death"]
sheet = Image.open(source).convert("RGBA")
width, height = sheet.size
assert width >= 8 and height >= 6
final_sheet = Image.new("RGBA", (384 * 8, 384 * 6), (0, 0, 0, 0))
for row, state in enumerate(states):
    (art_root / state).mkdir(parents=True, exist_ok=True)
    (runtime_root / state).mkdir(parents=True, exist_ok=True)
    y0 = round(row * height / 6)
    y1 = round((row + 1) * height / 6)
    for col in range(8):
        x0 = round(col * width / 8)
        x1 = round((col + 1) * width / 8)
        inset_x = max(2, round((x1 - x0) * 0.035))
        inset_y = max(2, round((y1 - y0) * 0.025))
        cell = sheet.crop((x0 + inset_x, y0 + inset_y, x1 - inset_x, y1 - inset_y))
        # Preserve the generated silhouette while providing a stable 384px baseline.
        bbox = cell.getbbox()
        canvas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        if bbox:
            subject = cell.crop(bbox)
            scale = min(350 / subject.width, 350 / subject.height)
            subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.Resampling.LANCZOS)
            left = (384 - subject.width) // 2
            top = max(8, 360 - subject.height)
            canvas.alpha_composite(subject, (left, top))
        for root in (art_root, runtime_root):
            canvas.save(root / state / f"frame{col}.png", optimize=True)
        final_sheet.alpha_composite(canvas, (col * 384, row * 384))
final_sheet.save(ROOT / "art" / "spritesheets" / "mantis" / "mantis-6x8.png", optimize=True)
print(f"Processed {len(states) * 8} MANTIS frames from {sheet.size[0]}x{sheet.size[1]} sheet")
