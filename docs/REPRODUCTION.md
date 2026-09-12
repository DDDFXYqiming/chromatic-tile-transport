# Reproduction

The project is intentionally simple to run. The pages are static files, but the linked preview must be served from the repository root so relative assets and video range requests work.

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer for the JavaScript checks
- Chrome or Chromium for browser checks
- FFmpeg only when exporting a preview video

The normal build uses the Python standard library. `pixi.js` is vendored into the source tree for the linked and offline pages. No CDN is required at runtime.

## Local preview

```powershell
python scripts/serve.py --directory . --port 8765
```

Open `http://127.0.0.1:8765/index.html`. Keep the server pointed at the repository root. The Matrix linked pages are under `dist/`, but they reference `src/` and `assets/` through that root.

## Build pages

```powershell
python scripts/build_showcase.py
python scripts/build_matrix.py --linked
python scripts/build_matrix.py --linked --scenes examples/matrix-video/scenes.json --config examples/matrix-video/config.json --output dist/matrix-video.html
python scripts/build_matrix.py --linked --scenes examples/matrix-anime/scenes.json --config examples/matrix-anime/config.json --output dist/matrix-anime.html
python scripts/build_matrix.py --linked --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle.html
```

For a self-contained page, omit `--linked` and choose an offline output path.

```powershell
python scripts/build_matrix.py --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle-offline.html
```

## Checks

```powershell
$env:PYTHONUTF8 = '1'
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

The Matrix check covers the original layered compositor, the two-shot video page and both five-shot pages. It checks real decoding, bridge continuity, reverse scrubbing, mobile layout, the archive UI and offline requests. The Effect 01 check remains separate so its source and generated page can be compared independently.

The exported MP4s under `reports/` are frame-by-frame captures of the page. They are useful for discussion and review. They are not real-time FPS benchmarks.

## Source boundaries

Effect 01 lives in the root `src/` engine and `scripts/build.py`. Effect 02 lives in `src/matrix/` and uses `scripts/build_matrix.py`. Do not patch generated `dist/*.html` by hand. Rebuild after changing source.
