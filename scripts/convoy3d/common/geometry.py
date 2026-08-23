import bpy

def cube(name, location, scale, mat, bevel=0.08, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod=o.modifiers.new('controlled_bevel','BEVEL'); mod.width=bevel; mod.segments=2
    o.data.materials.append(mat)
    if parent: o.parent=parent
    return o

def cylinder(name, location, radius, depth, mat, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth, location=location, rotation=(1.5708,0,0))
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    if parent: o.parent=parent
    return o
