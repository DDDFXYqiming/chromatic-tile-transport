# Study 05 — fluid performance and region isolation

Branch: `remodel/s05-perf-region`

Baseline: `54be389a12ed760b0df0ca522e6c01295bf5a2dc`

Date: 2026-10-04

The four original paintings, chapter transitions and persistent pigment flow are retained. Interaction now follows feathered artwork-space regions for mineral powder, ink inside the glass, the painted paper wash and the tabletop light. Colour gates refine the powder, paper and light boundaries. Overlay hit testing protects the editorial cards and controls, including captured pointers leaving and re-entering the canvas. Imported images use a bounded central work area.

The solver uses 72×48 cells and 12 pressure iterations, with a shared 1/60-second transport step. The 120×80 coordinate field updates only masked cells. Brush work is bounded and pointer samples are coalesced per frame. WebGL renders a cropped transparent pigment layer over the original image, reuses texture storage, and uploads only changed flow maps. The mineral layer is 917×395 instead of a full 1536×1024 frame. Canvas DPR is capped at 1.25. When momentum settles, the solver and uploads stop; a cached layer preserves the painting while the subtle reading camera redraws at a maximum of 12 Hz.

## Measured playback

Same-machine headless Chromium, 1440×900, mineral chapter. Each sample lasts approximately three seconds; the settled sample follows eight additional seconds after the flow sample. Baseline loads the original fluid module from the revision above. These are browser main-thread task durations, not whole-device CPU/GPU utilization or power measurements.

| Phase | Baseline task ms/s | Updated task ms/s | Baseline FPS | Updated FPS |
| --- | ---: | ---: | ---: | ---: |
| Reading | 351.6 | 47.5 | 33.8 | 10.3 |
| Flow | 999.1 | 885.1 | 13.9 | 57.8 |
| Settled | 999.3 | 66.8 | 9.7 | 10.3 |

Flow playback improved approximately 4.2×. Reading redraws are deliberately throttled. The updated settled sample performed **zero simulation steps and zero flow uploads**; another nudge successfully woke the solver. Absolute timings vary with browser rendering backend and machine load.

## Validation

- `python scripts/build_studies.py` and `python scripts/check_studies.py` — PASS.
- `node tests/fluid_math.mjs` — PASS, including stationary exterior coordinates, finite transport, all four masks and eventual settling.
- `node tests/studies_math.mjs` — 7 checks PASS.
- `python tests/fluid_browser.py --output <evidence>/browser` — 118 checks PASS: four chapters, five viewport sizes, timed transitions, playback, pause/reset, imports, PNG export, reduced motion and Canvas 2D fallback.
- `python tests/fluid_region_browser.py --output <evidence>/regions` — 27 checks PASS: visible flow in all four regions, byte-identical exterior pixels, inert empty/UI drags, capture exit/re-entry, 390/320px crops, sleep and wake.
- `PYTHONUTF8=1 python scripts/check.py --browser` — PASS, including 41 Python tests and the legacy browser/handoff checks.
- `git diff --check` — PASS.

The fluid browser test's footer expectation now matches the existing page-local chapter navigation. Desktop/mobile handoff screenshots and real browser playback were reviewed. Chrome also displayed the local mineral swirl with intact artwork and editorial layout.

Local evidence is in the main checkout at `runs/six-studies-s05-opt/`: `baseline/results.json`, `regions/results.json`, `browser/results.json`, screenshots, `browser/fluid-tour.webm`, and command logs. The isolated worktree preview is `http://127.0.0.1:8875/dist/liquid-canvas.html`.
