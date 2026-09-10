---
name: chromatic-visual-lab
description: 在一个仓库内选择并构建两套独立网页效果：01 OKLab 寻色格片迁移；02 Matrix Motion 固定点阵、镜头与双色线稿显影。
---

# 双效果路由 · 给智能体的项目入口

先定位包含 `project.json`、`src/`、`scripts/` 的真实仓库根目录，读取 `AGENTS.md` 与 `README.md`。本文件是路由入口；两套引擎有不同的不变量，不可互相套用。

## 效果 01：寻色格片迁移

用户提到「格片搬家、颜色匹配、OKLab、一对一配对、Bézier 轨迹、旧版停顿」时，读取 **`skills/chromatic-tile-transport/SKILL.md`** 的完整原版规程和 `README-transport.md`。

入口 `dist/index.html`；构建 `python scripts/build.py`；验收 `python scripts/check.py --browser`。

## 效果 02：Matrix Motion

用户提到「固定点阵、数字化扫描、双色、色阶、线稿、镜头编排、参考视频」时，读取 **`skills/matrix-motion/SKILL.md`** 和 `docs/MATRIX_MOTION.md`。

入口 `dist/matrix-motion.html`；构建链接版 `python scripts/build_matrix.py --linked`；构建离线版省略 `--linked` 并指定输出；验收 `python scripts/check_matrix.py --browser`。

第二套不能修改第一套的渲染器、matcher、时间轴或 `dist/index.html`。第一套格片需要一对一迁移，第二套格点必须固定；这两项约束不冲突，各自只作用于对应引擎。

## 展厅与共同约束

`python scripts/build_showcase.py` 从 `src/showcase.html` 生成根 `index.html`。使用 `python scripts/serve.py --directory .` 服务整个仓库，而非仅 dist。

沿用用户指定素材；只有用户明确要求制作或替换时才生成新素材。不把静态截图当可运行网页。改源码后构建，做真实图像、播放和交互验收，不能以增加特效掩盖空白或接缝错误。发布前保留原版文件并核实 Git 差异；不要强推、公开私密仓库或部署服务。只在远端提交读回成功后报告已推送。

**维护说明：** 旧 `scripts/sync_skill.py` 仅适用于单技能 V3.1；当前根文件是路由，不要用它覆盖 `skills/chromatic-tile-transport/SKILL.md`。两套完整技能分别维护在各自目录。
