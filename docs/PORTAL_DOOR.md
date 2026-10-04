# Portal Threshold · hinged bronze doors

The four chapter rooms form one connected, opaque, depth-tested world. Selecting a chapter sets a walking destination. Each intervening bronze door opens through 88 degrees about two fixed hinges. The approaching camera waits 2.5 m from the door plane until both leaves clear the path, then passes through the 2.4 m deep passage. The next room is visible through the widening opening. Chapter identity changes when the camera crosses the door plane; the journal text returns at the destination.

The same door state is used by the renderer, travel controller, inspection data and geometry checks. Opening takes 1.8 seconds. A typical adjacent walk takes 7.52 seconds, including 1.53 seconds within the deep passage. Return trips turn the camera first and open the doors away from the approaching viewer. An interrupted trip retains its current camera position and hinge angles. The leaves keep their swing direction until closed. Pause freezes both travel and opening; reduced-motion chapter selection moves directly to the selected stop.

## Assets and renderer

`src/studies/portal-door.blender.py` builds `assets/studies/portal-door/bronze-door.blend`, `bronze-door.glb` and `door.mesh.json`. The JSON is the evaluated Blender mesh, with separate fixed/left/right groups. The page renders it in the existing WebGL pipeline, with opaque depth writes and local UV coordinates that remain attached to the swinging panels. All three doors share the existing bronze texture. The full scene contains 44,240 triangles.

`portal-door.mjs` owns the asset URL, hinge transforms and shared door timing constants. `portal-travel.mjs` controls the actuators and physical clearance wait. `portal-scene.mjs` applies the corresponding rigid transforms in its vertex shader. The build includes the new module in the portal import map so nested imports track the generated page revision.

## Rebuild and review

```powershell
& D:/AI_Projects/blender/scripts/blender.ps1 --background --python-exit-code 1 --python src/studies/portal-door.blender.py
python scripts/build_studies.py
python scripts/check_studies.py
```

The model generator writes closed, half-open and fully-open review renders and a clean-GLB-reimport report under `reports/portal-door/`.

For a view of the integrated production geometry, export the actual triangles and sampled travel poses, then render them in Blender. Quote the separator when invoking the PowerShell wrapper.

```powershell
node scripts/export_portal_review.mjs path/to/scene.json
& D:/AI_Projects/blender/scripts/blender.ps1 --background --python-exit-code 1 --python scripts/render_portal_review.py '--' path/to/scene.json path/to/review
```

The checked-in `reports/portal-door/walk/` images show the first doorway at seven poses from departure to arrival. These are Blender geometry reviews. Lighting differs from the WebGL shader; live page layout, driver behavior and frame rate remain part of the separate QA pass.

## Automated coverage

- `tests/test_portal_travel.mjs`: all start/destination pairs at 20/60/144 Hz, continuous travel, room-shell occlusion, framing and 120 depth-rasterized geometry frames.
- `tests/portal_door.mjs`: actual Blender triangles, opaque GLB, widening opening in both directions, opening wait, six threshold crossings, camera clearance at pointer extremes, pause and interrupted travel.
- `tests/portal_runtime.mjs`: Node DOM/WebGL command fixtures covering all four chapter selections, journal content, both hinge signs, depth state, pause, reset, reduced motion and shared texture cleanup. These checks exercise lifecycle and commands rather than raster output.

`VisualStudy.inspect()` includes `sceneRevision: "hinged-bronze-r10"`, `doorAsset`, `doorLeaves`, `waitingForDoor`, camera position and current chapter. The canvas also exposes `data-door-angles` for synchronizing QA captures.
