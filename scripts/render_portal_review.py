"""Render production geometry / sampled hinge poses using background Blender.

Pass -- <temporary scene.json> <review output directory>. The JSON is produced by
export_portal_review.mjs. These are Blender geometry reviews, not webpage captures.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:]
data = json.loads(Path(args[0]).read_text(encoding='utf-8'))
output = Path(args[1])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 500
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Gallery ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.50, .58, .55, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
scene.view_settings.view_transform = 'Standard'

def xyz(p):
    return Vector((p[0], -p[2], p[1]))

objects = []
materials = {}
images = {}
for index, batch in enumerate(data['batches']):
    source = batch['vertices']
    vertices = [xyz(source[i:i+3]) for i in range(0, len(source), 12)]
    triangles = [tuple(range(i, i+3)) for i in range(0, len(vertices), 3)]
    mesh = bpy.data.meshes.new(f'Production_{index}')
    mesh.from_pydata(vertices, [], triangles)
    mesh.update()
    uv = mesh.uv_layers.new()
    for i, loop in enumerate(uv.data):
        u, v = source[i*12+9:i*12+11]
        loop.uv = (u, 1-v)
    texture = batch['texture']
    for i, polygon in enumerate(mesh.polygons):
        color = tuple(source[i*36+6:i*36+9])
        kind = source[i*36+11]
        key = (texture, color, kind)
        if key not in materials:
            material = bpy.data.materials.new(f'Surface_{len(materials)}')
            material.use_nodes = True
            nodes, links = material.node_tree.nodes, material.node_tree.links
            bsdf = nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = (*color, 1)
            bsdf.inputs['Roughness'].default_value = .65 if kind != 1 else .38
            if texture:
                if texture not in images:
                    images[texture] = bpy.data.images.load(str(ROOT / texture))
                tex = nodes.new('ShaderNodeTexImage')
                tex.image = images[texture]
                tex.extension = 'REPEAT' if kind == 1 else 'EXTEND'
                links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
                bsdf.inputs['Emission Strength'].default_value = .65 if kind == 0 else .12
                links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
            elif kind == 3:
                bsdf.inputs['Emission Color'].default_value = (*color, 1)
                bsdf.inputs['Emission Strength'].default_value = .5
            materials[key] = material
        material = materials[key]
        if material.name not in mesh.materials:
            mesh.materials.append(material)
        polygon.material_index = mesh.materials.find(material.name)
    obj = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(obj)
    objects.append(obj)

# Soft ceiling fixtures reveal the deep jambs, bevels and opaque leaf faces.
for z in [7,3,-3,-7,-13,-17,-23,-27]:
    light = bpy.data.lights.new(f'Ceiling_{z}', 'AREA')
    light.energy, light.size = 350, 4
    obj = bpy.data.objects.new(light.name, light)
    scene.collection.objects.link(obj)
    obj.location = xyz((0,4.3,z))
cam = bpy.data.cameras.new('Production_camera')
cam.sensor_fit, cam.sensor_height = 'VERTICAL', 32
cam.lens = data['lens'] * 16
cam.clip_start = .05
cam.shift_x = -.06 * data['aspect']
camera = bpy.data.objects.new('Production_camera', cam)
scene.collection.objects.link(camera)
scene.camera = camera
for frame in data['frames']:
    camera.location = xyz(frame['eye'])
    camera.rotation_euler = Vector((0,1,0)).to_track_quat('-Z', 'Y').to_euler()
    for obj, pose in zip(objects, frame['poses']):
        pivot, origin = xyz(pose['pivot']), xyz(pose['origin'])
        obj.matrix_world = Matrix.Translation(origin+pivot) @ Matrix.Rotation(pose['angle'], 4, 'Z') @ Matrix.Translation(-pivot)
    scene.render.filepath = str(output / (frame['label']+'.png'))
    bpy.ops.render.render(write_still=True)
(output / 'poses.json').write_text(json.dumps(data['frames'], indent=2), encoding='utf-8')
print('PORTAL_PRODUCTION_REVIEW_PASS', len(data['frames']))
