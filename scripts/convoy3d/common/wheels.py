from .geometry import cylinder

WHEEL_CENTERS = {'rear':(-2.25,0,0.72), 'middle':(0,0,0.72), 'front':(2.25,0,0.72)}

def create_wheels(parent, mats):
    wheels={}
    for key,loc in WHEEL_CENTERS.items():
        w=cylinder('wheel_'+key,loc,0.72,0.42,mats['MAT_RUBBER'],parent); w.rotation_mode='XYZ'; wheels[key]=w
        cylinder('rim_'+key,(loc[0],loc[1]-0.23,loc[2]),0.33,0.06,mats['MAT_METAL_DARK'],parent)
    return wheels
