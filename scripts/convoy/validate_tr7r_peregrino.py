"""Regression checks for the procedural Peregrino sprite rig."""
from pathlib import Path
from PIL import Image, ImageChops
from build_tr7r_peregrino_cartoon import W, H, OUT, WHEEL_CENTERS, WHEEL_R

EXPECTED = {"idle": 6, "run": 8, "destroyed_transition": 10, "destroyed_loop": 6}

def main():
    all_frames = {}
    for state, count in EXPECTED.items():
        frames = sorted((OUT/state).glob("*.webp"))
        assert len(frames) == count, (state, len(frames))
        imgs=[]
        for p in frames:
            im=Image.open(p).convert("RGBA")
            assert im.size==(W,H) and all(im.getpixel(c)[3]==0 for c in ((0,0),(W-1,0),(0,H-1),(W-1,H-1))), p
            assert im.getbbox() is not None and im.getbbox()[0] > 20 and im.getbbox()[2] < W-20, p
            imgs.append(im)
        all_frames[state]=imgs
    assert any(ImageChops.difference(all_frames['run'][0], x).getbbox() for x in all_frames['run'][1:])
    assert any(ImageChops.difference(all_frames['idle'][0], x).getbbox() for x in all_frames['idle'][1:])
    assert ImageChops.difference(all_frames['destroyed_transition'][9], all_frames['destroyed_loop'][0]).getbbox() is None
    # Wheel silhouettes are fixed; every run frame must change pixels inside each wheel.
    for name,(cx,cy) in WHEEL_CENTERS.items():
        box=(cx-WHEEL_R,cy-WHEEL_R,cx+WHEEL_R+1,cy+WHEEL_R+1)
        base=all_frames['run'][0].crop(box).convert('RGB')
        for im in all_frames['run'][1:]:
            cur=im.crop(box).convert('RGB'); assert ImageChops.difference(base,cur).getbbox() is not None, name
    print('TR-7R Peregrino validation passed: 30 RGBA frames, fixed wheel pivots, alpha corners, loops.')

if __name__ == '__main__': main()
