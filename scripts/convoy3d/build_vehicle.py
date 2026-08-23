import bpy, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from common.camera import setup_convoy_camera
from common.lighting import setup_convoy_lighting
from common.materials import convoy_materials
from common.animations import key_run,key_idle,key_destroyed,key_destroyed_loop
from vehicles.tr7r_peregrino import build_vehicle

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT'
mats=convoy_materials(); root,wheels,parts=build_vehicle(mats); setup_convoy_camera(scene); setup_convoy_lighting(scene)
key_run(root,wheels,scene); key_idle(root,scene)
key_destroyed(root,parts,scene)
key_destroyed_loop(parts,scene)
scene.frame_start=1; scene.frame_end=29
Path('tmp/convoy3d').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath='tmp/convoy3d/tr7r_peregrino.blend')
