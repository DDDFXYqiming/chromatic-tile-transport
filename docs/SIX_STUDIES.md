# Experiments 03–08 / implementation and handoff

This branch extends the real `main` tree at
`7c651a845f5bbaaa4500e18f44d1ca0a109e76b5`. It is not the unrelated local root
commit from the previous chat. The two existing effects, their media, builders,
renderers and generated pages are preserved. Only the gallery source and its
root `index.html` output are changed among pre-existing files.

## Run and build

From the repository root:

```powershell
python scripts/serve.py --directory . --port 8765
```

Open `http://127.0.0.1:8765/index.html`. The gallery contains eight entries.
The six new pages are independent; they do not become extra Matrix modes.

```powershell
python scripts/build_studies.py
python scripts/build_studies.py --check
node tests/studies_math.mjs
python tests/studies_browser.py
```

The browser test requires the Python `playwright` package and its Chromium
browser (or `--chromium PATH`). Runtime pages require neither Node nor Python
packages other than a static file server. No CDN, API, online font, model,
account, or secret is used at runtime.

| Study | Entry | Actual implementation |
| --- | --- | --- |
| 03 Portal | `dist/portal-threshold.html` | Real camera movement through an opening in one connected 3D scene; turn back to see the front room |
| 04 Temporal | `dist/temporal-field.html` | Existing local video, bounded 64-frame cache, timestamp-based 2D history sampling and temporal interpolation |
| 05 Fluid | `dist/liquid-canvas.html` | Semi-Lagrangian velocity transport, pressure projection and persistent dye advection |
| 06 Optical | `dist/optical-vault.html` | Front/back sphere refraction, Fresnel weighting, wavelength-dependent sampling, image input |
| 07 Shadow | `dist/shadow-apparatus.html` | One fixed intersection solid; the same surface geometry produces both orthographic silhouettes |
| 08 Folding | `dist/folding-theater.html` | Connected triptych, hinged floor, independently actuated popup hinge, front/back paper surfaces |

## Source layout

`src/studies/catalog.json` owns labels and descriptions. `page.html` is the
shared page template. `main.mjs` owns lifecycle and accessibility hooks.
`core.mjs` contains UI, image loading, canvas sizing and animation lifecycle.
`math.mjs` contains reusable geometry, near-plane clipping, camera projection,
refraction and the fixed shadow-solid construction. Each effect has its own
module. `scripts/build_studies.py` generates only the six new pages and copies
`src/showcase.html` to root `index.html`. It never writes the old `dist/index.html`
or any Matrix build.

All main mechanisms are implemented and usable. The pages do not require a
future Codex run to replace placeholder interactions. The optional next work is
quality expansion: image-model replacements, a more elaborate room, higher
resolution GPU fluid, general glass meshes or a more ambitious paper mechanism.
Those are not falsely reported as implemented.

## Art and media

New illustrations are deliberately simple: three original SVGs and six concept
covers. **No Image Gen call was available or performed in this session.** See
`assets/studies/README.md` for exact provenance and short, complexity-limited
prompts. Existing video is reused, not regenerated. Runtime image/video inputs
stay in browser memory; accepted images are PNG/JPEG/WebP, and videos MP4/WebM.
Object URLs are revoked on replacement/disposal. Local file sizes are limited.

## Controls and lifecycle

Space toggles playback while the canvas has focus. R resets the current study.
Portal uses arrow keys for walking/turning. Folding uses Up/Down to unfold/fold.
Native form controls retain their own keyboard behavior. Touch drag uses pointer
capture and cancellation handlers. Controls and time-field exploration still
work while paused. Background tabs suspend work. Reduced-motion preference
starts the studies paused. PNG export captures the actual canvas.

The measured RAF cadence exposed in the inspection hook is named `rafHz`; it is
not a claim about rendering throughput, especially for static-on-demand studies.

## Deliberate numerical and rendering limits

* Portal and Folding use CPU perspective projection, near clipping, subdivided
  affine texture mapping and painter depth ordering. These are real 3D geometry,
  but not a general-purpose Z-buffer renderer or a recursive portal engine.
* Temporal uses past frames only. The 384×216×64 RGBA payload is 21,233,664 bytes
  (about 20.25 MiB), excluding decoder and canvas overhead. Actual capture times
  determine history offsets. The cache fills gradually; no future frames are
  fabricated. Missing/unsupported video produces an explicitly labeled procedural
  motion fallback, not an empty canvas or an unmarked substitute.
* Fluid runs a 96×60 velocity grid and a 432×270 dye field, with fixed 1/60-second
  steps and a bounded catch-up count. Numerical diffusion softens image detail
  over time. Reset restores the source image; release does not restore it.
* Optical is a sphere under orthographic incidence, with stylized environment
  highlights and approximate absorption. It is not full spectral path tracing
  and does not simulate caustics. Pixel-study views preserve aspect ratio and
  crop to cover rather than stretching spheres into ellipses.
* Shadow uses a 27³ construction grid. Row support is reconciled before forming
  the intersection so the selected two silhouettes are achievable by the same
  solid. It is not a solver for arbitrary incompatible target images.
* Folding is prescribed hinge kinematics, not an arbitrary origami simulation.
  The popup hinge is independently actuated; this is not claimed as a physically
  linked, single-pull commercial pop-up mechanism.

## Acceptance scope

See `docs/SIX_STUDIES_TEST_RESULTS.json` for the recorded browser checks. The
current environment blocked HTTP navigation and did not provide WebGL. Tests
therefore used a fully offline, in-memory browser harness with the same effect
code, original local SVGs, and a generated H.264 decoder fixture. This did **not**
change browser policy or production sources. Native ES-module paths and generated
outputs were checked separately.

Seven mathematical tests cover near clipping, zero-index-change refraction,
index-dependent rays, both exact silhouette projections, all hinge connections,
pressure projection and finite long-running fluid state. Browser checks cover
initialization, stable pause, per-effect interaction, PNG export, mobile overflow,
reduced motion and uncaught exceptions. Desktop and mobile screenshots were
rendered and reviewed; they are test artifacts, not model-generated images.

The original repository video was verified to exist by GitHub metadata, but its
actual bytes could not be downloaded into this environment. Video decoding was
verified with a local H.264 fixture instead. The old effect-01 and Matrix browser
suites were **not** rerun here, because this environment only held the inspected
source and new files. Their unchanged remote blob identities must be verified
before reporting the branch as pushed.
