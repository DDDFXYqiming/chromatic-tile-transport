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

`examples/matrix-motion/scenes.json` 定义三组相连的相机关键帧。默认每幕 4 秒，共 12 秒。第一个镜头建立完整构图，第二个靠近人物，第三个先移向留白构图，再返回起始取景形成循环。

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

各层从同一条时间轴采样，暂停不再推进，反向回到同一进度会复现相同画面。`layerMotion` 比较自主运动的作用；`cameraX/cameraY` 调整构图。深度是平面图层的视觉参数，不是模型产生的真实深度图。

## 渲染与验收

`src/matrix/layers.js` 计算相机和图层姿态，在复用的 Canvas 2D 缓冲中合成当前画面与桥接目标。WebGL 将它们更新到原有纹理，再执行原画、双色、色阶、线稿和固定格点效果。没有每帧 PNG/base64 编码，源素材只加载一次。

默认使用 `original`，先观看素材和镜头；选择 `auto` 自动遍历显影效果。既有格点衔接、双镜头慢看和图形上下文恢复仍保留。Canvas 兼容路径也合成图层，但复杂滤镜使用较低分辨率和简化处理，性能不等同于 WebGL。当前没有人物骨骼或真实折射材质。

```powershell
python scripts/check_matrix.py --browser
```

`tests/browser_matrix.py` 验证旧五图回归；`tests/browser_layers.py` 验证新默认页面的真实本地导航、透明素材、独立运动、三种构图、原画/点阵接缝、倒拖、图层开关、移动布局和离线成品。

`MatrixMotion.setLayerVisible(id, boolean)` 控制图层开关。`MatrixMotion.getState().composition` 提供相机和各层实际姿态。
