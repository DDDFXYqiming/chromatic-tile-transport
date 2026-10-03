# New-study media provenance

The three full-size illustrations and six gallery covers in this directory are
original SVG artwork authored as code for this change. They are **not output
from Image Gen, GPT Image, Midjourney, or another image model**. The active chat
had no image-generation function available. SVG sources are included so that the
shipped pages are not empty and do not need external services. The new SVG work
is released under this repository's MIT license; this does not change rights to
any pre-existing media.

| File | Used by | Content |
| --- | --- | --- |
| `quiet-orbit.svg` | Portal / Optical | One moon, two mountain silhouettes, calm water |
| `tidal-garden.svg` | Fluid | One sun, a broad river, two leaves |
| `paper-world.svg` | Folding | A continuous panorama, mountains, sun and arch |
| `*-cover.svg` | Gallery | Concept cover art, not screenshots or video captures |

Temporal uses the **existing** `assets/matrix-battle/03-clash.mp4` by default.
Its license/provenance remains governed by `docs/MEDIA_LICENSE.md` and the
original battle media documentation. No copy or replacement of that file is
included in this change. Local user-selected media is never uploaded.

## Simplified prompts prepared for a later image-model pass

These are prepared prompts, **not claims that generation has run**. The first
implementation remains usable with the bundled original artwork. Generated
replacements can be added later without rewriting the effects.

### Quiet orbit — landscape, 16:10

Minimal editorial illustration. One pale moon, two teal mountain silhouettes,
still water. Five colors, broad flat shapes, a little soft shading, large empty
sky. No people, buildings, text, fine texture, tiny objects or extra decoration.

### Tidal garden — landscape, 16:10

Minimal abstract poster. One terracotta sun, one teal flowing river, two leaves
on warm ivory. Four colors, broad smooth shapes and generous negative space.
No text, realistic textures, tiny patterns or additional objects.

### Paper world — flat frontal panorama, 16:10

Minimal paper-cut illustration. One golden sun, three broad mountain layers,
one simple arch. Ivory, sage, teal and ochre. Flat frontal view. No perspective,
text, ornate decoration, tiny objects or intricate textures.

For replacements, preserve the composition and filenames or update the three
explicit asset references in `src/studies/`. Do not replace a `.svg` with PNG
bytes while retaining its SVG extension. Change the filename and reference.
