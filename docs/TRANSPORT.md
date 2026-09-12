# Effect 01 · Chromatic Tile Transport

Effect 01 treats an image transition as a matching problem. The visible stage is divided into a fixed number of cells. Each source cell gets one destination cell, then travels along a deterministic curve while its texture changes near the end of the trip.

The matcher samples the actual visible crop rather than an abstract full image. It compares average cell colour in OKLab, position, local brightness and neighbouring flow. The result is a permutation, so every source cell has one target and every target is used once. The grouping and local exchange steps are approximations chosen to keep the browser responsive. They do not claim a globally optimal assignment.

The timing belongs to `src/timing.js` and is shared with the generated shader code. The usual transition keeps the original image visible long enough to read, opens cells while they are already leaving, and lets cells settle while the next texture fills in. Reverse scrubbing returns to the same numeric state and the same pixels.

`src/matcher.js` is independent of the page and can run in a worker or in Node. `src/transport.js` owns sampling and cached plans. `src/main.js` connects those plans to the WebGL 2 and Canvas 2D paths and to the page controls.

## A small custom gallery

Copy an example scene list and point each `src` at an asset inside the repository.

```powershell
python scripts/build.py --scenes examples/two-images/scenes.json --config examples/two-images/config.json --output dist/two-images.html
```

Each scene can provide a title, English label, two-line caption, accent colour, crop position and local image path. The crop position is `[x, y]` in the range `0..1`; it matters most on a narrow phone viewport.

## Browser interface

Space plays and pauses. The arrow keys change scenes. The wheel, touch drag and timeline scrub through the same seconds-based clock. The settings panel exposes comparison mappings, density, timing, spatial weighting and reduced motion.

## Boundaries

Colour correspondence does not understand people or objects. A strand of hair can match a patch of sky. Different images can have different colour proportions, so some cells must change colour as they settle. The Canvas path keeps the same clock and mapping but is a simplified compatibility renderer.

For build and browser commands, see [Reproduction](REPRODUCTION.md). For media rights, see [Media and licensing](MEDIA_LICENSE.md).
