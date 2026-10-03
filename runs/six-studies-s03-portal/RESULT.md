# 03 画中门 · 彼处 ELSEWHERE

Date: 2026-10-04

Implementation commit: **`9ddc8eca8b0644134f983403c0a6b6b8d5e54ffe`**

Branch: `feat/visual-lab-six-studies`

Remote: `origin` · `https://github.com/DDDFXYqiming/chromatic-tile-transport.git`

The implementation was pushed successfully. A subsequent `git ls-remote
--exit-code origin refs/heads/feat/visual-lab-six-studies` returned the full
implementation SHA above. This report and its evidence are delivered in a
following documentation commit on the same branch.

## Content and interaction

Page 03 now presents **彼处 / ELSEWHERE**, an invented spatial field journal
product, through four cinematic chapters. A chapter selection updates the
environment artwork, headline, body, kicker, location, field note, product card,
accent, CTA and active filmstrip item together.

| Chapter | Headline | Product story |
| --- | --- | --- |
| 潮汐档案 / Tidal Archive | 推开门，潮汐仍在。 | Collect the direction and distance of surf, rock-pool echoes and coastal wind. |
| 林间频率 / Canopy Frequencies | 穿过林光，听见层次。 | Separate a rainforest into stream, leaf rain and distant wind for layered listening. |
| 夜色坐标 / Night Coordinates | 回望时，星夜有址。 | Keep image, sound and personal writing together in a location journal. |
| 缓慢远行 / Slow Expedition | 留一点时间，让远方发生。 | Connect collected places into a slow, guided expedition. |

`src/studies/catalog.json` owns the complete chapter copy and scene metadata.
The builder embeds it into `dist/portal-threshold.html`. Portal-specific layout
lives in `src/studies/portal.css`; the renderer is `src/studies/portal.mjs`.

The 1.2-second transition combines a forward-moving dissolve, an expanding
threshold outline and prose opacity driven by the same progress value. Guided
roaming advances through complete chapters after 12 seconds of active playback.
Paused selection and reduced-motion selection settle immediately. The CTA turns
to the next chapter. Pointer focus on the mobile strip waits until selection
before centering a thumbnail, and the peer navigation stays visible while the
longer mobile composition scrolls.

The environment artwork fills the stage. Patinated jambs and threshold slabs
use perspective projection at desktop sizes; portrait framing gives the scene
and copy the full width. Product audio capabilities are fictional concept copy;
the delivered experience presents visual chapters.

## Generated assets

Generated with the **built-in Codex Image Gen tool**, copied as original PNG
bytes into `assets/studies/`. Full byte sizes and SHA-256 hashes are recorded in
[portal-assets.json](../../assets/studies/portal-assets.json).

| Asset | Dimensions | Use |
| --- | --- | --- |
| `portal-tidal-archive.png` | 1536 × 1024 | Dawn tidal cove, copper doorway, chapter 01 and its thumbnail |
| `portal-canopy-frequencies.png` | 1536 × 1024 | Mossy rainforest, bronze doorway, chapter 02 and its thumbnail |
| `portal-night-coordinates.png` | 1536 × 1024 | Volcanic lake, stars, engraved doorway, chapter 03 and its thumbnail |
| `portal-slow-expedition.png` | 1536 × 1024 | Aurora fjord, stone threshold, chapter 04 and its thumbnail |
| `portal-patina.png` | 1254 × 1254 | Aged copper texture for projected architectural surfaces |

## Validation

All listed suites passed. Machine-readable summary: [validation.json](validation.json).
Python checks used `PYTHONUTF8=1` on Windows.

| Check | Result |
| --- | --- |
| `python scripts/build_studies.py --check` | Reproducible generated pages |
| `python scripts/check_studies.py` | Module syntax, resources and gallery graph pass |
| `node tests/studies_math.mjs` | 7 checks |
| `python tests/portal_browser.py` | 104 checks |
| `python tests/studies_browser.py` | 243 checks |
| `python tests/studies_browser.py --inline --video-fixture assets/matrix-battle/03-clash.mp4` | 244 checks |
| `python tests/hall_browser.py` | 1,928 checks |
| `python scripts/check.py --browser` | 41 Python tests; 8 matcher, 11 timing, 25 browser and 8 handoff checks |

Portal acceptance covers all four chapters at widths 320, 390, 768, 1024 and
1440 px; exact title/body/kicker/product-note synchronization; distinct canvas
pixels; thumbnail decoding; intermediate transition frames; interrupted
transitions; CTA navigation; automatic chapter rollover; pause; reduced motion;
keyboard selection; and portrait navigation after landscape footer use.

Headless Chromium screenshots and recorded playback were visually reviewed.
The final 15.92-second tour shows all four chapters and the return to the first.

- [Desktop tide](portal-browser/threshold-1440.png), [forest](portal-browser/through-1440.png), [night](portal-browser/return-1440.png), [expedition](portal-browser/roam-1440.png)
- [Mobile tide](portal-browser/threshold-390.png), [forest](portal-browser/through-390.png), [night](portal-browser/return-390.png), [expedition](portal-browser/roam-390.png)
- [Transition midpoint](portal-browser/transition-midpoint.png)
- [Actual playback](portal-browser/portal-tour.webm) and [playback contact sheet](portal-browser/tour-review.png)
- [Portal results](portal-browser/results.json), [native studies results](studies-browser/results.json), [offline studies results](studies-inline/results.json), [hall results](hall-browser/results.json)
