from pathlib import Path
from PIL import Image

root=Path('src/game/assets/convoy/tr7r_peregrino'); expected={'idle':6,'run':8,'destroyed_transition':10,'destroyed_loop':6}
for state,n in expected.items():
    files=sorted((root/state).glob('*.webp')); assert len(files)==n,(state,len(files))
    sizes=set();
    for p in files:
        im=Image.open(p); assert im.mode=='RGBA'; sizes.add(im.size)
        assert all(im.getpixel(c)[3]==0 for c in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)])
    assert sizes=={(1024,512)}, (state,sizes)
print('convoy3d validation passed')
