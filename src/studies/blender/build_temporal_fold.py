"""Build the seven-leaf dawn letter and export evaluated Blender geometry.

Run with the project Blender wrapper, --background --python-exit-code 1 --python.
The compact mesh sequence is the runtime asset; the blend preserves the authoring scene.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/studies/temporal-fold'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1000
scene.render.resolution_y = 650
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('Midnight studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.055, .08, .10, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
scene.view_settings.view_transform = 'AgX'
PANELS, X_STEPS, Y_STEPS, FRAMES = 7, 3, 6, 49
HEIGHT = 7 * 941 / 1672

def positions(openness):
    # A continuous accordion: each leaf's right hinge IS the next leaf's left hinge.
    hinges = [(0., 0.)]
    for panel in range(PANELS):
        angle = (1 - openness) * (1.27 if panel % 2 == 0 else -1.27)
        angle += .07 * math.sin(panel * .72) * openness
        x, z = hinges[-1]
        hinges.append((x + math.cos(angle), z + math.sin(angle)))
    center_x = (hinges[0][0] + hinges[-1][0]) / 2
    center_z = sum(z for x, z in hinges) / len(hinges)
    vertices = []
    for row in range(Y_STEPS + 1):
        for col in range(PANELS * X_STEPS + 1):
            panel = min(PANELS - 1, col // X_STEPS)
            u = (col - panel * X_STEPS) / X_STEPS
            a, b = hinges[panel], hinges[panel + 1]
            vertices.append((a[0] + (b[0] - a[0]) * u - center_x,
                             (row / Y_STEPS - .5) * HEIGHT,
                             a[1] + (b[1] - a[1]) * u - center_z))
    return vertices

columns = PANELS * X_STEPS + 1
faces = []
for row in range(Y_STEPS):
    for col in range(columns - 1):
        a = row * columns + col
        faces.extend([(a, a + 1, a + columns + 1), (a, a + columns + 1, a + columns)])
uvs = [(col / (columns - 1), row / Y_STEPS) for row in range(Y_STEPS + 1) for col in range(columns)]
mesh = bpy.data.meshes.new('Continuous accordion UV grid')
mesh.from_pydata(positions(1), [], faces)
mesh.update()
paper = bpy.data.objects.new('Dawn letter / seven connected leaves', mesh)
scene.collection.objects.link(paper)
uv = mesh.uv_layers.new(name='Panorama')
for face in mesh.polygons:
    for loop_index in face.loop_indices:
        uv.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]
material = bpy.data.materials.new('Warm photographic cotton paper')
material.use_nodes = True
nodes = material.node_tree.nodes
shader = nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .73
texture = nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(str(ROOT / 'assets/studies/temporal-dawn-letter.png'))
texture.image.pack()
material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
paper.data.materials.append(material)
paper.shape_key_add(name='Basis')
for frame in range(FRAMES):
    openness = frame / (FRAMES - 1)
    key = paper.shape_key_add(name=f'Opening {frame:02d}')
    for vertex, coordinate in zip(key.data, positions(openness)):
        vertex.co = coordinate
    for at, value in ((max(0, frame - 1), 0), (frame, 1), (min(FRAMES - 1, frame + 1), 0)):
        # End keys must retain their endpoint pose.
        if at != frame or value == 1:
            key.value = value
            key.keyframe_insert(data_path='value', frame=at + 1)
    key.value = 0
for curve in paper.data.shape_keys.animation_data.action.layers[0].strips[0].channelbags[0].fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'LINEAR'
scene.frame_start, scene.frame_end = 1, FRAMES
sequence = []
depsgraph = bpy.context.evaluated_depsgraph_get()
for frame in range(1, FRAMES + 1):
    scene.frame_set(frame)
    evaluated = paper.evaluated_get(depsgraph)
    sequence.append([[round(v, 6) for v in vertex.co] for vertex in evaluated.data.vertices])
assert len(sequence) == FRAMES and len(sequence[0]) == columns * (Y_STEPS + 1)
assert max(v[0] for v in sequence[-1]) - min(v[0] for v in sequence[-1]) > 6.9
payload = dict(version=1, generator='Blender ' + bpy.app.version_string, panels=PANELS,
               frameCount=FRAMES, uv=uvs, faces=faces, frames=sequence,
               coordinates='right-handed; +Y up; +Z facing camera; UV origin bottom left')
(OUT / 'dawn-fold.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
solid = paper.modifiers.new('Cotton paper edge', 'SOLIDIFY')
solid.thickness = .018
bevel = paper.modifiers.new('Soft cut edge', 'BEVEL')
bevel.width, bevel.segments = .009, 2
camera_data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new('Review camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, 0, 13)
camera.rotation_euler = (0, 0, 0)
camera_data.type, camera_data.ortho_scale = 'ORTHO', 8.6
scene.camera = camera
for name, location, energy, size in [('Warm key', (1, 4, 7), 650, 7), ('Cool fill', (-5, 0, 4), 250, 5)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.frame_set(38)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'dawn-letter.blend'), compress=True)
for frame, label in [(9, 'folded'), (38, 'unfolding'), (49, 'open')]:
    scene.frame_set(frame)
    scene.render.filepath = str(OUT / f'review-{label}.png')
    bpy.ops.render.render(write_still=True)
report = dict(generator=payload['generator'], panels=PANELS, vertices=len(mesh.vertices),
              triangles=len(faces), frames=FRAMES, texture=texture.image.name,
              bounds={label: [min(v[0] for v in sequence[frame]), max(v[0] for v in sequence[frame])]
                      for label, frame in [('closed', 0), ('open', FRAMES - 1)]})
(OUT / 'scene-info.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(report))
