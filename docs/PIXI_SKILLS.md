# 本轮采用的 PixiJS Skills

2026-09-10 搜索与安装。用户要求优先复用成熟 Skill，并继续尝试不使用视频生成模型的局部动画。

## 选择依据

比较过 [Three.js Animation](https://www.skills.sh/cloudai-x/threejs-skills/threejs-animation) 和 [PixiJS](https://www.skills.sh/pixijs/pixijs-skills/pixijs)。检索时前者约 14.3K 安装，后者约 5K 安装；这些是平台当时显示的快照，不代表质量评分。PixiJS 技能仓库约 329 stars，底层 PixiJS 库约 48K stars。社区讨论量没有可靠统一指标，不据此宣称排名第一。

本项目是透明 PNG 的二维局部形变，已有 WebGL 后期转场，因此采用 PixiJS 官方团队维护的 [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills)。其中的 MeshPlane 和 MeshRope 可以直接处理已有素材。Three.js 动画 Skill 更偏向三维场景、骨骼与关键帧。此次未找到经过核实、可以将当前任意 PNG 一键转换成完整 Live2D 模型的成熟 Skill。

## 实际安装

后续按用户要求整合为单入口 **PixiJS 全量版**，当前只安装 `C:/Users/39795/.codex/skills/pixijs/`。它包含该修订的全部 81 个仓库文件和 26 个专题文档，含非 skills 目录内容；专题入口改为 `GUIDE.md` 并修复本地链接，原始文件另存归档。根 `SKILL.md` 按需路由，不再单独安装下列专题。旧的七个目录已备份到扫描目录外。可移植整合包、重建脚本和核验方法一起保存在仓库的 [tools/pixijs-skill](../tools/pixijs-skill/README.md)，项目移动后不依赖原对话目录中的文件。

以下是最初安装记录，保留用于追溯本轮实现的方法来源。

通过 Codex 的 `skill-installer` 安装官方仓库中七个目录，固定到提交 `6aae70d76cf410432dd144029c07a1ad4bb12793`。安装位置在 `C:/Users/39795/.codex/skills/`。

- `pixijs`
- `pixijs-scene-mesh`
- `pixijs-scene-core-concepts`
- `pixijs-application`
- `pixijs-assets`
- `pixijs-performance`
- `pixijs-scene-sprite`

本次已直接读取并按其方法实现；安装后的自动技能发现从后续会话加载。

## Skill 方法如何落到项目里

| 官方方法 | 本项目使用 |
|---|---|
| MeshPlane 创建规则网格，修改 `aPosition` buffer 后 `update()` | 人物 37 × 49 顶点，前后花枝各 29 × 29 顶点 |
| MeshRope 使用中心线 points 并更新几何 | 游鱼 25 个中心线点，身体向尾端逐渐加大摆幅 |
| Application 异步初始化，明确 ticker 生命周期 | 两个离屏合成面，关闭 Pixi 自动 ticker，由原有时间轴主动 render |
| Sprite、Texture、资源所有权 | 背景 Sprite；复用已解码图片创建独立纹理；恢复上下文时销毁并重建 |
| 性能与缓存 | 预计算空间权重、复用顶点数组和纹理、合成面上限 120 万像素、暂停时不连续重绘 |

代码见 `src/matrix/mesh.js`、`src/matrix/deformation.js` 和 `src/matrix/layers.js`。网格拓扑、纹理映射、着色、三角形绘制由 PixiJS 负责；人物区域权重与动作曲线是针对这四张素材编写的适配。不是通用自动绑定，也没有重新编写一套网格渲染器。

运行库固定 `pixi.js@8.20.1`。`src/vendor/pixi-8.20.1.min.js` 来自 npm 官方包的 `dist/pixi.min.js`，许可证为同目录 `PIXI-LICENSE.txt`。`package-lock.json` 固定依赖。需要更新 vendor 时使用 `npm ci --ignore-scripts` 后从该包复制 bundle 与 LICENSE。普通构建使用已提交的 vendor，无需联网或 npm 安装。离线版嵌入本地库；链接版为脚本和样式加内容摘要参数，避免新旧脚本混用。

## 验证及边界

`reports/matrix/deformation.json` 检查最大幅度下网格面积、脸部标记点间距、零幅度还原与循环。`reports/layers/report.json` 包括真实 Pixi 节点、定机位逐层像素对比、关闭形变后时间变化仍保持相同像素、反向拖动、循环接缝、图形上下文恢复、手机布局、兼容降级与离线无外部请求。

`reports/layers/mesh-motion-study.mp4` 是浏览器画面逐帧编码的 6 秒演示，不是视频模型输出，也不是实时 FPS 基准。

人物可做轻微偏头、呼吸、外侧头发及衣料运动。当前单张人物素材没有独立眼皮、口型、手臂与背面，因此未实现眨眼、说话、大转头或重新摆姿。鱼鳍与鱼身仍共用一张纹理。Canvas 2D 兼容路径保留原有分层漂移，并明确禁用局部形变选项。
