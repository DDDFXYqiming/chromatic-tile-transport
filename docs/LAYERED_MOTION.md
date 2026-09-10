# 浮光花园 · Matrix Motion 分层素材

本版直接制作适合动画的原创素材。人物没有沿用或自动分割星铁人物，而是新生成的角色。原始游戏素材仍留给 01；旧 02 参数另存为 `examples/matrix-motion/starrail.config.json`。

## 素材

四个输入位于 `assets/matrix-botanical/`：

- `background.png`：1672 × 941，留白背景。
- `character.png`：1024 × 1536，透明人物。
- `fish.png`：1536 × 1024，透明游鱼。
- `flowers.png`：1536 × 1024，透明花枝。

程序复用花枝作为远处花枝与近景花枝，形成五个独立图层实例。`preview-*.webp` 与 `cover.webp` 是实际场景渲染出的预览，不是额外生成的关键帧图片。

## 镜头与图层

`examples/matrix-motion/scenes.json` 定义三组相连的相机关键帧。默认每幕 5.2 秒，共 15.6 秒。第一个镜头建立完整构图，第二个靠近人物，第三个先移向留白构图，再返回起始取景形成循环。

每组 `cameraKeys` 的 `p` 从 0 到 1，`x/y` 为归一化焦点，`scale` 是镜头倍率。相邻镜头的末尾和开头相等，避免取景跳变。手机端收敛横向取景并减弱特写倍率。

`config.json` 的 `composition` 定义逻辑画布和图层。每层支持：

| 字段 | 含义 |
|---|---|
| `src` | 相对于配置文件的本地图片 |
| `x/y` | 逻辑画布中的中心点 |
| `height` | 相对逻辑画布高度 |
| `depth` | 镜头移动时该层的相对运动量 |
| `rotation/sway` | 基础旋转与周期摆动角度 |
| `drift` | 自主水平/垂直运动幅度 |
| `phase` | 自主运动相位，避免所有元素同时进退 |
| `opacity` | 图层透明度 |
| `rig` | `none`、`character`、`fish` 或 `plant`，选择本素材适配的局部动作 |
| `rigStrength` | 0–1，单层动作比例，乘以全局幅度 |

各层从同一条时间轴采样，暂停不再推进，反向回到同一进度会复现相同画面。`layerMotion` 比较自主运动的作用；`cameraX/cameraY` 调整构图。深度是平面图层的视觉参数，不是模型产生的真实深度图。

## 渲染与验收

`src/matrix/layers.js` 计算相机和图层姿态，`mesh.js` 使用官方 PixiJS MeshPlane/MeshRope 在两个复用的 WebGL 合成面上绘制当前镜头与桥接目标。`deformation.js` 提供素材区域权重。后期 WebGL 将合成面更新到原有纹理，再执行原画、双色、色阶、线稿和固定格点效果。没有每帧 PNG/base64 编码，源素材只加载一次。两个镜头的局部动作使用同一个实时进度，末尾循环也保持周期连续。

`deformation` 开关局部形变，`deformationStrength` 范围 0–1.5。`motionStudy` 固定启用时的镜头、刚性图层姿态和原画模式，只让局部动作随时间改变。减少动态会同时停止局部形变。三角网格与资源管理沿用已安装的官方 Skill 方法，详见 [来源与应用](PIXI_SKILLS.md)。

默认使用 `auto`，以原画优先的节奏自动显影：原画 3.04 秒、点阵含进出 1.20 秒、其他显影合计 0.96 秒。选择 `original` 可独立观看素材和镜头。既有格点衔接、双镜头慢看和图形上下文恢复仍保留。Canvas 兼容路径也合成图层，但复杂滤镜使用较低分辨率和简化处理，性能不等同于 WebGL。当前没有人物骨骼或真实折射材质。

```powershell
python scripts/check_matrix.py --browser
```

`tests/browser_matrix.py` 验证旧五图回归；`tests/browser_layers.py` 验证新默认页面的真实本地导航、透明素材、独立运动、三种构图、原画/点阵接缝、倒拖、图层开关、移动布局和离线成品。

`MatrixMotion.setLayerVisible(id, boolean)` 控制图层开关。`MatrixMotion.getState().composition` 提供相机、各层姿态、`meshAvailable`、实际 Pixi 节点类型、网格顶点数、WebGL 错误与定机位姿态。Canvas 2D 兼容路径没有局部网格形变，导演台会明确标出并禁用对应开关。
