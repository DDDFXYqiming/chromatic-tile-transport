# 04 时差场 · 留刻 AFTERLIGHT

Date: 2026-10-04

Implementation commit: **`823e215787140d6ce1789df32dae689d0eadb18f`**

Base commit: `5ed39c5245f1a6f4be93f33d996f2dd4591b9067`

Branch: `feat/visual-lab-six-studies`

Remote: `origin` · `https://github.com/DDDFXYqiming/chromatic-tile-transport.git`

This report and its acceptance evidence follow the implementation in a separate
documentation commit on the same branch.

## Content

Page 04 presents **留刻 / AFTERLIGHT**, a fictional image-journal product.
Five chapters follow a journey from sunset to the following morning. Each local
strip selection changes the painting, headline, body, English eyebrow, Chinese
kicker, product feature, explanatory paragraph, field note, annotation, location,
time, accent, CTA and active thumbnail together.

| Chapter | Headline | Content and visual treatment |
| --- | --- | --- |
| 余光采样 | 把最后一束光，多留一会儿。 | Collect sunset at a hilltop observatory; concentric regions revisit earlier camera positions. |
| 街角切片 | 一条街，几种经过。 | Arrange a rainy tram-stop memory; rectangular slices hold different moments. |
| 流动备忘 | 风经过的地方，让画面继续。 | Turn a coastal walk into a moving note; horizontal time bands introduce video playback. |
| 记忆叠层 | 重叠的瞬间，长出新的细节。 | Compare moments in a glass conservatory; offset translucent exposures reveal small changes. |
| 重返此刻 | 收好昨天，把今天打开。 | Return to a dawn studio; temporal depth returns to zero and the composition becomes whole. |

`src/studies/catalog.json` owns the complete chapter content. The builder embeds
it into `dist/temporal-field.html`. Rendering lives in `src/studies/temporal.mjs`;
the page-specific layout lives in `src/studies/temporal.css`.

The composition combines a full-height painting, elevated editorial copy, a
product journal with three image details, a field note and a chapter timestamp.
On phones these sections form a scrollable article, with the peer navigation
and local chapter strip remaining reachable.

## Motion and interaction

- The 1.6-second transition uses staggered vertical dissolves and a slight camera
  advance. Incoming prose uses the same transition progress as the artwork.
- Every new selection captures the currently displayed canvas, so interrupted
  transitions settle to the most recent chapter.
- The strip, next-page CTA, canvas arrow keys and shape selector choose complete
  chapters. Reset opens **重返此刻**. Paused selections settle immediately.
- **连读五章** advances after 14 seconds of active playback per chapter. Pause
  and reduced-motion entry preserve a readable, still composition.
- Chapter paintings retain their full resolution. Their temporal regions redraw
  the camera path at earlier times; these are animated stills.
- The director retains the existing battle-video example, local MP4/WebM import
  and procedural orbit/pendulum source. Video history uses timestamp-based
  interpolation in a 64-frame, 384 × 216 buffer, capped at 20.25 MiB of pixel data.
  This buffer is populated only for video or procedural playback.
- A failed video returns to the current chapter painting and explains the
  fallback in the director feedback. Local uploads use browser object URLs.

## Generated assets

All five paintings were generated with the **built-in Codex Image Gen tool** and
copied into `assets/studies/` as the original PNG bytes. Each is **1536 × 1024**.
Together they contain 14,384,164 bytes.

| Asset | Chapter |
| --- | --- |
| `assets/studies/temporal-afterglow.png` | 余光采样 · sunset observatory |
| `assets/studies/temporal-street-slices.png` | 街角切片 · rainy tram shelter |
| `assets/studies/temporal-tidal-notes.png` | 流动备忘 · moonlit sea causeway |
| `assets/studies/temporal-memory-layers.png` | 记忆叠层 · glass conservatory |
| `assets/studies/temporal-present-tense.png` | 重返此刻 · dawn studio |

The [asset manifest](../../assets/studies/temporal-assets.json) records every
final generation prompt, dimension, byte size and SHA-256 hash.

## Acceptance

All listed checks passed. Summary: [validation.json](validation.json).
Python checks used `PYTHONUTF8=1` on Windows.

| Check | Result |
| --- | --- |
| `python scripts/build_studies.py --check` | Reproducible generated pages |
| `python scripts/check_studies.py` | Module syntax, resource graph and chapter catalog pass |
| `node tests/studies_math.mjs` | 7 checks |
| `python tests/temporal_browser.py` | 133 checks |
| `python tests/studies_browser.py` | 246 checks |
| `python tests/studies_browser.py --inline --video-fixture assets/matrix-battle/03-clash.mp4` | 246 checks |
| `python tests/hall_browser.py` | 1,928 checks |
| `python scripts/check.py --browser` | 41 Python tests; 8 matcher, 11 timing, 25 browser and 8 handoff checks |

Temporal acceptance covers every chapter at widths 320, 390, 768, 1024 and
1440 px; complete copy synchronization; distinct canvas pixels; decoded
thumbnails; article ordering and non-overlapping text; live intermediate frames;
interrupted transitions; sequential reading; pause; reduced motion; keyboard
selection; real video decoding; cached video resampling; local import; video
failure recovery; reset; and viewport rotation.

Additional browser review confirmed that the mobile product card can be read
between the sticky header and the fixed strip, and that the retained procedural
source produces changing frames. Screenshots and actual playback were visually
reviewed. The final **17.88-second** screen recording traverses all five chapters
and returns to the first.

- Desktop chapters: [余光](temporal-browser/radial-1440.png), [街角](temporal-browser/wave-1440.png), [海堤](temporal-browser/ribbon-1440.png), [温室](temporal-browser/pendulum-1440.png), [晨光](temporal-browser/present-1440.png)
- Phone: [entry viewport](temporal-browser/mobile-entry.png), [scrolled product note](temporal-browser/mobile-notes.png)
- Motion: [transition midpoint](temporal-browser/transition-midpoint.png), [actual playback](temporal-browser/temporal-tour.webm), [playback contact sheet](temporal-browser/tour-review.png)
- Results: [temporal](temporal-browser/results.json), [studies](studies-browser/results.json), [offline studies](studies-inline/results.json), [hall](hall-browser/results.json), [legacy checks](legacy-checks.json), [additional review](temporal-browser/final-review.json)
