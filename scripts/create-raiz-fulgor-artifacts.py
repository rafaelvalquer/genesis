from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "game" / "assets" / "enemy" / "raizFulgor"
OUT = ROOT / "artifacts" / "raiz-fulgor"
STATES = (
    "idle", "walking", "rooting", "rootedIdle", "attackCharge",
    "attackRelease", "unrooting", "stunned", "death",
)
DURATIONS = {
    "idle": 150, "walking": 105, "rooting": 112, "rootedIdle": 170,
    "attackCharge": 87, "attackRelease": 45, "unrooting": 75,
    "stunned": 105, "death": 100,
}


def load_frames(state):
    return [
        Image.open(ASSETS / state / f"frame{index}.png").convert("RGBA")
        for index in range(8)
    ]


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


def battle_demo(frames, title, beam=False, chain=False, paralyzed=False):
    canvases = []
    for index, sprite in enumerate(frames):
        canvas = Image.new("RGBA", (800, 420), "#07111f")
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((24, 54, 776, 370), outline="#164e63", width=3)
        draw.text((28, 20), title, fill="#dbeafe")
        canvas.alpha_composite(sprite, (410, 110))
        target = (250, 244)
        draw.rectangle((220, 214, 280, 274), fill="#172554", outline="#67e8f9", width=2)
        draw.text((230, 235), "ALVO", fill="#dbeafe")
        if beam and index == 0:
            draw.line((500, 188, target[0], target[1]), fill="#67e8f9", width=7)
            draw.line((500, 188, target[0], target[1]), fill="#ffffff", width=2)
            if chain:
                draw.rectangle((100, 250, 160, 310), fill="#172554", outline="#c084fc", width=2)
                draw.line((target[0], target[1], 130, 280), fill="#c084fc", width=4)
        if paralyzed and index >= 1:
            draw.text((205, 286), "3 CARGAS -> PARALISIA 2000 ms", fill="#facc15")
        canvases.append(canvas)
    return canvases


OUT.mkdir(parents=True, exist_ok=True)
frames = {state: load_frames(state) for state in STATES}
for state in STATES:
    save_gif(
        f"raiz-fulgor-{state}.gif",
        frames[state],
        [DURATIONS[state]] * 8,
    )

root_sequence = frames["walking"] + frames["rooting"] + frames["rootedIdle"]
save_gif(
    "raiz-fulgor-walking-rooting-rootedIdle.gif",
    root_sequence,
    [105] * 8 + [112] * 8 + [170] * 8,
)
attack_sequence = (
    frames["rootedIdle"] + frames["attackCharge"]
    + frames["attackRelease"] + frames["rootedIdle"]
)
save_gif(
    "raiz-fulgor-rooted-attack-cycle.gif",
    attack_sequence,
    [170] * 8 + [87] * 8 + [45] * 8 + [170] * 8,
)
unroot_sequence = frames["rootedIdle"] + frames["unrooting"] + frames["walking"]
save_gif(
    "raiz-fulgor-unrooting-walking.gif",
    unroot_sequence,
    [170] * 8 + [75] * 8 + [105] * 8,
)
save_gif(
    "raiz-fulgor-beam-origin.gif",
    battle_demo(frames["attackRelease"], "ORIGEM: EMISSOR DO FRAME 0", beam=True),
    [120] * 8,
)
save_gif(
    "raiz-fulgor-chain-paralysis.gif",
    battle_demo(
        frames["attackRelease"],
        "ALVO TRAVADO + UMA CADEIA A 50%",
        beam=True,
        chain=True,
        paralyzed=True,
    ),
    [120] * 8,
)
save_gif(
    "raiz-fulgor-rooted-death.gif",
    battle_demo(frames["death"], "MORTE ENRAIZADA SEM TELEPORTE"),
    [100] * 8,
    loop=1,
)

after = frames["idle"][0]
after.save(OUT / "raiz-fulgor-after.png")
before = Image.open(OUT / "raiz-fulgor-before.png").convert("RGBA")
comparison = Image.new("RGBA", (672, 320), "#07111f")
draw = ImageDraw.Draw(comparison)
draw.text((16, 14), "ANTES", fill="#93c5fd")
draw.text((352, 14), "DEPOIS", fill="#67e8f9")
comparison.alpha_composite(before, (8, 48))
comparison.alpha_composite(after, (344, 48))
comparison.save(OUT / "raiz-fulgor-before-after.png")

overview = Image.new("RGBA", (8 * 160, 9 * 144), "#07111f")
overview_draw = ImageDraw.Draw(overview)
for row, state in enumerate(STATES):
    overview_draw.text((6, row * 144 + 4), state, fill="#dbeafe")
    for column, frame in enumerate(frames[state]):
        preview = frame.resize((152, 122), Image.Resampling.LANCZOS)
        overview.alpha_composite(preview, (column * 160 + 4, row * 144 + 18))
overview.save(OUT / "raiz-fulgor-processed-overview.png")
