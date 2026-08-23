import bpy
from pathlib import Path
scene=bpy.context.scene; scene.render.resolution_x=896; scene.render.resolution_y=448; scene.render.film_transparent=True
out=Path('tmp/convoy3d/tr7r_peregrino'); out.mkdir(parents=True,exist_ok=True)
groups=(('idle',range(1,7)),('run',range(1,9)),('destroyed_transition',range(20,30)),('destroyed_loop',range(30,36)))
for state,frames in groups:
    for i,f in enumerate(frames):
        scene.frame_set(f); scene.render.filepath=str(out/f'{state}_{i:02d}.png'); bpy.ops.render.render(write_still=True)
