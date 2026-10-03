# 05 液态画布 · 洇 INKFIELD

Date: 2026-10-04

Implementation commit: **`7ecb141ccd74343eec59b7a9e10cde40d3e1113e`**

Base commit: `6b9d99ae270bce5bebb0d3d742b1516e9bfa6df6`

Branch: `feat/visual-lab-six-studies`

Remote: `origin` · `https://github.com/DDDFXYqiming/chromatic-tile-transport.git`

This report and the acceptance evidence accompany the implementation in a
following documentation commit on the same branch.

## The finished page

Page 05 presents **洇 / INKFIELD**, a fictional digital material journal.
Its first issue follows colour from mineral grain through ink and paper to
transmitted light. Each chapter contains an opening essay, a material note,
three named colour samples, a worktable observation and a relevant invitation
to try the pigment interaction.

| Chapter | Headline | Reading and visual subject |
| --- | --- | --- |
| 山石取色 | 一抹青，从山石开始。 | Mineral facets, ground pigment and the origin of a colour palette |
| 墨的呼吸 | 一滴落下，蓝开始呼吸。 | Indigo in water, differences in concentration and persistent currents |
| 纸上潮汐 | 水走过，纸记住了。 | A terracotta wash, paper fibres, branching edges and negative space |
| 光里显色 | 最后一层，交给光。 | Amber sheets, overlapping colour and changing illumination |

The bottom strip selects complete chapters. Artwork, title, body, English
eyebrow, chapter number, material, feature paragraph, colour samples, note,
interaction hint, accent and next-chapter action change together. The hero
action, strip arrows and canvas arrow keys use the same chapter selection.

The layout combines full-size artwork with an editorial column and a material
card. On phones these become a scrollable article. The header and chapter strip
remain reachable while reading the full card and observation.

## Motion and interaction

- A nominal **2.2-second** organic wash reveals the next chapter. Its soft,
  undulating mask and the arriving prose share one transition clock. The
  outgoing canvas is captured on each selection, including interrupted moves.
- Reading and transitions use elapsed visible playback time. Pausing freezes
  the reading clock; paused chapter selections settle immediately. The fluid
  solver retains its fixed **1/60-second** steps, with at most three per frame.
- **连读四章** advances every **18 seconds** of active playback. Manual chapter
  selection and pigment interaction return to manual reading.
- Reading draws the original high-resolution paintings directly. Dragging or
  **轻推颜料** transports a **144 × 96** source-coordinate field using a
  **96 × 64** velocity grid and 20 pressure-projection iterations. WebGL samples
  the artwork through that field, retaining texture detail during deformation.
- Each chapter supplies its own initial flow and momentum decay. Released
  momentum continues moving the image. **重置** restores the current chapter's
  original artwork and clears its velocity field.
- The 2D fallback samples the same coordinate field into a canvas bounded by
  **432 × 288**. Local PNG/JPEG/WebP import, PNG export, clean view and reduced
  motion remain available.

The chapter images are generated stills. Camera movement, transitions and
interactive flow animate them at runtime. The flow is an artistic 2D model;
extended advection can stretch texture details.

## Generated assets

All four paintings were generated with the **built-in Codex Image Gen tool**.
Original PNG bytes were copied into the workspace unchanged. Each image is
**1536 × 1024**; the four files total **10,289,030 bytes**.

| Saved asset | Chapter |
| --- | --- |
| [assets/studies/fluid-mineral.png](../../assets/studies/fluid-mineral.png) | 山石取色 |
| [assets/studies/fluid-ink.png](../../assets/studies/fluid-ink.png) | 墨的呼吸 |
| [assets/studies/fluid-paper.png](../../assets/studies/fluid-paper.png) | 纸上潮汐 |
| [assets/studies/fluid-light.png](../../assets/studies/fluid-light.png) | 光里显色 |

The [asset manifest](../../assets/studies/fluid-assets.json) contains the full
final generation prompt set, dimensions, byte sizes, chapter roles and SHA-256
hashes. These images also supply the four local strip thumbnails.

## Source and build

- [catalog.json](../../src/studies/catalog.json) owns the chapter content.
- [fluid.mjs](../../src/studies/fluid.mjs) owns chapter state, copy, flow and transitions.
- [fluid.css](../../src/studies/fluid.css) owns the page-specific editorial layout.
- [build_studies.py](../../scripts/build_studies.py) embeds the chapter catalog
  and stylesheet reference into [liquid-canvas.html](../../dist/liquid-canvas.html).
- The local strip's focus handling includes fluid chapters, keeping pointer
  targets stable during mobile selection while revealing keyboard focus.

Rebuild with `python scripts/build_studies.py`. Serve the repository root with
`python scripts/serve.py --directory . --port 8765` and visit
`http://127.0.0.1:8765/dist/liquid-canvas.html`.

## Acceptance

All final checks passed. Machine-readable summary: [validation.json](validation.json).
Python checks ran with `PYTHONUTF8=1`.

| Check | Result |
| --- | --- |
| `python scripts/build_studies.py` and generated-output check | Rebuilt; reproducible |
| `python scripts/check_studies.py` | Module syntax, resources, chapter content and asset references pass |
| `node tests/studies_math.mjs` | 7 checks |
| `node tests/fluid_math.mjs` | Still field, persistent advection, finite bounds, 16-bit encoding and reset pass |
| `python tests/fluid_browser.py` | [119 checks](fluid-browser/results.json) |
| `python tests/studies_browser.py` | [246 checks](studies-browser/results.json) |
| `python tests/hall_browser.py` | [1,928 checks](hall-browser/results.json) |
| `python scripts/check.py --browser` | 41 Python tests; 8 matcher, 11 timing, 25 browser and 8 handoff checks |

Fluid acceptance covers all chapters at 320, 390, 768, 1024 and 1440 px;
complete text/art synchronization; distinct decoded images; non-overlapping
editorial blocks; interrupted transitions; live camera and pigment playback;
pause and reset; keyboard navigation; guided reading and its paused clock;
local-image import; PNG export; reduced motion; atlas navigation; and the
WebGL-disabled fallback. There were no uncaught runtime exceptions or failed
local assets in the final fluid run.

The shared hall, portal and temporal source/output content matches the base
commit in Git. The studies and hall runs also exercise their live navigation,
chapter selection and rendering. Legacy acceptance preserves all five original
colour assignments and verifies the cyclic handoffs.

## Visual review

Reviewed the four desktop compositions, mobile layouts, a scrolled phone
article, the final wash transition, active pigment deformation and the fallback.
The mobile reading check confirms that both the complete material card and the
observation can sit between the sticky header and bottom strip.

- Desktop chapters: [mineral](fluid-browser/mineral-1440.png),
  [ink](fluid-browser/ink-1440.png), [paper](fluid-browser/paper-1440.png),
  [light](fluid-browser/light-1440.png).
- Mobile chapters: [mineral](fluid-browser/mineral-390.png),
  [ink](fluid-browser/ink-390.png), [paper](fluid-browser/paper-390.png),
  [light](fluid-browser/light-390.png).
- [Mobile reading view](fluid-browser/mobile-reading.png) and
  [visibility measurements](fluid-browser/mobile-reading.json).
- [Pigment flow](fluid-browser/pigment-flow.png) and
  [2D fallback](fluid-browser/fallback.png).
- [Actual 21.6-second browser playback](fluid-browser/fluid-tour.webm),
  [nine decoded playback frames](fluid-browser/playback-review.png) and
  [sample times](fluid-browser/playback-review.json).

The playback review shows each chapter settling with its corresponding copy,
the return to the opening chapter, and persistent pigment movement after the
final interaction.
