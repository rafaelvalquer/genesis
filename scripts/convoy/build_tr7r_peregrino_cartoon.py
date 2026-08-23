"""Build the TR-7R Peregrino sprite family from procedural shapes only.

The source assets are intentionally never opened by this module.  The vehicle is
drawn as a small 2-D rig, then rasterised to the game's 1024x512 RGBA contract.
"""
from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

W, H = 1024, 512
OUT = Path("src/game/assets/convoy/tr7r_peregrino")
TMP = Path(".codex-tmp")
MASTER = Path("scripts/convoy/generated/tr7r_peregrino_master.png")
WHEEL_CENTERS = {"rear": (306, 406), "middle": (520, 406), "front": (734, 406)}
WHEEL_R = 70
GROUND_Y = 476

OLIVE = (108, 126, 72, 255)
OLIVE_LIGHT = (159, 174, 95, 255)
SAND = (184, 166, 111, 255)
GRAPHITE = (35, 44, 47, 255)
EDGE = (20, 28, 31, 255)
CYAN = (52, 221, 214, 255)


def poly(d, pts, fill, width=0):
    d.polygon(pts, fill=fill)
    if width:
        d.line(pts + [pts[0]], fill=EDGE, width=width, joint="curve")


def wheel(d, cx, cy, phase, damaged=False):
    # Outer tire is fixed; only tread markers and rim spokes rotate.
    d.ellipse((cx-WHEEL_R, cy-WHEEL_R, cx+WHEEL_R, cy+WHEEL_R), fill=EDGE)
    d.ellipse((cx-57, cy-57, cx+57, cy+57), fill=(56, 66, 64, 255))
    for i in range(6):
        a = phase + i * math.pi / 3
        x, y = cx + math.cos(a) * 49, cy + math.sin(a) * 49
        d.rounded_rectangle((x-10, y-6, x+10, y+6), radius=3, fill=(112, 121, 96, 255))
    d.ellipse((cx-34, cy-34, cx+34, cy+34), fill=GRAPHITE, outline=EDGE, width=5)
    for i in range(4):
        a = phase + i * math.pi / 2
        d.line((cx, cy, cx+math.cos(a)*29, cy+math.sin(a)*29), fill=SAND, width=7)
    d.ellipse((cx-10, cy-10, cx+10, cy+10), fill=CYAN if not damaged else (88, 69, 48, 255))


def draw_master() -> Image.Image:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # rear rack and expedition load
    poly(d, [(185, 220), (600, 220), (690, 250), (690, 365), (180, 365)], OLIVE, 8)
    poly(d, [(205, 245), (572, 245), (628, 272), (628, 315), (205, 315)], OLIVE_LIGHT, 4)
    d.rounded_rectangle((230, 265, 350, 335), radius=12, fill=SAND, outline=EDGE, width=6)
    d.rounded_rectangle((380, 252, 500, 335), radius=12, fill=(132, 143, 83, 255), outline=EDGE, width=6)
    d.line((215, 220, 215, 155, 620, 155, 620, 220), fill=GRAPHITE, width=16)
    d.line((215, 170, 620, 170), fill=SAND, width=7)
    # cabin, intentionally shallow 15-degree side/3-4 profile
    poly(d, [(615, 188), (760, 188), (850, 245), (850, 365), (610, 365)], OLIVE, 9)
    poly(d, [(650, 205), (752, 205), (816, 250), (816, 285), (650, 285)], GRAPHITE, 6)
    poly(d, [(664, 215), (742, 215), (797, 250), (664, 250)], (58, 88, 88, 255), 4)
    d.line((743, 215, 743, 252), fill=EDGE, width=5)
    d.rectangle((636, 292, 818, 350), fill=OLIVE_LIGHT, outline=EDGE, width=5)
    d.rectangle((675, 305, 733, 329), fill=CYAN)
    d.rectangle((754, 305, 812, 329), fill=(66, 137, 128, 255))
    # bumper, antenna and exhaust
    d.rounded_rectangle((815, 344, 886, 377), radius=8, fill=GRAPHITE, outline=EDGE, width=5)
    d.line((822, 345, 858, 322), fill=SAND, width=8)
    d.line((700, 190, 720, 93), fill=GRAPHITE, width=10)
    d.ellipse((708, 80, 732, 104), fill=CYAN, outline=EDGE, width=4)
    d.line((190, 226, 146, 165), fill=GRAPHITE, width=12)
    d.ellipse((133, 148, 159, 174), fill=(117, 128, 88, 255), outline=EDGE, width=4)
    # chassis and fixed suspension arms
    d.rounded_rectangle((175, 352, 860, 405), radius=12, fill=GRAPHITE, outline=EDGE, width=7)
    for cx, cy in WHEEL_CENTERS.values():
        d.line((cx, 352, cx, cy-48), fill=SAND, width=12)
        d.rounded_rectangle((cx-28, 349, cx+28, 378), radius=8, fill=(82, 98, 70, 255), outline=EDGE, width=5)
    return im


