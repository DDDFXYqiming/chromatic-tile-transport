# Documentation

The root README is meant to help someone understand the project and open the demo. The details live here.

## Start here

- [Reproduction](REPRODUCTION.md) covers the local server, builds, checks and offline pages.
- [Media and licensing](MEDIA_LICENSE.md) explains what the code license covers and what still needs separate permission.
- [Transport notes](TRANSPORT.md) documents the colour-driven tile engine in Effect 01.
- [Matrix Motion notes](MATRIX_MOTION.md) explains the fixed grid, shared timeline and display modes.
- [Layered motion](LAYERED_MOTION.md) covers the original garden composition and PixiJS mesh path.
- [Video motion](VIDEO_MOTION.md) covers local video decoding, bridge timing and deterministic scrubbing.
- [Matrix interface](MATRIX_INTERFACE.md) records the shared gallery, archive and director-panel layout.

## Asset and prompt records

- [Aozora Drift](ANIME_MOTION.md) records the five-shot anime study and its review limits.
- [Crimson Edge](BATTLE_MOTION.md) records the five-shot battle study and its review limits.
- [PixiJS skill notes](PIXI_SKILLS.md) records the upstream skill selection and the APIs used in the mesh compositor.
- [Visual guide](MATRIX_VISUAL_GUIDE.md) and [prompt log](MATRIX_PROMPT_LOG.md) keep the visual direction and handoff decisions in one place.

The generation records are kept beside their assets under `assets/matrix-video/`, `assets/matrix-anime/` and `assets/matrix-battle/`. The browser never submits a generation request while playing a page.
