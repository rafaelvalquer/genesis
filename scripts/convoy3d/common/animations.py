import math

RUN_BODY_Y=[0.0,0.010,0.015,0.007,0.0,-0.010,-0.015,-0.007]
IDLE_BODY_Y=[0.0,0.008,0.012,0.0,-0.008,-0.004]

def key_run(root,wheels,scene):
    for i,y in enumerate(RUN_BODY_Y):
        f=i+1; scene.frame_set(f); root.location.z=y; root.rotation_euler.y=math.radians(0.3*math.sin(i*math.pi/4)); root.keyframe_insert('location',frame=f); root.keyframe_insert('rotation_euler',frame=f)
        for wheel in wheels.values(): wheel.rotation_euler.x=i*math.pi/4; wheel.keyframe_insert('rotation_euler',index=0,frame=f)

def key_idle(root,scene):
    for i,y in enumerate(IDLE_BODY_Y):
        f=i+1; scene.frame_set(f); root.location.z=y; root.keyframe_insert('location',frame=f)

def key_destroyed(root, parts, scene):
    """Key the same rig into a restrained 10-frame wreck transition."""
    for i in range(10):
        f=20+i; scene.frame_set(f); t=i/9
        root.location.z=-0.12*t; root.rotation_euler.y=math.radians(-4*t)
        root.keyframe_insert('location',frame=f); root.keyframe_insert('rotation_euler',frame=f)
        if 'antenna' in parts:
            parts['antenna'].rotation_euler.y=math.radians(24*t); parts['antenna'].keyframe_insert('rotation_euler',frame=f)
        if 'bumper' in parts:
            parts['bumper'].location.x=0.25*t; parts['bumper'].keyframe_insert('location',frame=f)

def key_destroyed_loop(parts, scene):
    """Subtle six-frame wreck loop; no wheel or chassis motion."""
    for i in range(6):
        f=30+i; scene.frame_set(f)
        if 'cyan_light' in parts:
            parts['cyan_light'].scale.x=0.72 + 0.06*(i % 3); parts['cyan_light'].keyframe_insert('scale',index=0,frame=f)
        if 'antenna' in parts:
            parts['antenna'].rotation_euler.y=math.radians(24 + (i % 2)*2); parts['antenna'].keyframe_insert('rotation_euler',index=1,frame=f)