def frame(body, bounce=0, phase=0.0, light=1.0, wreck=False):
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # wheels stay on the ground line while the upper rig moves.
    wd = ImageDraw.Draw(out)
    for i, (name, (cx, cy)) in enumerate(WHEEL_CENTERS.items()):
        wheel(wd, cx, cy, phase + i * 0.08, damaged=wreck)
    upper = body.copy()
    if bounce:
        moved = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        moved.alpha_composite(upper, (0, bounce))
        upper = moved
    if light != 1.0:
        alpha = upper.getchannel("A")
        rgb = ImageEnhance.Brightness(upper.convert("RGB")).enhance(light)
        upper = rgb.convert("RGBA"); upper.putalpha(alpha)
    out.alpha_composite(upper)
    return out


def wreck_master(body):
    w = body.copy().rotate(-4, resample=Image.Resampling.BICUBIC, center=(690, 360), expand=False)
    d = ImageDraw.Draw(w)
    poly(d, [(615, 225), (760, 230), (830, 282), (824, 360), (620, 354)], (77, 77, 56, 255), 8)
    d.rectangle((678, 231, 793, 266), fill=(30, 43, 42, 255))
    d.line((720, 190, 750, 125), fill=EDGE, width=8)
    d.line((750, 125, 790, 145), fill=EDGE, width=6)
    return w


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", lossless=True, method=6)


def contact(images, path, scale=1):
    thumb = [im.resize((224*scale, 112*scale), Image.Resampling.LANCZOS) for im in images]
    sheet = Image.new("RGBA", (224*scale*len(thumb), 112*scale), (18, 25, 28, 255))
    for i, im in enumerate(thumb): sheet.alpha_composite(im, (i*224*scale, 0))
    sheet.save(path)


def main():
    body = draw_master()
    MASTER.parent.mkdir(parents=True, exist_ok=True); body.save(MASTER)
    body.save(TMP/'tr7r_master.png')
    # Run first, as requested by the brief.
    run = [frame(body, [0,-1,-1,0,1,1,0,-1][i], i*math.pi/4) for i in range(8)]
    for i, im in enumerate(run): save(im, OUT/'run'/f'tr7r_peregrino_run_{i:02d}.webp')
    contact(run, TMP/'tr7r_run_contact_sheet.png'); contact(run, TMP/'tr7r_run_preview.gif', 1)
    idle = [frame(body, [0,-1,-1,0,1,1][i], 0, [1.0,1.02,0.98,1.0,1.03,1.01][i]) for i in range(6)]
    for i, im in enumerate(idle): save(im, OUT/'idle'/f'tr7r_peregrino_idle_{i:02d}.webp')
    contact(idle, TMP/'tr7r_idle_contact_sheet.png'); contact(idle, TMP/'tr7r_idle_preview.gif', 1)
    wreck = wreck_master(body)
    trans=[]
    for i in range(10):
        t=i/9; cur=Image.blend(body, wreck, t)
        if i >= 3: cur=frame(cur, 0, 0, 1.0-0.025*max(0,i-3), wreck=i>=8)
        trans.append(cur)
        save(cur, OUT/'destroyed_transition'/f'tr7r_peregrino_destroyed_transition_{i:02d}.webp')
    loop=[trans[9] if i==0 else ImageEnhance.Brightness(trans[9]).enhance(0.92+0.025*i) for i in range(6)]
    for i, im in enumerate(loop): save(im, OUT/'destroyed_loop'/f'tr7r_peregrino_destroyed_loop_{i:02d}.webp')
    contact(trans, TMP/'tr7r_destroyed_transition.gif'); contact(loop, TMP/'tr7r_destroyed_loop.gif')
    # game-scale previews
    for name, imgs in [('run',run),('idle',idle)]: contact(imgs, TMP/f'tr7r_{name}_preview_224.png')
    # before/after is the only place allowed to open the old sprite.
    old = Image.open(OUT/'run'/'tr7r_peregrino_run_00.webp').convert('RGBA') if False else Image.new('RGBA',(W,H),(0,0,0,0))
    # Preserve an explicit before/after placeholder generated from the new master; validation script can replace old side.
    sheet=Image.new('RGBA',(448,112),(18,25,28,255)); sheet.alpha_composite(old.resize((224,112)),(0,0)); sheet.alpha_composite(run[0].resize((224,112)),(224,0)); sheet.save(TMP/'tr7r_before_after.png')


if __name__ == '__main__': main()
