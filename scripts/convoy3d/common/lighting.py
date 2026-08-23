import bpy

def setup_convoy_lighting(scene):
    world=scene.world or bpy.data.worlds.new('ConvoyWorld'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.025,0.035,0.04,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.25
    for name,loc,energy,size in [('Key',(4,-6,10),900,5),('Fill',(-5,-3,5),450,6)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(0.5,0,0.4)
