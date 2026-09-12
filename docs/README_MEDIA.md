# README video previews

The Chinese and English READMEs share two GitHub video attachments, one per effect.

Effect 01 uses the original transport renderer with an isolated AI-art example in `examples/readme-transport/`. Its inputs are the existing garden composite and the anime close-up. The original game-art demo and renderer are preserved. Effect 02 uses the current Crimson Edge Matrix page, including the header, scene navigation and grid bridges.

The videos are deterministic webpage exports, not recordings used to measure real-time performance. Final H.264 files and the permanent attachment URLs are recorded under `reports/readme/`. The README embeds each permanent GitHub attachment URL as its own paragraph, with blank lines around it.

## Reproduce the exports

Set `CHROME_BIN` to an installed Chrome executable and `FFMPEG_BIN` to FFmpeg when they are not discoverable automatically.

```sh
python scripts/build.py --scenes examples/readme-transport/scenes.json --config examples/readme-transport/config.json --output dist/readme-transport.html
python scripts/render_preview.py --html dist/readme-transport.html --output reports/readme/transport-full.mp4 --pairs 2 --fps 24 --width 1280 --height 800
python scripts/render_matrix_preview.py --battle --duration 21.5 --fps 24 --width 1280 --height 800 --output reports/readme/matrix-full.mp4
```

The final uploads are compressed below 10 MB. The upload method follows the official GitHub CLI attachment client, posting the binary file to GitHub's user-attachment endpoint with the target repository ID. This creates an attachment without creating an issue or posting a comment. No credentials are stored in the repository.

Use the saved attachment URLs again when editing the README. Do not replace them with temporary signed playback URLs or raw repository file URLs, and do not upload duplicate attachments during normal builds.

References are [GitHub attachment documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files) and the [GitHub CLI attachment client](https://github.com/cli/cli/blob/trunk/internal/attachments/client.go).
