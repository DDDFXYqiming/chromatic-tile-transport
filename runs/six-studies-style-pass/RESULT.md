# Six studies exhibition style pass

Date: 2026-10-04
Branch: `feat/visual-lab-six-studies`
Implementation commit: `17af96b814315fe96000804f370efa16dc98cf6a`
Baseline commit: `47804463b6de4296d2da2d70d105787c4e3e0af2`

## Delivered behavior

All eight experiences share the exhibition mode switch and thumbnail atlas. Each study has the gold star brand, dark full-stage composition, serif headline, individual neon accent, translucent live status card, compact interaction controls, previous/next experience links and SPACE hint. The study menu lists all eight destinations. The mobile atlas scrolls horizontally and keeps the current study in view.

Transport and all four Matrix collections expose **八个体验** in their existing bottom bars. This opens the eight-experience atlas; **返回当前影像** restores their scene timeline and filmstrip. Next/previous experience links wrap between 01 and 08. The gallery remains the repository entry point.

The six mechanism modules, their core/math modules, the original PNG artwork, and both legacy renderer/timing implementations are unchanged. The new thumbnails are 160 × 96 WebP crops of existing covers (18,632 bytes combined). `src/hall/README.md` documents the shared shell and regeneration commands.

## Validation

| Command / suite | Result |
| --- | --- |
| `python scripts/build_studies.py` and `--check` | Six pages and gallery rebuilt; reproducible |
| Transport build and all four linked Matrix builds | Passed |
| `node tests/studies_math.mjs` | 7/7 passed |
| `python scripts/check_studies.py` | Passed: module/resource graph, assets and eight-entry gallery |
| `python tests/studies_browser.py --output runs/six-studies-style-pass/browser-http` | 121/121 passed |
| `python tests/studies_browser.py --inline --video-fixture assets/matrix-battle/03-clash.mp4 --output runs/six-studies-style-pass/browser-inline` | 122/122 passed, including real local video decoding |
| `python tests/hall_browser.py` | 117/117 passed: real eight-page navigation, wraparound, thumbnails, legacy scene restoration and responsive mode menus |
| `python scripts/check.py --browser` | Passed: 8 matcher, 11 timing, 41 Python, 25 browser and 8 handoff checks |
| `python tests/browser_matrix_interface.py` | 7/7 passed across all four Matrix collections |
| `python scripts/check_matrix.py --browser` | Deterministic/build checks passed; first browser suite 21/23 passed, with the two baseline failures below |
| `node --check src/hall/main.js` and `git diff --check` | Passed |

Browser evidence uses headless Chromium. Checks cover actual playback, camera crossing and turning, bounded video history, continuing fluid motion, optical dragging/refraction, fixed-geometry shadow projection, attached paper hinges, pause/resume, PNG export, clean view, keyboard shortcuts and reduced motion. Responsive navigation was checked at 320, 390, 768, 844, 1024 and 1440 pixels; the six studies include 320-pixel and 390-pixel checks.

### Existing Matrix suite failures

Both assertions also fail using the original builders/templates from the baseline commit. The comparison runner is `baseline_matrix.py`, with output in `baseline-matrix.log`.

1. `Card preview displays both full originals, holds, reverses and exits without jumping`: the legacy preview assertion fails on both versions.
2. `Gallery renders, linked targets exist, and preserved original still renders`: the legacy test expects exactly two gallery cards; the baseline already contains eight.

`matrix-check.log` records the current 21/23 result. The umbrella script stops after this suite, so later suites in that command were not reached. The separate Matrix interface suite and the new atlas navigation suite passed. Effect 01 passed both the pre-change and final runs.

## Screenshots

Paths below are relative to this report. Entry screenshots show the initial exhibition composition; mobile screenshots show the state after exercising the mechanism.

| Experience | Desktop entry | Mobile |
| --- | --- | --- |
| 03 Portal | [portal-entry](browser-http/portal-entry.png) | [portal-mobile](browser-http/portal-mobile.png) |
| 04 Temporal | [temporal-entry](browser-http/temporal-entry.png) | [temporal-mobile](browser-http/temporal-mobile.png) |
| 05 Fluid | [fluid-entry](browser-http/fluid-entry.png) | [fluid-mobile](browser-http/fluid-mobile.png) |
| 06 Optical | [optical-entry](browser-http/optical-entry.png) | [optical-mobile](browser-http/optical-mobile.png) |
| 07 Shadow | [shadow-entry](browser-http/shadow-entry.png) | [shadow-mobile](browser-http/shadow-mobile.png) |
| 08 Folding | [folding-entry](browser-http/folding-entry.png) | [folding-mobile](browser-http/folding-mobile.png) |

Legacy atlas views: [Transport desktop](hall-browser/index-atlas-desktop.png), [Transport mobile](hall-browser/index-atlas-mobile.png), [Matrix desktop](hall-browser/matrix-battle-atlas-desktop.png), [Matrix mobile](hall-browser/matrix-battle-atlas-mobile.png). Restored scene-bar screenshots and the other Matrix mobile views are also in `hall-browser/`. Post-interaction desktop screenshots are in `browser-http/*-desktop.png`.

The desktop/mobile compositions were visually reviewed. Changes from that review include preventing orphaned headline characters, compacting the shadow study's mobile overlays and keeping the mobile atlas visible.

## Implementation files changed

- `assets/studies/atlas/fluid.webp`
- `assets/studies/atlas/folding.webp`
- `assets/studies/atlas/matrix.webp`
- `assets/studies/atlas/optical.webp`
- `assets/studies/atlas/portal.webp`
- `assets/studies/atlas/shadow.webp`
- `assets/studies/atlas/temporal.webp`
- `assets/studies/atlas/transport.webp`
- `dist/folding-theater.html`
- `dist/index.html`
- `dist/liquid-canvas.html`
- `dist/matrix-anime.html`
- `dist/matrix-battle.html`
- `dist/matrix-motion.html`
- `dist/matrix-video.html`
- `dist/optical-vault.html`
- `dist/portal-threshold.html`
- `dist/shadow-apparatus.html`
- `dist/temporal-field.html`
- `index.html`
- `scripts/build.py`
- `scripts/build_atlas_thumbnails.py`
- `scripts/build_matrix.py`
- `scripts/build_studies.py`
- `src/hall/README.md`
- `src/hall/build.py`
- `src/hall/main.js`
- `src/hall/style.css`
- `src/index.template.html`
- `src/matrix/index.template.html`
- `src/showcase.html`
- `src/studies/catalog.json`
- `src/studies/main.mjs`
- `src/studies/page.html`
- `src/studies/style.css`
- `tests/hall_browser.py`
- `tests/studies_browser.py`
- `tests/studies_inline.py`

## Evidence files

- `browser-http/results.json`, `browser-inline/results.json`, `hall-browser/results.json`
- `studies-math.log`, `studies-static.log`, `studies-http.log`, `studies-inline.log`, `hall-browser.log`
- `baseline-effect01.log`, `effect01-check.log`, `effect01-browser.json`, `effect01-handoff.json`
- `baseline_matrix.py`, `baseline-matrix.log`, `matrix-check.log`, `matrix-browser.json`, `matrix-interface.log`, `matrix-interface.json`

This report and the evidence accompany the implementation commit in a separate delivery-record commit on the same branch.
