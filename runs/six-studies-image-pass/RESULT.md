# Six studies image pass

Recorded 2026-10-04T00:29:48 (Asia/Shanghai).

## Git delivery

- Branch: `feat/visual-lab-six-studies`
- Remote: `origin` / `https://github.com/DDDFXYqiming/chromatic-tile-transport.git`
- Starting commit: `063f968481853f5b595485e3a5a0789aa21811dc`
- Implementation commit: `6108d7e53a5a1e4a1f69bbc5e49e503653255a76`
- This report and its validation artifacts are committed separately on the same branch.

## PNG assets and provenance

Image Gen ran in the preceding generation pass. The nine generated files were
copied byte-for-byte from batch `01a1028b-833e-7220-b7f4-cfbfa9a505fd`,
ordered by LastWriteTime, and renamed into `assets/studies/`.
All nine PNGs are RGB at 1586 × 992 pixels. Source and destination SHA-256
checksums match for every file. Original SVG artwork remains unused.

| Destination | Generated source filename | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `assets/studies/quiet-orbit.png` | `exec-8503d02a-ef33-408c-bf49-108d02983f69.png` | 1136002 | `2791bdba50d73c58050340719d1224a9c1378f4d2f91a615adc32c2c92d16fa6` |
| `assets/studies/tidal-garden.png` | `exec-79a5dc62-0825-40b0-aaa5-682650c16055.png` | 928674 | `2974abb14cce840673b9f698502af556effc2828f22bb3e9a5bf37b1d6a8d11e` |
| `assets/studies/paper-world.png` | `exec-ce0f1b19-7202-4e16-9c38-6ac83e797b46.png` | 2196937 | `effa0f78529b4207d2ea279f2b9db5c8e5dc106a3629cb81612569322e962dda` |
| `assets/studies/portal-cover.png` | `exec-1ade2ef8-b579-4c7d-a598-3a422d1bf37d.png` | 1449662 | `833ecba0de07d7b80d9f2382114e0c291978abb54ad67efa4d19b1500840d1ca` |
| `assets/studies/temporal-cover.png` | `exec-6f6f7fdf-79e0-4a49-aeb9-2d0e9495d438.png` | 1153495 | `bf1fa00c119b642b6d475b99062fb05264e5764467b760419e645d80a6e02c1b` |
| `assets/studies/fluid-cover.png` | `exec-615bc977-addb-47f6-8398-98ae99edbb7d.png` | 891666 | `30c1cdf6de7989a8c1cbd5d9c78c55186302dba8c2e2413d93b61dc8d2ac69a0` |
| `assets/studies/optical-cover.png` | `exec-96c101fc-6615-4ee6-93a3-fe01d4c1706c.png` | 934575 | `a8b642950c88d53c307d9600888c948d2b6984b1103422b2b3028517671e9d4c` |
| `assets/studies/shadow-cover.png` | `exec-58485f57-55b7-4770-b38f-b397f571db43.png` | 1281636 | `0801630d2a8a2e24b3f94778f2e5d935f36795d5192c2b8dc5fda999a881ccde` |
| `assets/studies/folding-cover.png` | `exec-ff8dab49-2070-4e39-ac6d-fd92bd38abc2.png` | 1424905 | `0022766b1128e5ec23eef350630ab04c9046e286e3e0265d75e9e18a1d2bddb1` |

## Changed implementation files

PNG paths replace the earlier SVG references in the study catalog, Portal,
Fluid, Optical, Folding and gallery source. The six study pages and root gallery
were rebuilt from source. The shared provenance text and documentation now
identify the generated illustrations. The offline harness embeds PNG data URLs
with `image/png`, alongside its existing SVG support.

No references to the nine replaced SVG filenames remain in the source,
gallery or generated HTML. Effect-01 and Matrix source/build artifacts have
no changes in the implementation commit.

