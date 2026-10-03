# RESULT — 03 / ELSEWHERE

Completed on 2026-10-04 in `D:\AI_Projects\chromatic-wt-s03-door`.

Committed and pushed `cd729f83b76f9ac915c8965c780c819df2fb53cf` to `origin/remodel/s03-door-travel`. The remote branch SHA was read back and matched the local commit.

The generated coastal, forest, night and fjord scenes now occupy a continuous spatial stage. Their imagery covers surrounding scenic surfaces, water and foreground rocks. The existing copper texture is applied to modeled portal frames, with a stone walkway connecting all four environments. Camera travel passes through three open doorways; return travel turns the camera and follows the same route. Chapter text updates at each physical threshold.

At 1536 × 960, the live stage occupies 71.9% of the viewport. Mobile layouts at 390 × 844 and 320 × 740 preserve the main action above the chapter bar. All five generated source PNGs match the asset manifest's SHA-256 hashes.

Validation passed:

- `python scripts/build_studies.py`
- `python scripts/check_studies.py`, including the portal travel checks at 20, 60 and 144 Hz
- `PYTHONUTF8=1 python scripts/check.py --browser`: 8 matcher checks, 11 timing checks, 41 Python tests and 33 browser checks
- Live Chrome forward travel, return across all three doors, pause/pixel stability, interrupted destination selection, reduced-motion navigation, normal and pure-picture views
- Mobile horizontal-overflow and action-clearance checks; final browser console had no warnings or errors

Scenery is rendered on image-based spatial surfaces. Portal frames, the walkway and foreground outcrops use modeled geometry and depth-tested occlusion.

[Commit](https://github.com/DDDFXYqiming/chromatic-tile-transport/commit/cd729f83b76f9ac915c8965c780c819df2fb53cf)

[Local preview](http://127.0.0.1:8763/dist/portal-threshold.html)

[Handoff and evidence](D:/AI_Projects/chromatic-wt-s03-door/runs/six-studies-s03-door/r7/HANDOFF.md)

[Runtime checks](D:/AI_Projects/chromatic-wt-s03-door/runs/six-studies-s03-door/r7/checks.json)

![Desktop stage](D:/AI_Projects/chromatic-wt-s03-door/runs/six-studies-s03-door/r7/01-tidal-stage.jpg)
