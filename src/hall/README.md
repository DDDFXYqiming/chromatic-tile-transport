# Shared exhibition shell

The gold emblem, dark palette, serif display type, translucent telemetry and thumbnail atlas follow the existing Transport header/filmstrip in `src/style.css` and the Matrix interface in `src/matrix/style.css`.

`build.py` renders the header and eight-destination atlas for all three builders. The first two destinations are Transport and Matrix Battle; studies 03–08 come from `src/studies/catalog.json`. Every destination is an ordinary relative link, including previous/next wraparound. Transport and all Matrix collections retain their scene timelines and expose an **八个体验** button in the bottom bar. **返回当前影像** restores the original scene controls.

Every page opens with its own content filmstrip. The studies provide camera views, time fields, pigment seeds, optical looks, light angles and paper poses through `effect.scenes`. These buttons apply real module state; manual controls update the selected card, with no selection for custom parameters. The **八个体验** control opens the shared atlas, and **返回当前影像** or Escape returns to local content. The top pill contains eight peer links in one horizontal row, each opening its experience directly. The pill and content strips scroll horizontally on narrow screens and keep the active item in view. The study header controls playback, clean view (`H`) and the notes dialog; notes pause and restore the previous playback state. `SPACE` toggles playback while the canvas retains its existing arrow-key controls.

Focused shell links and buttons retain native keyboard activation. Space opens or closes the atlas without changing playback, and closing restores focus to **八个体验**. When a notes dialog is open, Escape closes that dialog first.

The 160 × 96 WebP thumbnails in `assets/studies/atlas/` are resized crops of existing covers, built with `python scripts/build_atlas_thumbnails.py`. Their source artwork and existing rights remain those of the corresponding assets. Offline Transport/Matrix builds embed these small thumbnails and the shell; linked builds use repository-relative thumbnail paths.

Study content thumbnails in `assets/studies/filmstrip/` capture the actual canvas at each preset. Rebuild the studies, then run `python scripts/build_study_thumbnails.py` to refresh them with headless Chromium and Pillow. Runtime pages use those local WebP files without browser automation dependencies.

Run `python scripts/build_studies.py`, the corresponding legacy builders, `node tests/studies_math.mjs`, `python tests/studies_browser.py` and `python tests/hall_browser.py` from the repository root. The inline study harness also includes the shared shell and thumbnails.