- `assets/studies/README.md`
- `assets/studies/fluid-cover.png`
- `assets/studies/folding-cover.png`
- `assets/studies/optical-cover.png`
- `assets/studies/paper-world.png`
- `assets/studies/portal-cover.png`
- `assets/studies/quiet-orbit.png`
- `assets/studies/shadow-cover.png`
- `assets/studies/temporal-cover.png`
- `assets/studies/tidal-garden.png`
- `dist/folding-theater.html`
- `dist/liquid-canvas.html`
- `dist/optical-vault.html`
- `dist/portal-threshold.html`
- `dist/shadow-apparatus.html`
- `dist/temporal-field.html`
- `docs/SIX_STUDIES.md`
- `index.html`
- `src/showcase.html`
- `src/studies/catalog.json`
- `src/studies/fluid.mjs`
- `src/studies/folding.mjs`
- `src/studies/optical.mjs`
- `src/studies/page.html`
- `src/studies/portal.mjs`
- `tests/studies_inline.py`

## Validation

Environment: Windows, Python 3.12, Node.js, Python Playwright and Chromium
Headless Shell 151.0.7922.34. Python checks run with `PYTHONUTF8=1`.
Playwright was already installed; its missing headless browser component was
installed. The first download timed out; the automatic retry completed.

| Command / check | Result |
| --- | --- |
| `python scripts/build_studies.py` | PASS; six study pages and root gallery built |
| `python scripts/build_studies.py --check` | PASS; generated output reproducible |
| `node tests/studies_math.mjs` | PASS; 7 tests |
| `python tests/studies_browser.py --output runs/six-studies-image-pass/browser-http` | PASS; 49 checks against HTTP native modules |
| `python tests/studies_browser.py --inline --video-fixture assets/matrix-battle/03-clash.mp4 --output runs/six-studies-image-pass/browser-inline` | PASS; 50 checks, including actual repository-video decoding |
| Headless gallery check | PASS; all six PNG covers decoded at original dimensions, mobile layout fits, no page errors |
| `python scripts/check.py` | PASS; 8 matcher tests, 11 timing tests, 41 Python tests |
| `python scripts/check.py --browser` | FAIL in unchanged effect-01 browser suite; 22 of 25 browser checks passed |
| `git diff --check` | PASS |
| PNG signature/decoding, dimensions and source/destination SHA-256 | PASS; all nine assets |

The initial baseline Python check used the Windows GBK default and encountered
encoding errors. Re-running with `PYTHONUTF8=1` passed all 41 Python tests.

The six-study suites verify initialized frames, stable pause, actual interaction
and playback changes, PNG export, mobile overflow, reduced motion and absence
of uncaught exceptions. HTTP logs confirm requests for the new PNG illustration
paths. Desktop/mobile study contact sheets and the gallery desktop screenshot
were visually reviewed; the six gallery covers and the Fluid, Optical and
Folding illustrations display correctly.

### Effect-01 browser regression failures

The additional legacy suite reported these failures on its unchanged HTML:

- Immersive mode recomputes visible crop correctly
- 390px mobile layout and settings have no horizontal overflow
- Rapid resize does not apply a stale worker result

The wrapper stopped after this browser suite failed, so its subsequent
`tests/browser_timing.py` step was not executed. No legacy rendering or timing
code was edited. The six-study HTTP and inline suites completed successfully.
The legacy details are recorded in `effect01-browser-results.json` and
`base-check-browser.log`.

## Validation artifacts

- `assets.json` — exact copied asset mapping, sizes, dimensions and checksums
- `browser-http/results.json` — 49 passing study checks
- `browser-http/*-desktop.png`, `browser-http/*-mobile.png` — six studies at both viewport sizes
- `browser-inline/results.json` — 50 passing offline checks
- `studies-desktop-contact.png`, `studies-mobile-contact.png` — reviewed study contact sheets
- `gallery-results.json`, `gallery-desktop.png`, `gallery-mobile.png` — cover loading and layout evidence
- `studies-browser.log`, `studies-inline.log` — study test transcripts
- `effect01-browser-results.json`, `base-check-browser.log` — baseline browser limitations
