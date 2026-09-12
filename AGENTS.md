# Project entry point for coding agents

Read `skill.md` before changing the effect or generating a new gallery. The repository root is the directory containing `project.json`, not a framework's installed skill directory.

Make source changes under `src/`, never patch the embedded `dist/*.html` directly. Rebuild with `python scripts/build.py`. Run `python scripts/check.py`; for browser changes, also run `python scripts/check.py --browser` and review the handoff screenshots and actual playback.

Keep timing shared between JavaScript and GLSL. A timing-only change must preserve the source-to-target permutation. Retain the user's artwork and theme. The original PNG assets are not licensed as reusable commercial art.

Do not publish, change repository visibility, deploy Pages, install external services, or upload images without an explicit user request. The publisher script supports private repositories.

## Effect 02 / Matrix Motion

For the second effect, also read `skills/matrix-motion/SKILL.md`. Its code lives under `src/matrix/`, its builder is `scripts/build_matrix.py`, and its tests are `scripts/check_matrix.py --browser`. Do not modify the effect-01 source or dist/index.html for an effect-02 task. Root index.html is generated from src/showcase.html by scripts/build_showcase.py. The repository-linked preview must be served from the repository root, not dist alone.
