from pathlib import Path
from PIL import Image, ImageDraw
import math, random
import wave, struct

ROOT=Path('src/game/assets'); W,H=1024,512

def rgba(hexv,a=255):
    h=hexv.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)

def enemy(kind,state,frame):
    im=Image.new('RGBA',(192,192),(0,0,0,0)); d=ImageDraw.Draw(im); phase=frame*math.pi/4
    if kind=='rastejanteMata':
        body=(116,133,56,255); dark=(43,49,29,255); bone=(199,174,123,255); bio=(99,230,214,255)
        y=98 + ([0,-2,-1,0,1,2,1,0][frame] if state!='attack' else [0,2,4,2,0,-1,0,0][frame])
        d.ellipse((22,y-32,170,y+32),fill=dark,outline=bone,width=4); d.ellipse((32,y-26,158,y+24),fill=body)
        headx=145 if state!='attack' else 151 + ([0,0,2,8,14,8,2,0][frame]); d.polygon([(headx-28,y-26),(headx+24,y-19),(headx+32,y+8),(headx+8,y+28),(headx-28,y+14)],fill=body,outline=bone)
        jawopen=state=='attack' and frame in (3,4,5)
        d.line((headx+4,y+8,headx+31,y+18 if not jawopen else y+31),fill=bone,width=7)
        d.ellipse((headx-2,y-12,headx+8,y-2),fill=bio); d.ellipse((headx+14,y-10,headx+24,y),fill=bio)
        for i,x in enumerate((42,77,112,145)):
            lift=math.sin(phase+i)*8 if state=='walking' else 0; d.line((x,y+20,x-8,y+55+lift),fill=dark,width=12); d.line((x-8,y+55+lift,x-20,y+64+lift),fill=bone,width=5)
        d.line((28,y-22,14,y-45+math.sin(phase)*4),fill=bone,width=5)
    else:
        body=(103,89,64,255); wing=(143,99,69,220); dark=(34,37,31,255); bio=(99,230,214,255)
        y=96 + ([0,-2,-1,0,1,2,1,0][frame] if state=='idle' else 0)
        airborne=state in ('jumpAir','rasante'); ay=-20 if airborne else 0
        d.ellipse((32,y-30+ay,154,y+34+ay),fill=dark,outline=(199,174,123,255),width=4); d.ellipse((45,y-25+ay,145,y+26+ay),fill=body)
        d.polygon([(65,y-10+ay),(8,y-58+ay),(18,y-10+ay),(66,y+8+ay)],fill=wing,outline=body)
        d.polygon([(122,y-10+ay),(180,y-58+ay),(172,y-10+ay),(122,y+8+ay)],fill=wing,outline=body)
        hx=145; d.polygon([(hx-22,y-25+ay),(hx+28,y-14+ay),(hx+20,y+18+ay),(hx-24,y+12+ay)],fill=body,outline=(199,174,123,255)); d.ellipse((hx-2,y-10+ay,hx+8,y+0+ay),fill=bio)
        for x in (55,91,125): d.line((x,y+18+ay,x-8,y+48+ay),fill=dark,width=9)
    return im

def build_enemy(kind,states):
    for state,count in states.items():
        out=ROOT/'enemy'/kind/state; out.mkdir(parents=True,exist_ok=True)
        for i in range(count): enemy(kind,state,i).save(out/f'frame{i}.png')

def arena(name,index):
    im=Image.new('RGBA',(W,H),rgba('#171514')); d=ImageDraw.Draw(im); random.seed(7049+index*101)
    d.rectangle((0,250,W,H),fill=rgba('#3a251d')); d.rectangle((0,330,W,H),fill=rgba('#261b17'))
    for _ in range(28+index*8):
        x=random.randrange(W); y=random.randrange(80,H); col=random.choice(['#6f3526','#8b5940','#c65a33'])
        d.polygon([(x,y),(x+random.randrange(20,100),y+random.randrange(-30,30)),(x+random.randrange(30,110),y+random.randrange(20,70))],fill=rgba(col,100+index*10))
    for row in range(5):
        y=80+row*85; d.line((0,y,W,y+random.randrange(-12,13)),fill=rgba('#63e6d6',45+index*8),width=3)
    if index==7:
        d.ellipse((420,20,610,190),fill=rgba('#6f3526',220),outline=rgba('#63e6d6',220),width=8); d.line((515,150,515,360),fill=rgba('#8b5940',220),width=18)
    if index in (3,5):
        for x in range(0,W,110): d.line((x,300,x+70,512),fill=rgba('#c7ae7b',150),width=8)
    im.save(ROOT/'arenas'/name,'WEBP',lossless=True)

def cue(name, frequency, duration=.24):
    out=ROOT/'sfx'/f'c7_{name}.wav'; out.parent.mkdir(parents=True,exist_ok=True)
    rate=22050; frames=int(rate*duration)
    with wave.open(str(out),'wb') as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(rate)
        data=[]
        for i in range(frames):
            envelope=min(1,i/500, (frames-i)/max(1,frames//5)); value=math.sin(2*math.pi*frequency*i/rate)*envelope*.28
            data.append(struct.pack('<h',int(value*32767)))
        stream.writeframes(b''.join(data))

def main():
    build_enemy('rastejanteMata',{'idle':8,'walking':8,'attack':8})
    build_enemy('saltadorAlado',{'idle':8,'walking':8,'attack':8,'jumpPrep':4,'jumpAir':6,'jumpLand':4,'rasante':8})
    arena('chapter_07.webp',7)
    for i in range(8): arena(f'f ase_{49+i}.webp'.replace(' ',''),i)
    for name,frequency in [('rastejante_idle',180),('rastejante_bite',95),('rastejante_frenzy',310),('saltador_attack',220),('saltador_jump',420),('saltador_land',120),('saltador_rasante',520)]: cue(name,frequency)
if __name__=='__main__': main()
