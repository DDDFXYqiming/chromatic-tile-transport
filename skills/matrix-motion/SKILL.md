---
name: matrix-motion
description: 使用同一仓库内静态图片构建第二套 Matrix Motion 网页，进行镜头推进、双色/色块/线稿显影与固定点阵快速桥接；保留第一套寻色迁移并做实际浏览器验收。
---

# Matrix Motion · 第二套效果操作规程

当前默认是“浮光花园”分层素材。先读 `docs/LAYERED_MOTION.md` 与 `examples/matrix-motion/` 下的配置和清单。默认 4 张素材、5 个独立实例、3 镜头、12 秒；`original` 模式先验收基础镜头，`auto` 再启用显影与点阵。素材生成仅在用户明确授权时进行。

## 先选对引擎

本技能仅作用于效果 02。用户说「固定点阵、数字化、线稿、双色、参考视频、镜头编排」时使用本技能；用户说「格片搬家、颜色匹配、OKLab、Bézier」时使用根目录 `skill.md` 的效果 01 流程。

寻找含 `project.json`、`src/matrix/timeline.js`、`scripts/build_matrix.py` 的真实仓库根目录。不要把技能安装目录当项目根目录。先读 `docs/MATRIX_MOTION.md`、当前配置和素材清单。

**不要修改第一套的 `src/main.js`、`src/matcher.js`、`src/transport.js`、`src/timing.js`、`src/style.css` 或 `dist/index.html`。** 第二套不能套用第一套的颜色置换验收。第二套的不变量是格点屏幕位置固定，跨图只改变采样颜色、翻转形状、亮度与显隐。

## 输入和构建

默认素材位于 `assets/matrix-botanical/`，相机关键帧在 `examples/matrix-motion/scenes.json`，图层参数在同目录 `config.json`。要测试旧星铁模式，显式传入 `examples/starrail/scenes.json` 和 `examples/matrix-motion/starrail.config.json`。新素材另建清单；`src` 相对于清单，必须留在仓库内。配置复制 `examples/matrix-motion/config.json`，将 `focus` 中的键改成新清单的 slug；不要给新图片留下旧场景焦点。焦点坐标是人为构图参数，不是 AI 识别结果。

```sh
python scripts/build_matrix.py --scenes examples/my-scenes/scenes.json --config examples/my-scenes/matrix.json --output dist/my-matrix.html
```

默认构建离线单文件；`--linked` 生成引用仓库 src/assets 的小入口，需用 localhost。不能直接修改嵌入式成品。

默认展厅的构建及服务：

```sh
python scripts/build_matrix.py --linked
python scripts/build_showcase.py
python scripts/serve.py --directory . --port 8000
```

打开仓库根 `/index.html`，确认两张效果卡片都能进入；旧版没有被新页面覆盖。不要启动公网隧道或部署 Pages，除非用户明确要求。

## 参数调整顺序

1. 先验收 `mode: auto` 的完整一幕，确认场景焦点，桌面和手机主体都仍可见。
2. 再调 `zoom`（默认 1.65）和 `parallax`（默认 0.65）。后者仅为焦点局部变形，不等价于真实主体分层。
3. 统一美术语言用 `palette: ice`；逐图配色用 `scene`；黑白用 `mono`。
4. 数字桥用 `bridgeSeconds`，建议 0.36–0.72 秒。调整 `shotSeconds` 不得连带拉长数字桥。
5. 最后调 `density`（默认 144 列），不是增加飞散路径。禁止重新接入 matcher 后将长距离迁移描述成原地扫描。

所有阶段定义只在 `src/matrix/timeline.js`。JS 计算秒制时钟和阶段，将参数交给渲染器；不要在 GLSL/Canvas 中另写一份镜头时间表。色彩、形状的局部扫描包络在 renderer 中，必须两端回到完整图像，不能加全屏白闪来掩盖错误接缝。

## 调试与验收

```sh
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

后者确保原效果没有被破坏。新测试确认构建 02 不会修改 01 的文件；01 的颜色配对基线仍由原回归检查。分层模式另检查真实 alpha、独立运动、三个镜头接缝、倒拖、图层开关与离线资源。

浏览器中等待 `MatrixMotion.getState().ready`，确认 `engine === 'WEBGL 2'`、`glError === 0`、warnings 为空。不能让 WebGL 编译失败后静默退到 Canvas，却宣称主效果已验证。

```js
MatrixMotion.pause();
MatrixMotion.seek(1.4);    // 全彩
MatrixMotion.seek(2.7);    // 色阶
MatrixMotion.seek(4.1);    // 双色
MatrixMotion.seek(4.95);   // 线描过程中
MatrixMotion.seek(6.56);   // 固定点阵桥
MatrixMotion.seek(6.8);    // 下一幕线描
```

`seek` 单位是全片秒数。对五个桥接均采样，确认没有黑屏、白屏、停帧或明显跳切。尤其比较 `(i+1)*shotSeconds-0.00001` 与下一幕起点，以及最后一幕回到第一幕。

逐项检查：五种显影结果不同；倒拖回同一时间像素一致；暂停不增加 drawCount；更改整幕时长后 bridge 中点仍位于结束前半个 bridgeSeconds；设置按钮、时间轴、触摸、沉浸和 Escape 可用；390/320px 手机及横屏无横向溢出；系统减少动态停止自动播放；恢复 WebGL 上下文后正常；独立离线成品不请求 CDN、模型或网络图片。

必须打开实际截图并观察播放，不只看测试布尔值。Canvas 2D 兼容路径的有限色阶画布和固定点阵只能作为简化效果，不得声称具有同样的局部视差和逐像素 shader 一致性。

## 交付

提供源代码、配置、脚本、README 更新、技能入口和本轮测试结果。需要视频时用 `scripts/render_matrix_preview.py` 从页面逐帧导出，注明并非实时 FPS 测试。不把旧报告当新报告，也不把美感写成量化还原率。

用户授权写入 GitHub 后，采用保留原文件的增量提交；先核实最新 HEAD，冲突时重新读取，禁止 force-push。保留仓库可见性，不创建公开部署。只有远端提交及读回验证成功后才说“已推送”。
