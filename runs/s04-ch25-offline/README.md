# AFTERLIGHT chapter 02 + 05 render review

The PNGs in this folder are native Canvas renders of the production functions in `src/studies/temporal-plates.mjs`. They show the artwork layer at 0 and 4 seconds, at 1440×650 and 390×1000. Page typography and CSS are assessed separately by QA.

- `rain-*`: the tram/skyline remain fixed while the puddle and three lamp reflections move.
- `fold-*`: the new panorama is mapped onto the evaluated seven-leaf Blender mesh. Adjacent leaves share their hinges.
- `raster-results.json`: pixel stability, movement, reduced motion, dry-region invariance and zero-depth identity checks.
- `assets/studies/temporal-fold/review-*.png`: Blender diagnostic renders for folded, unfolding and open poses.

Reproduce the deterministic checks with `node tests/temporal_plates.mjs` and `node tests/temporal_runtime.mjs`. The latter exercises production filmstrip callbacks and the complete chapter copy/art state for 20 chapter/viewport combinations.

For native raster review, provide a local installation of `@napi-rs/canvas`:

```powershell
node tests/temporal_plates.mjs --canvas-module .local-generation/temporal-review/node_modules/@napi-rs/canvas/index.js --output runs/s04-ch25-offline
```

The Blender authoring script is `src/studies/blender/build_temporal_fold.py`; the packed editable scene and exported 49-pose sequence are in `assets/studies/temporal-fold/`. Image generation prompts, provenance and SHA-256 hashes are in `assets/studies/temporal-ch25-assets.json`.

Page acceptance handoff: `tests/temporal_browser.py` includes five-chapter copy/visual synchronization, real playback, pause, pointer response, video import, transitions, keyboard navigation and responsive layout. Chrome results are pending QA.
