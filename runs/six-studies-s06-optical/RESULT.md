# 06 光学展柜 · PHASE / 相界

完成日期：2026-10-04

- 分支：`remodel/s06-optical`
- 基线：`b1fe944`
- Commit SHA：`79921ef9bcbd7de9c648354e86d9983baf3d3688`
- 远端：`origin/remodel/s06-optical`，推送后读回 SHA 一致。
- 提交：[79921ef](https://github.com/DDDFXYqiming/chromatic-tile-transport/commit/79921ef9bcbd7de9c648354e86d9983baf3d3688)
- 入口：`dist/optical-vault.html`，从仓库根目录提供静态服务。

## 重制概览

相界 PHASE 是一台虚构的光学探索设备。同一页面并置黑色机库与白色实验室，把产品介绍和研发手记连成两套对应的叙事。

1. 黑场包含「夜航模组」「边界感知」，介绍探索设备与观察空间的产品构想。
2. 白场包含「光路拆解」「白室校准」，以研发笔记阅读同一设备的镜片与光轴。
3. 四章底栏同步切换画面、标题、正文、观察笔记与信息栏。主按钮和黑白选择器可以跳转到对应世界。
4. 可拖动光学分界比较空间；转场沿同一分界显露新画面和文字。保留暂停、键盘导航、重置、PNG 导出与纯画面模式。
5. 桌面使用宽幅双空间构图，手机使用设备近景与纵向文章；支持减少动态效果设置。

## 素材与实现

内置 Codex Image Gen 生成了两张视角对应的原创空间图，均已随提交保存。

- `assets/studies/optical-black.png` — 黑色机库中的光学设备，1672 × 941。
- `assets/studies/optical-white.png` — 同一设备与视角的白色实验室，1672 × 941。

主要实现位于 `src/studies/optical.mjs`、`optical.css` 和 `catalog.json` 的 optical 条目。构建器接入本页样式与章节数据，章节条修正本页窄屏点击时的提前滚动，`dist/optical-vault.html` 由源码重建。光学分界是画布裁切与局部位移的艺术效果，设备功能与研发记录属于概念叙事。

## 验证

全部浏览器验收使用 Headless Playwright。

| 检查 | 结果 |
| --- | --- |
| `python tests/optical_browser.py` | 156 项通过；浏览器异常 0，失败资源 0 |
| `python tests/studies_browser.py --study optical` | 39 项通过 |
| `python scripts/check_studies.py` | 构建可复现、模块与资源图通过 |
| `node tests/studies_math.mjs` | 7 项通过 |
| `python scripts/check.py --browser` | 全部通过，包括 41 项 Python 测试、matcher 8 项、timing 11 项及原有浏览器验收 |
| Git 范围核对 | catalog 的其他条目一致，提交后工作树干净 |

专用验收覆盖 1440、1024、768、390、320 像素视口，核对完整文案、真实画布差异、播放与暂停、转场中间帧、连续切换、鼠标拖动、键盘分界、移动端阅读、导出、展厅导航及减少动态效果。桌面、手机、纯画面与转场截图已逐项查看。

## 交付截图与记录

- [黑场桌面](review/night-1440.png)
- [白场桌面](review/optics-1440.png)
- [黑场手机](review/night-390.png)
- [白场手机](review/optics-390.png)
- [手机阅读](review/mobile-reading.png)
- [手机纯画面](review/mobile-clean.png)
- [转场中间帧](review/transition-midpoint.png)
- [画布导出](review/export.png)
- [专用检查结果](review/results.json)
- [共享检查结果](shared-review/results.json)
- [原有项目检查日志](legacy-check.log)
