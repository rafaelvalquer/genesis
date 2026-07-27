from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "game" / "assets" / "enemy" / "derivante"
OUT = ROOT / "artifacts" / "derivante"
STATES = (
    "idle", "walking", "attack", "jumpPrepare", "jumpTakeoff",
    "jumping", "landing", "windGlide", "stunned", "death",
)
DURATIONS = {
    "idle": 125,
    "walking": 75,
    "attack": 54,
    "jumpPrepare": 53,
    "jumpTakeoff": 23,
    "jumping": 78,
    "landing": 40,
    "windGlide": 113,
    "stunned": 105,
    "death": 100,
}


def load_frames(state):
    return [
        Image.open(ASSETS / state / f"frame{index}.png").convert("RGBA")
        for index in range(8)
    ]


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


def route_demo(frames):
    canvases = []
    source_y = 308
    target_y = 180
    for index, sprite in enumerate(frames):
        progress = index / 7
        eased = progress * progress * (3 - 2 * progress)
        route_y = source_y + (target_y - source_y) * eased
        arc = 70 * 4 * progress * (1 - progress)
        canvas = Image.new("RGBA", (640, 420), "#07111f")
        draw = ImageDraw.Draw(canvas)
        draw.line((20, source_y, 620, source_y), fill="#164e63", width=3)
        draw.line((20, target_y, 620, target_y), fill="#164e63", width=3)
        draw.text((22, source_y + 8), "ROTA DE ORIGEM", fill="#67e8f9")
        draw.text((22, target_y + 8), "ROTA DE DESTINO", fill="#67e8f9")
        canvas.alpha_composite(sprite, (160, round(route_y - arc - 244)))
        canvases.append(canvas)
    return canvases


def airborne_death_demo(jumping, death):
    canvases = []
    start_y = 152
    ground_y = 300
    for index, sprite in enumerate(jumping[:4]):
        canvas = Image.new("RGBA", (640, 420), "#07111f")
        draw = ImageDraw.Draw(canvas)
        draw.line((20, ground_y, 620, ground_y), fill="#164e63", width=3)
        draw.text((22, ground_y + 8), "ROTA VÁLIDA MAIS PRÓXIMA", fill="#67e8f9")
        canvas.alpha_composite(sprite, (160, start_y - 244))
        canvases.append(canvas)
    for index, sprite in enumerate(death):
        progress = index / 7
        eased = 1 - (1 - progress) ** 3
        y = start_y + (ground_y - start_y) * eased
        canvas = Image.new("RGBA", (640, 420), "#07111f")
        draw = ImageDraw.Draw(canvas)
        draw.line((20, ground_y, 620, ground_y), fill="#164e63", width=3)
        draw.text((22, ground_y + 8), "QUEDA VISUAL; GAMEPLAY JÁ ENCERRADO", fill="#67e8f9")
        canvas.alpha_composite(sprite, (160, round(y - 244)))
        canvases.append(canvas)
    return canvases


OUT.mkdir(parents=True, exist_ok=True)
frames = {state: load_frames(state) for state in STATES}
for state in STATES:
    save_gif(
        f"derivante-{state}.gif",
        frames[state],
        [DURATIONS[state]] * 8,
    )

jump_sequence = (
    frames["walking"] + frames["jumpPrepare"] + frames["jumpTakeoff"]
    + frames["jumping"] + frames["landing"] + frames["walking"]
)
jump_durations = (
    [75] * 8 + [53] * 8 + [23] * 8
    + [78] * 8 + [40] * 8 + [75] * 8
)
save_gif("derivante-full-jump-sequence.gif", jump_sequence, jump_durations)

wind_sequence = (
    frames["walking"] + frames["windGlide"] + frames["landing"] + frames["walking"]
)
wind_durations = [75] * 8 + [113] * 8 + [40] * 8 + [75] * 8
save_gif("derivante-wind-sequence.gif", wind_sequence, wind_durations)
save_gif(
    "derivante-route-interpolation.gif",
    route_demo(frames["jumping"]),
    [78] * 8,
)
save_gif(
    "derivante-airborne-death.gif",
    airborne_death_demo(frames["jumping"], frames["death"]),
    [78] * 4 + [100] * 8,
)

after = frames["idle"][0]
after.save(OUT / "derivante-after.png")
before = Image.open(OUT / "derivante-before.png").convert("RGBA")
comparison = Image.new("RGBA", (672, 320), "#07111f")
draw = ImageDraw.Draw(comparison)
draw.text((16, 14), "ANTES", fill="#93c5fd")
draw.text((352, 14), "DEPOIS", fill="#67e8f9")
comparison.alpha_composite(before, (8, 48))
comparison.alpha_composite(after, (344, 48))
comparison.save(OUT / "derivante-before-after.png")

overview = Image.new("RGBA", (8 * 160, 10 * 144), "#07111f")
overview_draw = ImageDraw.Draw(overview)
for row, state in enumerate(STATES):
    overview_draw.text((6, row * 144 + 4), state, fill="#dbeafe")
    for column, frame in enumerate(frames[state]):
        preview = frame.resize((152, 122), Image.Resampling.LANCZOS)
        overview.alpha_composite(preview, (column * 160 + 4, row * 144 + 18))
overview.save(OUT / "derivante-processed-overview.png")
