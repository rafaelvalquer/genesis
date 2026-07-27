from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "game" / "assets" / "enemy" / "gorjal"
OUT = ROOT / "artifacts" / "gorjal"
STATES = (
    "idle", "walking", "attack", "chargePrep", "charge",
    "chargeImpact", "recover", "stunned", "death",
)
DURATIONS = {
    "idle": 170,
    "walking": 105,
    "attack": 95,
    "chargePrep": 100,
    "charge": 55,
    "chargeImpact": 33,
    "recover": 188,
    "stunned": 105,
    "death": 100,
}


def load_frames(state):
    return [Image.open(ASSETS / state / f"frame{index}.png").convert("RGBA") for index in range(8)]


def save_gif(name, sequence, durations):
    sequence[0].save(
        OUT / name,
        save_all=True,
        append_images=sequence[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=True,
        transparency=0,
    )


OUT.mkdir(parents=True, exist_ok=True)
frames = {state: load_frames(state) for state in STATES}
for state in STATES:
    save_gif(f"gorjal-{state}.gif", frames[state], [DURATIONS[state]] * 8)

charge_sequence = (
    frames["walking"] + frames["chargePrep"] + frames["charge"]
    + frames["chargeImpact"] + frames["recover"] + frames["walking"]
)
charge_durations = (
    [105] * 8 + [100] * 8 + [55] * 8
    + [33] * 8 + [188] * 8 + [105] * 8
)
save_gif("gorjal-full-charge-sequence.gif", charge_sequence, charge_durations)
save_gif(
    "gorjal-idle-attack-idle.gif",
    frames["idle"] + frames["attack"] + frames["idle"],
    [170] * 8 + [95] * 8 + [170] * 8,
)

after = frames["idle"][0]
after.save(OUT / "gorjal-after.png")
before = Image.open(OUT / "gorjal-before.png").convert("RGBA")
comparison = Image.new("RGBA", (672, 320), "#07111f")
draw = ImageDraw.Draw(comparison)
draw.text((16, 14), "ANTES", fill="#93c5fd")
draw.text((352, 14), "DEPOIS", fill="#67e8f9")
comparison.alpha_composite(before, (8, 48))
comparison.alpha_composite(after, (344, 48))
comparison.save(OUT / "gorjal-before-after.png")

overview = Image.new("RGBA", (8 * 160, 9 * 144), "#07111f")
overview_draw = ImageDraw.Draw(overview)
for row, state in enumerate(STATES):
    overview_draw.text((6, row * 144 + 4), state, fill="#dbeafe")
    for column, frame in enumerate(frames[state]):
        preview = frame.resize((152, 122), Image.Resampling.LANCZOS)
        overview.alpha_composite(preview, (column * 160 + 4, row * 144 + 18))
overview.save(OUT / "gorjal-processed-overview.png")
