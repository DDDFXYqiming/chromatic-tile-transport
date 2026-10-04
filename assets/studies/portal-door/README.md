# Bronze doorway asset

Created with Blender 5.2.1 LTS from `src/studies/portal-door.blender.py`.

- `bronze-door.blend` is the editable source scene, in metres.
- `bronze-door.glb` contains two named hinge nodes, their solid panel geometry, and the raised threshold. It was reimported into a clean Blender scene and checked.
- `door.mesh.json` contains the evaluated triangles used by the page's WebGL renderer. Groups `-1` and `1` rotate about the left and right hinges; group `0` is the fixed threshold. Axes are X right, Y up, Z toward the entrance.

The leaves are 0.14 m thick, have raised panel rails, fluting, pulls on both faces and hinge barrels. The threshold is 2.38 m deep and has raised transverse treads. The surrounding structural jambs and lintel come from `portal-scene.mjs`.

Surface material reuses `../portal-patina.png`, recorded in `../portal-assets.json` as a Codex Image Gen asset. The four chapter artworks are unchanged. Their existing media terms continue to apply. The procedural geometry and generator follow the repository's source-code license.

The GLB is an editable interchange artifact. The page loads the mesh JSON and the existing patina image directly, sharing a single bronze texture across all three doorways.
