from pathlib import Path
from PIL import Image

root=Path('src/game/assets/convoy/tr7r_peregrino'); out=Path('.codex-tmp/convoy3d/tr7r_peregrino'); out.mkdir(parents=True,exist_ok=True)
for state in ('idle','run','destroyed_transition','destroyed_loop'):
    ims=[Image.open(p).convert('RGBA').resize((224,112),Image.Resampling.LANCZOS) for p in sorted((root/state).glob('*.webp'))]
    sheet=Image.new('RGBA',(224*len(ims),112),(18,25,28,255))
    for i,im in enumerate(ims): sheet.alpha_composite(im,(i*224,0))
    sheet.save(out/f'{state}_sheet.png')
