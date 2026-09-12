---
name: matrix-motion
description: 构建和验证 Matrix Motion 的分层或视频示例，维护共享时间轴、固定点阵和独立页面入口。
---

# Matrix Motion 开发规程

仓库根目录包含 `project.json`。先阅读根目录 `AGENTS.md` 与 [Matrix 文档](../../docs/MATRIX_MOTION.md)。

## 源码与示例

效果 02 的代码在 `src/matrix/`，构建脚本为 `scripts/build_matrix.py`。修改源码后重新构建，不能直接修改嵌入式 HTML。

四个系列分别配置在 `examples/matrix-motion/`、`examples/matrix-video/`、`examples/matrix-anime/` 和 `examples/matrix-battle/`。分层版使用 `composition`，视频版使用 `videos`。页面组件共用同一模板，需验证各系列入口。

效果 01 有独立的渲染器、颜色匹配器和时间轴。修改效果 02 时应保留这些文件和原始媒体。

## 渲染约束

时间定义统一放在 `timeline.js`，JS 与 GLSL 共用点阵包络。格点中心保持固定，两端恢复完整图像，末幕也应连续回到首幕。

局部形变使用 PixiJS MeshPlane 和 MeshRope。定机位比较应能区分镜头、整层位移与局部动作。验证网格翻折、面部比例、零幅度还原及资源释放。Canvas 降级路径应明确说明能力差异。

视频定位是异步操作，截图应等待 `seekAsync()` 或 `snapshotAsync()`。打开档案或导演台时暂停实际视频播放，关闭后恢复先前状态。

## 构建与检查

```sh
python scripts/build_matrix.py --linked
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

预览服务必须指向仓库根目录。检查完整播放、各处接缝、倒拖、暂停、移动布局、上下文恢复与离线请求。纯画面和沉浸模式也应保持可用。

素材生成工具独立于构建流程。凭据使用环境变量，原始提示词与服务任务记录保存在 Git 忽略的本地目录。公共文档只保留使用方式、实现说明和媒体来源，不记录私人对话或个人安装路径。

发布与仓库可见性遵循当前明确授权。任何生成、提交或发布结果都应以实际返回和读回验证为准。
