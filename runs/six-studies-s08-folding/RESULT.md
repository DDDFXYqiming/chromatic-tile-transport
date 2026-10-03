# 08 折叠剧场 · 纸间 FOLIO

完成日期：2026-10-04

- Worktree：`D:\AI_Projects\chromatic-wt-s08`
- 分支：`remodel/s08-folding`
- 提交：`b73d05877c72f5bb2c08858341fc9022755f08d3`
- 远端：`origin/remodel/s08-folding`，推送后通过 `git ls-remote` 核对 SHA 一致。
- [查看提交](https://github.com/DDDFXYqiming/chromatic-tile-transport/commit/b73d05877c72f5bb2c08858341fc9022755f08d3)

折叠剧场已改为内容优先的立体旅行刊物。四章分别为「山谷来信」「星夜书签」「潮汐慢页」「灯火归途」。底部章节条带、前后翻页与正文按钮会同步更新原画、标题、旅行手记、纸艺札记、地点与阅读姿态。

暖白纸页将正文与三联画分开排布，手机采用纵向阅读。纸景支持拖动、键盘、展开滑杆、收平与重展，以及可暂停的自动翻页。镜头容纳完整纸网，收平状态的拱门使用明确的覆盖顺序，避免共面遮挡。原画使用完整的 3:2 构图。

## 素材

四张 1536×1024 PNG 由 **Codex Image Gen 内置工具**生成，已保存至 worktree：

- `assets/studies/folding-valley.png`
- `assets/studies/folding-night.png`
- `assets/studies/folding-harbor.png`
- `assets/studies/folding-home.png`

提示词主题为可印在连续三联页上的旅行全景，采用水粉与手工纸拼贴质感，分别描绘山谷植物站、夜间观星台、地中海小港和暮色车站。完整最终提示词、尺寸与 SHA-256 见 [folding-assets.json](../../../chromatic-wt-s08/assets/studies/folding-assets.json)。

## 验证

| 检查 | 结果 |
| --- | --- |
| `python scripts/check.py --browser` | 通过；8 项匹配、11 项时间轴、41 项 Python 测试、25 项浏览器与 8 项交接时序检查 |
| `python scripts/check_studies.py` | 构建可复现，模块与资源完整 |
| `node tests/studies_math.mjs` | 7 项通过 |
| `python tests/folding_browser.py --output <本目录>/browser` | 93 项通过 |
| `python tests/studies_browser.py --study folding --output <本目录>/shared-browser` | 40 项通过 |
| 收平端点复核 | 0%、5%、10%、50%、100% 实际画面已检查 |
| 差异检查 | `git diff --check` 通过；catalog 内容变更仅涉及 folding 条目 |

专用检查覆盖四章图文一致性、暂停、快速切换、循环翻页、PNG 导出、拖动与键盘、八个铰链端点、刚性边长、缩减动画，以及 320 / 390 / 768 / 1024 / 1920 像素布局。最终运行没有未捕获异常或资源请求失败。

共享构建器增加 folding 的样式与章节数据注入，条带的焦点行为增加 folding 分支。页面产物为 `dist/folding-theater.html`。

## 交付证据

- [桌面首章](browser/valley-desktop.png)
- [桌面星夜](browser/night-desktop.png)
- [手机阅读](browser/mobile-reading.png)
- [手机纸景](browser/mobile-paper.png)
- [完全收平](endpoint-0.png)
- [实际播放录像](browser/folding-tour.webm)
- [93 项检查结果](browser/results.json)
- [40 项共享检查结果](shared-browser/results.json)
- 完整构建与旧引擎检查记录位于 `legacy-check/`。

已复核桌面、手机与开合端点截图，并检查实际 WebM 录屏的解码画面。纸景仍采用预设铰链与软件深度排序，属于立体刊物的交互呈现。
