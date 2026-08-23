from pathlib import Path
from PIL import Image

src=Path('tmp/convoy3d/tr7r_peregrino'); root=Path('src/game/assets/convoy/tr7r_peregrino')
for state in ('idle','run','destroyed_transition','destroyed_loop'):
    dst=root/state; dst.mkdir(parents=True,exist_ok=True)
    for p in sorted(src.glob(f'{state}_*.png')):
        im=Image.open(p).convert('RGBA')
        index=p.stem.rsplit('_',1)[1]
        im.save(dst/f'tr7r_peregrino_{state}_{index}.webp','WEBP',lossless=True,method=6)
