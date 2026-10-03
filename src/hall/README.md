# Shared exhibition shell

The gold emblem, dark palette, serif display type, translucent telemetry and thumbnail atlas follow the existing Transport header/filmstrip in `src/style.css` and the Matrix interface in `src/matrix/style.css`.

`build.py` renders the header and eight-destination atlas for all three builders. The first two destinations are Transport and Matrix Battle; studies 03–08 come from `src/studies/catalog.json`. Every destination is an ordinary relative link, including previous/next wraparound. Transport and all Matrix collections retain their scene timelines and expose an **八个体验** button in the bottom bar. **返回当前影像** restores the original scene controls.

The studies use the atlas directly. Narrow screens show a horizontally scrollable thumbnail strip with the active experience centered. The top pill opens all eight links. Escape dismisses that menu. The study header controls playback, clean view (`H`) and the notes dialog; notes pause and restore the previous playback state. `SPACE` toggles playback while the canvas retains its existing arrow-key controls.

The 160 × 96 WebP thumbnails in `assets/studies/atlas/` are resized crops of existing covers, built with `python scripts/build_atlas_thumbnails.py`. Their source artwork and existing rights remain those of the corresponding assets. Offline Transport/Matrix builds embed these small thumbnails and the shell; linked builds use repository-relative thumbnail paths.

Run `python scripts/build_studies.py`, the corresponding legacy builders, `node tests/studies_math.mjs`, `python tests/studies_browser.py` and `python tests/hall_browser.py` from the repository root. The inline study harness also includes the shared shell and thumbnails.
