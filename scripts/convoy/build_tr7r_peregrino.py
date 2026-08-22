"""Rebuild all TR-7R Peregrino animation states from one stable master."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src/game/assets/convoy/tr7r_peregrino"
MASTER_PATH = ASSETS / "idle/tr7r_peregrino_idle_00.webp"
WRECK_PATH = Path(__file__).with_name("tr7r_peregrino_wreck_master.png")
ANGLES = (0, 45, 90, 135, 180, 225, 270, 315)
WHEELS = ((305, 348, 68, 70), (493, 350, 68, 70), (696, 350, 68, 70))


def clean_matte(image):
    image = image.convert("RGBA")
    px = image.load()
    dark = {(x, y) for x in range(image.width) for y in range(image.height)
            if px[x, y][3] and max(px[x, y][:3]) < 42}
    while dark:
        seed = dark.pop(); component = [seed]; stack = [seed]
        while stack:
            x, y = stack.pop()
            for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if n in dark:
                    dark.remove(n); stack.append(n); component.append(n)
        xs = [p[0] for p in component]; ys = [p[1] for p in component]
        if max(ys) - min(ys) > 260 and max(xs) - min(xs) < 48:
            for x, y in component: px[x, y] = (*px[x, y][:3], 0)
    # The source master carries two detached matte strips at fixed canvas edges.
    for x0, x1 in ((87, 238), (785, 937)):
        for x in range(x0, x1):
            for y in range(64, 436):
                if max(px[x, y][:3]) < 32: px[x, y] = (*px[x, y][:3], 0)
    image.putalpha(image.getchannel("A").point(lambda a: 0 if a < 8 else a))
    return image


def export(image, folder, stem, index):
    image.save(ASSETS / folder / f"tr7r_peregrino_{stem}_{index:02d}.webp", "WEBP", lossless=True, method=6)


def build():
    master = clean_matte(Image.open(MASTER_PATH))
    if master.size != (1024, 512): raise ValueError(master.size)
    # Idle: fixed wheels and chassis, only subtle cyan emitter pulse.
    for index, pulse in enumerate((-8, 0, 10, 16, 5, -3)):
        image = master.copy(); px = image.load()
        for y in range(55, 290):
            for x in range(70, 950):
                r, g, b, a = px[x, y]
                if a and g > 100 and b > 120 and b >= g and r < 120:
                    px[x, y] = (r, max(0, min(255, g + pulse)), max(0, min(255, b + pulse)), a)
        export(image, "idle", "idle", index)
    # Run: rotate only the three wheel masks around their stable centers.
    for index, angle in enumerate(ANGLES):
        image = master.copy()
        for cx, cy, rx, ry in WHEELS:
            box = (cx - rx - 5, cy - ry - 5, cx + rx + 6, cy + ry + 6)
            patch = master.crop(box).rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
            mask = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0)
            ImageDraw.Draw(mask).ellipse((5, 5, mask.width - 6, mask.height - 6), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(1.2))
            image.paste(patch, box, mask)
        export(image, "run", "run", index)
    # Normalize the generated wreck to the exact vehicle canvas.
    wreck = Image.open(WRECK_PATH).convert("RGBA"); wreck.thumbnail((980, 490), Image.Resampling.LANCZOS)
    wreck_canvas = Image.new("RGBA", (1024, 512)); wreck_canvas.alpha_composite(wreck, ((1024 - wreck.width) // 2, (512 - wreck.height) // 2)); wreck = clean_matte(wreck_canvas)
    # Match the master silhouette bounds so destruction never jumps in scale or pivot.
    master_box = master.getchannel("A").getbbox(); wreck_box = wreck.getchannel("A").getbbox()
    wreck_crop = wreck.crop(wreck_box).resize((master_box[2] - master_box[0], master_box[3] - master_box[1]), Image.Resampling.LANCZOS)
    wreck = Image.new("RGBA", (1024, 512)); wreck.alpha_composite(wreck_crop, (master_box[0], master_box[1]))
    # Transition is a real visual progression from intact to the wreck master.
    for index in range(10):
        t = index / 9
        frame = Image.blend(master, wreck, t)
        if index < 3: frame = ImageEnhance.Brightness(frame).enhance(1 - index * .04)
        export(frame, "destroyed_transition", "destroyed_transition", index)
    # Stable wreck loop with only residual internal glow variation.
    for index, gain in enumerate((.88, .94, 1.0, 1.04, .96, .9)):
        export(ImageEnhance.Brightness(wreck).enhance(gain), "destroyed_loop", "destroyed_loop", index)
    # Enforce the critical transition seam byte-for-byte.
    (ASSETS / "destroyed_loop/tr7r_peregrino_destroyed_loop_00.webp").write_bytes((ASSETS / "destroyed_transition/tr7r_peregrino_destroyed_transition_09.webp").read_bytes())


if __name__ == "__main__": build()
