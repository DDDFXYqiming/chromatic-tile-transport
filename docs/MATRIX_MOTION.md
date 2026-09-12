# Matrix Motion

Matrix Motion 在固定格点上完成显影与换图。它支持分层插画和本地视频，四个系列可从影像档案切换。入口与构建命令见 [复现说明](REPRODUCTION.md)。

## 显影与桥接

原画、双色、色阶和线描由纹理采样实时生成。点阵桥在每个固定格点采样两端图像，扫描波控制翻转时刻，在格子变窄时交接颜色。亮度影响格子大小。

```glsl
vec2 cell = floor(uv * grid);
vec2 center = (cell + 0.5) / grid;
```

入格、翻转与回填彼此重叠，桥接两端恢复完整图像。JS 和 GLSL 共用 `MatrixTimeline.GRID_HANDOFF`，所有镜头都使用同一条秒制时间轴。这个效果不调用颜色匹配器，也不计算格片的迁移目的地。

## 节奏与参数

花园分层版每幕 5.2 秒，原画约 3.04 秒，点阵桥 1.2 秒，其他显影合计约 0.96 秒。三镜头一轮 15.6 秒。两个五镜头视频系列每幕 4.3 秒，点阵桥 0.85 秒，一轮 21.5 秒。

| 参数 | 范围与作用 |
|---|---|
| `shotSeconds` | 4 到 14 秒，包含点阵桥 |
| `bridgeSeconds` | 0.3 到 1.6 秒，独立控制桥接 |
| `density` | 48 到 224 列，行数依画布比例计算 |
| `zoom` | 1 到 2.1，近景倍率 |
| `parallax` | 0 到 1，图层或旧平面模式的局部运动幅度 |
| `palette` | `ice`、`scene` 或 `mono` |
| `mode` | `auto`、`original`、`duotone`、`poster`、`line` 或 `matrix` |
| `focus` | 按场景指定归一化焦点 |

导演台显示实际时间分配。双镜头慢看会在两端完整画面各停留 1.5 秒，再沿相同时间轴返回。再次点击即可退出演示。

## 脚本接口

```js
MatrixMotion.pause();
MatrixMotion.seek(4.1);
MatrixMotion.configure({ mode: 'duotone' });
MatrixMotion.inspectBridge();
MatrixMotion.setClean(true);
MatrixMotion.setImmersive(true);
MatrixMotion.play();
MatrixMotion.getState();
```

视频截图应等待 `seekAsync()` 或 `snapshotAsync()`。未知参数、非有限数与越界值会被拒绝，失败的配置更新不会覆盖旧设置。

## 能力边界

分层版使用预先拆分的透明素材，没有自动人物分割。旧平面模式通过焦点和纹理形变近似视差。线描使用边缘检测，复杂纹理可能产生细碎轮廓。

WebGL 2 是主渲染路径。Canvas 2D 使用简化滤镜与格阵，支持同一条时间轴，但画面不保证与 GPU 路径逐像素一致。暂停、倒拖与减少动态的行为应分别验证。

## 检查

```sh
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

浏览器检查覆盖显影、桥接、倒拖、移动布局、资源恢复及离线请求。导出视频用于审片，不用于估算实时帧率。实现细节见 [分层动画](LAYERED_MOTION.md)、[视频播放](VIDEO_MOTION.md) 和 [界面说明](MATRIX_INTERFACE.md)。
