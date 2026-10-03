# New-study media provenance

Image Gen ran in the preceding image-generation pass and produced the nine PNG
assets now used by studies 03–08 and their gallery cards. The original generated
files were copied byte-for-byte, ordered by LastWriteTime, into the names below.

| File | Used by | Role |
| --- | --- | --- |
| `quiet-orbit.png` | Optical | Full-size illustration |
| `tidal-garden.png` | Fluid archive | Original full-size illustration |
| `paper-world.png` | Folding | Full-size panorama |
| `portal-cover.png` | Gallery / Portal | Concept cover |
| `temporal-cover.png` | Gallery / Temporal | Concept cover |
| `fluid-cover.png` | Gallery / Fluid | Concept cover |
| `optical-cover.png` | Gallery / Optical | Concept cover |
| `shadow-cover.png` | Gallery / Shadow | Concept cover |
| `folding-cover.png` | Gallery / Folding | Concept cover |

The source generation batch is `01a1028b-833e-7220-b7f4-cfbfa9a505fd`.
These images are AI-generated illustrations and concept covers, not browser
screenshots or video captures. Their dimensions, source filenames and SHA-256
checksums are recorded in `runs/six-studies-image-pass/RESULT.md`.

The earlier code-authored SVGs remain as unused original source artwork under
the repository's MIT license. That license statement concerns those SVGs;
pre-existing media retains its own rights and provenance. See
`docs/MEDIA_LICENSE.md` for the repository's media guidance.

Temporal continues to use `assets/matrix-battle/03-clash.mp4` by default.
Its provenance remains governed by the original battle media documentation.

## ELSEWHERE / portal chapter art

The 2026-10-04 portal remodel adds five assets generated with the built-in Codex
Image Gen tool. The source PNGs were copied unchanged into this directory.
`portal-assets.json` records their dimensions, byte sizes, SHA-256 hashes and roles.

| File | Role |
| --- | --- |
| `portal-tidal-archive.png` | Dawn tidal cove and patinated doorway; spatial capture chapter |
| `portal-canopy-frequencies.png` | Layered rainforest, stream and bronze doorway; layered listening chapter |
| `portal-night-coordinates.png` | Volcanic lake, stars and engraved doorway; location journal chapter |
| `portal-slow-expedition.png` | Aurora fjord and stone threshold; guided expedition chapter |
| `portal-patina.png` | Blue-green aged copper material for projected jambs and threshold slabs |

These are generated environment illustrations and a material texture for the
fictional ELSEWHERE product story. The four chapter illustrations also supply
the portal's local filmstrip thumbnails.

## INKFIELD / fluid chapter art

The 2026-10-04 material-journal edition adds four original 1536 × 1024 PNGs,
generated with the built-in Codex Image Gen tool and copied unchanged.
`fluid-assets.json` records the final creative prompts, dimensions, byte sizes
and SHA-256 hashes. These are artistic illustrations for a fictional journal.

| File | Chapter |
| --- | --- |
| `fluid-mineral.png` | 山石取色 · mineral facets and ground pigment |
| `fluid-ink.png` | 墨的呼吸 · indigo suspended in water |
| `fluid-paper.png` | 纸上潮汐 · terracotta wash on handmade paper |
| `fluid-light.png` | 光里显色 · translucent amber sheets in sunlight |

The same four images supply the local chapter strip. The original gallery
cover remains in use. Runtime flow and chapter transitions are rendered by the
page from these still images.
