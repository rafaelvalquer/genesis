from common.geometry import cube
from common.wheels import create_wheels

def build_vehicle(mats):
    root=cube('vehicle_root',(0,0,0.8),(3.4,0.9,0.35),mats['MAT_MILITARY_GREEN'],0.12)
    cube('cargo_frame',(-0.9,0,1.55),(2.1,0.82,0.85),mats['MAT_MILITARY_GREEN'],0.1,root)
    cube('cabin',(2.0,0,1.55),(1.25,0.82,0.9),mats['MAT_SAND'],0.12,root)
    windshield=cube('windshield',(2.0,-0.84,1.78),(0.72,0.05,0.34),mats['MAT_GLASS'],0.03,root)
    cube('cyan_light',(2.55,-0.86,1.1),(0.28,0.04,0.09),mats['MAT_CYAN_EMISSIVE'],0.02,root)
    for x in (-1.7,-0.6,0.5): cube('cargo_box', (x,-0.05,1.65),(0.38,0.65,0.45),mats['MAT_SAND'],0.06,root)
    bumper=cube('bumper',(3.4,-0.02,0.92),(0.22,0.98,0.18),mats['MAT_METAL_DARK'],0.04,root)
    antenna=cube('antenna',(-2.7,0,2.75),(0.03,0.03,0.7),mats['MAT_METAL_DARK'],0.01,root)
    light=bpy.data.objects.get('cyan_light')
    return root, create_wheels(root,mats), {'windshield':windshield,'bumper':bumper,'antenna':antenna,'cyan_light':light}
