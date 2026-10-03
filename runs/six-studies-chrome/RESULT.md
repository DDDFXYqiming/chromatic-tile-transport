# Exhibition chrome and local content strips

Date: 2026-10-04
Branch: `feat/visual-lab-six-studies`
Implementation commit: `0a1ac5671441c40fc0c5580fee50e9be332f97e2`.

The header presents eight peer links in one row. Narrow layouts scroll within the navigation pill; the current destination and keyboard focus scroll into view.

Every page starts with its own content strip. Transport retains its MEMORY scenes, and the four Matrix collections retain their MOTION chapters. Studies expose 25 local views and variants through `effect.scenes`:

| Study | Local content |
| --- | --- |
| Portal | 正面门槛 / 穿过画框 / 回头看 / 自动漫游 |
| Temporal | 圆形时间波 / 弯曲时间带 / 水平时间流 / 星轨摆钟 |
| Fluid | 原画颜料 / 双向潮汐 / 环形涡流 / 横向流带 |
| Optical | 默认展品 / 虹彩色散 / 近观镜体 / 清透小镜 |
| Shadow | 0° / 30° / 60° / 90° |
| Folding | 开场姿态 / 折叠 / 半展 / 全展 / 侧面观察 |

The local buttons change camera, sampling, pigment, lens, light or fold state on the current page. Existing controls synchronize the selected card; custom parameter combinations clear the selection. Previous/next buttons wrap within that study. Thumbnails are local 160 × 96 WebP canvas captures, totaling 48,962 bytes.

**八个体验** opens the shared experience atlas through `HALL:ATLAS`. Closing it restores the local footer and opener focus. Space activates focused navigation buttons, and Escape gives an open notes dialog priority before closing the atlas.

All 17 `dist/*.html` pages and the root showcase were rebuilt from source.

## Verification

The browser checks use Playwright's headless shell with repository-root HTTP serving and the offline study harness.

| Check | Result |
| --- | --- |
| `python tests/hall_browser.py` | 1,928 assertions passed across all eight experiences, 17 generated variants and desktop/mobile sizes |
| `python tests/studies_browser.py` | 243 assertions passed, including local state, canvas differences, controls, focus, overlays and export |
| `python tests/studies_browser.py --inline --video-fixture assets/matrix-battle/03-clash.mp4` | 244 assertions passed, including real video decoding |
| `node tests/studies_math.mjs` | 7 checks passed |
| `python scripts/build_studies.py --check` | Generated studies and showcase reproducible |
| `python scripts/check.py --browser` | 8 matcher, 11 timing, 41 Python, 25 browser and 8 handoff checks passed |
| `python scripts/check_matrix.py --browser` with targeted continuation | 5 JavaScript suites, 14 Python checks and all 86 browser checks passed |

Desktop and phone captures were visually reviewed for the top row, local strips and native MEMORY/MOTION footers. Runtime checks exercised playback, pause, reverse seek and actual preset pixel changes.

The legacy Matrix browser checks now expect eight showcase cards and measure preview continuity at the click event, separating continued playback during automation waits from a discontinuity caused by the action. The video overlap check observes decoded-frame growth while both clips are playing instead of assuming a fixed wall-clock delay matches the render clock.

Matrix verification combines the passing Matrix and layer suites from the full runner with successful individual video, anime, battle and interface runs after the fixed-delay video check was corrected.

Detailed results: [hall](hall-browser/results.json), [studies](studies-browser/results.json), [offline studies](studies-inline/results.json), [Matrix suites](legacy-results/matrix.json), [Transport browser](legacy-results/transport-browser.json), [Transport handoff](legacy-results/transport-handoff.json).

Representative captures: [Portal desktop](studies-browser/portal-desktop.png), [Folding phone](studies-browser/folding-mobile.png), [Transport footer](hall-browser/index-modes-1440.png), [Matrix footer](hall-browser/matrix-battle-modes-390.png).
