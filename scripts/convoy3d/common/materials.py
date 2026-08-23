import bpy

def material(name, color, metallic=0.0, roughness=0.65, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1.0)
    m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1.0)
    bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=roughness
    if emission:
        bs.inputs['Emission Color'].default_value=(*emission,1.0); bs.inputs['Emission Strength'].default_value=1.5
    return m

def convoy_materials():
    return {k: material(k,c,m,r,e) for k,c,m,r,e in [
      ('MAT_MILITARY_GREEN',(0.24,0.31,0.15),0.05,0.72,None),
      ('MAT_SAND',(0.52,0.45,0.27),0.02,0.75,None),
      ('MAT_METAL_DARK',(0.06,0.08,0.08),0.55,0.42,None),
      ('MAT_RUBBER',(0.025,0.03,0.028),0.0,0.9,None),
      ('MAT_GLASS',(0.04,0.14,0.15),0.15,0.22,None),
      ('MAT_CYAN_EMISSIVE',(0.02,0.35,0.32),0.0,0.3,(0.02,0.8,0.75)),
      ('MAT_DAMAGE_DARK',(0.10,0.09,0.06),0.1,0.9,None) ]}
