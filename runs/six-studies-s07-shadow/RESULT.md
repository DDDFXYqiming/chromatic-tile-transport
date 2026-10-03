# 07 影子机关 · PENUMBRA

已完成并推送。远端分支读回 SHA 与本地提交一致，工作区干净。

- 分支 `remodel/s07-shadow`
- 提交 `af4c6b53fec38601402983cf34d644a7c578bf28`
- [查看提交](https://github.com/DDDFXYqiming/chromatic-tile-transport/commit/af4c6b53fec38601402983cf34d644a7c578bf28)
- 页面 `dist/shadow-apparatus.html`

## 页面内容

「半影 PENUMBRA」是虚构的光影设计刊物，包含轮廓的开场、边界的温度、深处的秩序、第二种答案四篇设计札记。每篇包含主文、设计观察、图注和对应的光学实验说明。底部缩略图、前后按钮与正文入口同时切换配图、文字和光源预设。

上方是完整图文，下方是固定实体与实时投影实验。支持光位滑杆、月牙与菱形对齐、视角拖动、键盘控制、光源扫描和 PNG 投影导出。巡航每 18 秒翻篇；阅读计时使用实际可见时间，暂停和后台状态停止计时。手机端按图、正文、札记、实验的顺序阅读。

## 素材

通过内置 Codex Image Gen 生成四张 1536×1024 的光影概念图，已保存于工作树。

- `assets/studies/shadow-silhouette.png` — 铜月牙与暖墙
- `assets/studies/shadow-boundary.png` — 弯曲铜板与明暗边界
- `assets/studies/shadow-depth.png` — 错位金属薄片与冷光
- `assets/studies/shadow-alignment.png` — 菱形雕塑与金色侧光

概念图表达设计氛围。实时实验使用独立计算的 27³ 固定实体，共 3326 个体素和 2172 个表面，月牙与菱形来自同一份几何的方向投影。

## 验证

| 检查 | 结果 |
| --- | --- |
| `python scripts/check_studies.py` | 构建复现、模块、资源与章节字段通过 |
| `node tests/studies_math.mjs` | 7 项通过 |
| `python scripts/check.py --browser`，`PYTHONUTF8=1` | 8 项匹配、11 项时序、41 项 Python、25 项浏览器、8 项交接检查通过 |
| `python tests/shadow_browser.py` | 120 项通过 |
| Git 差异与作用范围 | 12 个文件；catalog 的其他条目逐项比对一致 |

第 07 页使用 Chromium headless 验收，覆盖 320、390、768、1024、1440、1920 像素宽度。验证了正文可读、布局间距、四章素材联动、快速切换、真实时间自动翻章、暂停、减少动态效果、键盘、几何恒定、视角与投影独立、导出及资源加载。截图与录制播放抽帧已人工视觉复核。

## 验收文件

- [120 项检查结果](shadow-browser/results.json)
- [桌面首章](shadow-browser/silhouette-1440.png)
- [桌面第三章完整画面](shadow-browser/depth-1440-plate.png)
- [手机第四章完整正文](shadow-browser/alignment-390-plate.png)
- [实时光学实验](shadow-browser/live-experiment.png)
- [浏览器验收录像](shadow-browser/shadow-playback.webm)
- [投影导出](shadow-browser/exported-projection.png)
- 原有检查证据位于 `baseline-checks/`。

本地预览可在工作树根目录运行 `python scripts/serve.py --directory . --port 8767`，访问 `http://127.0.0.1:8767/dist/shadow-apparatus.html`。
