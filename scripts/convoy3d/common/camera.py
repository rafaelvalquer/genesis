import bpy

def setup_convoy_camera(scene):
    camera_data = bpy.data.cameras.new("ConvoyOrthographic")
    camera = bpy.data.objects.new("ConvoyOrthographic", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 6.4
    camera.location = (8.0, -18.0, 7.0)
    camera.rotation_euler = (1.33, 0.0, 0.41)
    scene.camera = camera
    scene.render.resolution_x = 896
    scene.render.resolution_y = 448
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    return camera
