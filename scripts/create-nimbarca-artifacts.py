from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "game" / "assets" / "enemy" / "nimbarca"
OUT = ROOT / "artifacts" / "nimbarca"
STATES = ("flying", "attack", "shieldPulse", "death")
DURATIONS = {"flying": 120, "attack": 98, "shieldPulse": 88, "death": 100}


def frames(state):
    return [Image.open(ASSETS / state / f"frame{index}.png").convert("RGBA") for index in range(8)]


def save_gif(name, sequence, durations, loop=0):
    sequence[0].save(
        OUT / name,
        save_all=True,
        append_images=sequence[1:],
        duration=durations,
        loop=loop,
        disposal=2,
        optimize=True,
        transparency=0,
    )


OUT.mkdir(parents=True, exist_ok=True)
state_frames = {state: frames(state) for state in STATES}
for state in STATES:
    save_gif(
        f"nimbarca-{state}.gif",
        state_frames[state],
        [DURATIONS[state]] * 8,
    )

save_gif(
    "nimbarca-flying-attack-flying.gif",
    state_frames["flying"] + state_frames["attack"] + state_frames["flying"],
    [120] * 8 + [98] * 8 + [120] * 8,
)
save_gif(
    "nimbarca-flying-shieldPulse-flying.gif",
    state_frames["flying"] + state_frames["shieldPulse"] + state_frames["flying"],
    [120] * 8 + [88] * 8 + [120] * 8,
)

after = state_frames["flying"][0]
after.save(OUT / "nimbarca-after.png")
before = Image.open(OUT / "nimbarca-before.png").convert("RGBA")
comparison = Image.new("RGBA", (832, 448), "#07111f")
draw = ImageDraw.Draw(comparison)
draw.text((20, 18), "ANTES", fill="#93c5fd")
draw.text((436, 18), "DEPOIS", fill="#67e8f9")
comparison.alpha_composite(before, (16, 48))
comparison.alpha_composite(after, (432, 48))
comparison.save(OUT / "nimbarca-before-after.png")

overview = Image.new("RGBA", (8 * 192, 4 * 192), "#07111f")
overview_draw = ImageDraw.Draw(overview)
for row, state in enumerate(STATES):
    overview_draw.text((8, row * 192 + 6), state, fill="#dbeafe")
    for column, frame in enumerate(state_frames[state]):
        preview = frame.resize((176, 176), Image.Resampling.LANCZOS)
        overview.alpha_composite(preview, (column * 192 + 8, row * 192 + 12))
overview.save(OUT / "nimbarca-processed-overview.png")
