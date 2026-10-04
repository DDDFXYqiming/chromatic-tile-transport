"""Build the hinged bronze leaves and raised threshold used by Portal Threshold.

Run with the workspace Blender wrapper, --background --python-exit-code 1 --python.
Geometry is authored in metres, exported as GLB and as the same evaluated triangles
for the dependency-free WebGL renderer. Local runtime axes are X right, Y up, Z near.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/studies/portal-door'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 960
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Gallery ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.24, .30, .28, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
scene.view_settings.view_transform = 'AgX'

def xyz(p):
    return (p[0], -p[2], p[1])

def runtime(p):
    return (p.x, p.z, -p.y)

patina = bpy.data.images.load(str(ROOT / 'assets/studies/portal-patina.png'))
materials = {}
for name, color, metal, rough in [
    ('cast_bronze', (.82, .67, .43), .72, .34),
    ('polished_edges', (1.0, .82, .49), .78, .25),
    ('recessed_bronze', (.36, .49, .40), .65, .45),
]:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = patina
    tint = mat.node_tree.nodes.new('ShaderNodeMixRGB')
    tint.blend_type = 'MULTIPLY'
    tint.inputs[0].default_value = .55
    tint.inputs[2].default_value = (*color, 1)
    mat.node_tree.links.new(tex.outputs['Color'], tint.inputs[1])
    mat.node_tree.links.new(tint.outputs[0], bsdf.inputs['Base Color'])
    materials[name] = mat

roots = {}
for side, name in [(-1, 'Left_hinge'), (1, 'Right_hinge')]:
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    root.location = xyz((side * 1.15, 0, 0))
    roots[side] = root

parts = []
def finish(obj, name, mat, side):
    obj.name = name
    obj.data.materials.append(materials[mat])
    obj['door_part'] = side
    if side:
        matrix = obj.matrix_world.copy()
        obj.parent = roots[side]
        obj.matrix_world = matrix
    parts.append(obj)
    return obj

def cube(name, center, size, mat='cast_bronze', side=0, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(center))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Cast edge bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
    return finish(obj, name, mat, side)

for side, label in [(-1, 'Left'), (1, 'Right')]:
    # Two genuinely solid 14 cm leaves, with a 12 mm centre seam.
    cx = side * .578
    cube(label + '_solid_leaf', (cx, 1.72, 0), (1.144, 3.02, .14), side=side)
    for face in [-1, 1]:
        for x in [side * .08, side * 1.078]:
            cube(label + '_stile', (x, 1.72, face * .096), (.085, 2.91, .075), 'polished_edges', side)
        for y in [.295, 1.18, 2.23, 3.145]:
            cube(label + '_rail', (cx, y, face * .10), (1.03, .10, .08), 'polished_edges', side)
        for y, height in [(.738, .70), (1.708, .85), (2.688, .70)]:
            cube(label + '_recess', (cx, y, face * .076), (.80, height, .034), 'recessed_bronze', side, .02)
            # Raised fluting gives the panels visible relief as they turn.
            for dx in [-.24, -.12, 0, .12, .24]:
                cube(label + '_flute', (cx + dx, y, face * .10), (.018, height - .12, .026), 'cast_bronze', side, .007)
        for y in [1.48, 1.92]:
            cube(label + '_handle_mount', (side * .19, y, face * .145), (.11, .11, .15), 'polished_edges', side, .02)
        cube(label + '_pull_handle', (side * .19, 1.70, face * .225), (.052, .52, .07), 'polished_edges', side, .02)
    for y in [.53, 1.73, 2.91]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.055, depth=.23, location=xyz((side * 1.15, y, 0)))
        finish(bpy.context.object, label + '_hinge_barrel', 'polished_edges', side)

# A raised, bevelled tread sits on the structural sill, with transverse grooves.
cube('Raised_threshold', (0, .18, 0), (2.35, .04, 2.38), bevel=.01)
for z in [-1.10, -.90, -.60, -.30, 0, .30, .60, .90, 1.10]:
    cube('Threshold_tread', (0, .205, z), (2.30, .012, .025), 'polished_edges', bevel=.004)

bpy.context.view_layer.update()
groups = {side: [] for side in [-1, 0, 1]}
depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in parts:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    vertices = groups[obj['door_part']]
    color = obj.data.materials[0].diffuse_color[:3]
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    for triangle in mesh.loop_triangles:
        positions = [Vector(tuple(round(v, 6) for v in runtime(obj.matrix_world @ mesh.vertices[index].co))) for index in triangle.vertices]
        if (positions[1] - positions[0]).cross(positions[2] - positions[0]).length <= 1e-10:
            continue
        normal = runtime((normal_matrix @ triangle.normal).normalized())
        for p in positions:
            uv = (p[0] * .48, p[2] * .48) if abs(normal[1]) > .5 else ((p[2] * .48, p[1] * .48) if abs(normal[0]) > .5 else (p[0] * .48, p[1] * .48))
            vertices.extend(round(v, 6) for v in (*p, *normal, *color, *uv, 1))
    evaluated.to_mesh_clear()

asset = {'revision': 'bronze-leaves-r10', 'units': 'metres', 'hingeX': 1.15,
         'leafThickness': .14, 'openingRadians': math.radians(88),
         'groups': [{'side': side, 'vertices': data} for side, data in groups.items()]}
(OUT / 'door.mesh.json').write_text(json.dumps(asset, separators=(',', ':')), encoding='utf-8')

# GLB keeps the two hinge nodes; both leaf rotations are editable in the .blend.
bpy.ops.object.select_all(action='DESELECT')
for obj in [*parts, *roots.values()]:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'bronze-door.glb'), export_format='GLB', use_selection=True)
patina.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'bronze-door.blend'))

def aim(obj, point):
    obj.rotation_euler = (Vector(xyz(point)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

for name, point, power, size in [('Warm entrance', (0, 4.7, 4), 1400, 5), ('Cool return', (1, 3.8, -3), 1000, 4)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = xyz(point)
    aim(obj, (0, 1.6, 0))
cam = bpy.data.cameras.new('Review_camera')
camera = bpy.data.objects.new('Review_camera', cam)
scene.collection.objects.link(camera)
camera.location = xyz((3.7, 2.8, 6))
aim(camera, (0, 1.5, 0))
cam.lens = 48
scene.camera = camera
review = ROOT / 'reports/portal-door'
review.mkdir(parents=True, exist_ok=True)
for label, angle in [('closed', 0), ('opening', math.radians(45)), ('open', math.radians(88))]:
    for side, obj in roots.items():
        obj.rotation_euler.z = -side * angle
    scene.render.filepath = str(review / (label + '.png'))
    bpy.ops.render.render(write_still=True)

# Reimport the distributable into a clean scene and validate solid geometry/hinges.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'bronze-door.glb'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert len(meshes) == len(parts), (len(meshes), len(parts))
assert all(o.data.polygons for o in meshes)
assert all(bpy.data.objects.get(name) for name in ['Left_hinge', 'Right_hinge', 'Raised_threshold'])
report = {'passed': True, 'blender': bpy.app.version_string, 'reimportedMeshes': len(meshes),
          'triangles': {str(g['side']): len(g['vertices']) // 36 for g in asset['groups']},
          'leafThicknessMetres': .14, 'thresholdDepthMetres': 2.38,
          'hinges': ['Left_hinge', 'Right_hinge']}
(review / 'asset-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('PORTAL_DOOR_ASSET_PASS', json.dumps(report))
