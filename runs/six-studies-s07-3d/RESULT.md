# Study 07 — PENUMBRA

Completed on 2026-10-04.

Branch: `remodel/s07-shadow-3d`
Commit: `aaa919b1b1526b27853ed931c906b275404ef5b8`
Remote: `origin/remodel/s07-shadow-3d`
Push verified with `git ls-remote`; the remote and local commit IDs match.

## Delivered

A full-viewport spatial anthology built around monumental copper typography, three directional shadows, and artwork distributed across the exhibition. The four chapters display 半影, 边界, 深处, and 回望. Each chapter synchronizes the raised letters, original artwork, title, captions, reading content, and navigation.

Two letter planes and two image planes cast shadows onto one continuous receiver. The three point lights move independently. Dragging and arrow keys change the composition; the lighting panel controls direction and density. Playback advances chapters every 18 seconds. Pause, reset, clean view, PNG export, and reduced motion are supported. Complete chapter prose is available in the reading dialog on small screens.

The renderer uses Canvas glyph masks, layered copper relief, and point-light plane intersections. Shadows and light colors are artistically composed. The four original PNG artworks are retained.

## Validation

- `python scripts/build_studies.py` — PASS.
- `python scripts/build_studies.py --check` — PASS; generated outputs are reproducible.
- `python scripts/check_studies.py` — PASS.
- `node tests/shadow_geometry.mjs` — 5 tests PASS, covering ray-plane intersections, distinct directions, continuity, contact, and responsive placement.
- `$env:PYTHONUTF8='1'; python scripts/check.py --browser` — PASS, including the shared Python, matcher, timing, and legacy browser suites. Full output is in `legacy-check.txt`.
- Live Chrome verification used the browser-control API and the shared `tests/shadow_acceptance.mjs` audit. `browser-results.json` records 34 successful audits and 40 interaction/layout checks, totaling 516 assertions.
- All four chapters were checked at 1440×900 and 390×844. Additional layouts were checked at 1920×1080, 1024×768, 768×1024, 320×568, and 1512×633.
- Actual playback was observed over approximately 30 seconds, including a chapter advance. Paused pixel stability, dragging, keyboard controls, direction/density controls, reset, chapter navigation, reading content, reduced motion, clean view, and PNG export passed.
- No JavaScript errors were reported by Chrome.
- Updated Python browser runners were syntax-checked. Study 07 browser acceptance in this run used Chrome browser control and the shared JavaScript audit.

## Review

Local preview: http://127.0.0.1:8797/dist/shadow-apparatus.html
The preview is served from the repository root and left open in Chrome.

- `shadow-final.jpg` — final normal-window composition.
- `shadow-silhouette-1440.png`, `shadow-boundary-1440.png`, `shadow-depth-1440.png`, `shadow-alignment-1440.png` — four desktop chapters.
- `shadow-silhouette-390.png`, `shadow-boundary-390.png`, `shadow-depth-390.png`, `shadow-alignment-390.png` — four phone chapters.
- `shadow-responsive-320.png` — compact-phone layout.
- `shadow-responsive-1920.png`, `shadow-responsive-1024.png`, `shadow-responsive-768.png`, `shadow-responsive-1512.png` — additional responsive evidence.
- `shadow-playback-start.png`, `shadow-playback-later.jpg` — observed playback states.
- `shadow-export.png` — actual file produced by the export control.
- `browser-results.json` — live audit results and playback state evidence.
- `legacy-check.txt`, `legacy-evidence/` — shared-suite output and generated verification artifacts.

Repository source: `src/studies/shadow.mjs`, `src/studies/shadow.css`, `src/studies/shadow-apparatus.mjs`, and the shadow entry in `src/studies/catalog.json`.
