# Matrix Motion · 星海成像

第二套独立效果，使用同一组《崩坏：星穹铁道》静态插画。它不依赖 GIF、视频、大模型、外部服务或新增美术素材，也不替换 V3.1 寻色迁移。

## 直接运行

从项目根目录启动（此处必须服务**仓库根目录**，不是仅服务 dist）：

```powershell
python scripts/serve.py --directory . --port 8000
```

浏览器打开 `http://127.0.0.1:8000/`，展厅内有两个入口：

| 效果 | 入口 | 核心 |
|---|---|---|
| 01 寻色迁移 | `dist/index.html` | 原版 OKLab 一对一配对、Bézier 格片迁移；源文件和产物保持不变 |
| 02 星海成像 | `dist/matrix-motion.html` | 镜头编排、双色/色阶/线稿、固定网格的快速数字桥 |

仓库中的第二套入口是轻量链接版，使用现有 assets 和 src/matrix。它不需要 npm 构建，但应通过 localhost 打开，避免 file:// 外部纹理的浏览器限制。

生成可离线双击的单文件版：

```powershell
python scripts/build_matrix.py --output dist/matrix-motion-offline.html
```

重新生成仓库链接预览与双效果展厅：

```powershell
python scripts/build_matrix.py --linked
python scripts/build_showcase.py
```

构建器不会写入 `dist/index.html`，也不会修改第一套引擎。

## 如何观察

默认五幕循环，每幕 6.8 秒，总长 34 秒；每次真正用于跨图片的数字桥固定为 0.48 秒，不随单幕时长成比例拉长。

右上角「导演台」可将当前帧切成原画、双色、色块、线描或固定点阵。暂停后切换这些按钮，最容易看清实时图像处理的区别。「暂停在点阵中间」定位到当前幕的桥接中点；画面右侧的白色卡片启动一小段桥接循环，再点一次退出循环。底部时间轴以秒为单位，可正反向拖动。

空格播放/暂停，F 沉浸，Esc 退出，左右键切幕。画面上的滚轮和触摸拖动也控制同一条时间轴。减少动态模式会停止自动播放、点阵桥和镜头变化；静态切幕仍然可用。

## 一个镜头的编排

以默认参数为例，时间约为：

| 单幕时间 | 画面行为 |
|---|---|
| 0.00–0.88 s | 下一幕线稿通过遮罩显影成完整彩色原画 |
| 0.88–1.77 s | 保留原画，镜头轻推 |
| 1.77–3.10 s | 扫描遮罩进入离散色阶 / 大色块 |
| 3.10–4.55 s | 转为冰蓝双色，继续靠近设置的主体焦点 |
| 4.55–5.18 s | 线描扫过当前构图 |
| 5.18–6.32 s | 双色特写，镜头停在桥接起点 |
| 6.32–6.80 s | 固定点阵出现、逐列侧翻换图、恢复下一幕线稿 |

第一屏的图像始终在变化，而不是一张图片静止数秒后等待漫天飞散。WebGL 中原色、双色、量化色阶和边缘线描由纹理采样实时生成；不另存一份滤镜图片。

## 数字桥不是搬运

每个屏幕像素先确定自己所在的网格，格点中心固定为：

```glsl
vec2 cell = floor(uv * grid);
vec2 center = (cell + 0.5) / grid;
```

在这个固定格点采样旧图和新图。扫描波控制每个格子的翻转时刻，颜色在格子侧立变窄时替换；亮度控制格子大小，边缘高光让它像一面微型显示阵列。整个过程中不会计算源格片的目标位置，也不会调用 `matcher.js`。转场前后的网格显隐包络与换图过程重叠，没有拆完之后等起步的阶段。

图像仍保留强弱明暗结构，所以完整人物、点阵人物、另一幕线稿能够衔接。两端恢复完整图像，最后一幕也能连续回到第一幕。

## 哪些属于近似

本模式是受上传参考视频启发的独立实现，不是原站源码或原片逐帧复刻。前文的审美比例和“能还原几成”不是可验证指标，不应作为此版本的完成度承诺。

**没有自动人物分层。** 当前焦点是五张图逐张设置的坐标；所谓局部视差是围绕焦点的平滑纹理形变，用来近似远近差异。它不能让被烘焙到一张图里的鱼、花、人物独立进出，也不能补全被遮挡的背景。真正需要那些动作时，应另行提供透明图层、遮罩或深度图。

**线描是边缘检测，不是重新绘制。** 复杂建筑、树叶、发丝仍可能产生细碎轮廓。双色和色阶能统一美术语言，但不会把复杂海报变成经过人工设计的大留白插画。

**兼容模式是简化版。** WebGL 2 是主效果；Canvas 2D 使用预计算的颜色/轮廓画布、简化遮罩混合和最多 96 列的固定格阵，不做局部视差。它支持同一条秒制时间轴和确定性倒拖，但不能宣称与 GPU 路径逐像素一致。

## 参数

修改 `examples/matrix-motion/config.json`，重建即可。仍复用 `examples/starrail/scenes.json` 和 `assets/starrail/`。

| 参数 | 默认 | 范围 / 行为 |
|---|---|---|
| `shotSeconds` | 6.8 | 4–14 秒，整幕时长，包含数字桥 |
| `bridgeSeconds` | 0.48 | 0.30–0.85 秒，独立控制数字桥 |
| `density` | 144 | 48–224 的整数列数，行数依画面比例计算 |
| `zoom` | 1.65 | 1–2.1，最后的近景倍率 |
| `parallax` | 0.65 | 0–1，局部形变幅度；不是语义分层强度 |
| `palette` | `ice` | `ice` 冰蓝纸白 / `scene` 场景色 / `mono` 黑白 |
| `mode` | `auto` | `auto/original/duotone/poster/line/matrix` |
| `autoplay` | true | 系统减少动态偏好具有优先权 |
| `focus.<slug>` | 逐图指定 | 原图归一化 `[x,y]`，均在 0–1；缺省使用场景 `position` |

性能优先时先降低 density 或关闭 parallax；高密度影响颗粒感，实际渲染成本还取决于像素数及线描采样。设备像素比被限制在 1.5，后备缓冲不超过约 280 万像素。不要根据离线预览 MP4 估算显卡实时帧率。

## 脚本接口

```js
MatrixMotion.pause();
MatrixMotion.seek(4.1);          // 全片秒数，不是百分比
MatrixMotion.configure({ mode: 'duotone' });
MatrixMotion.configure({ mode: 'auto', bridgeSeconds: 0.48 });
MatrixMotion.inspectBridge();   // 当前幕的桥中点，暂停
MatrixMotion.setClean(true);
MatrixMotion.setImmersive(true);
MatrixMotion.play();
MatrixMotion.getState();
```

不接受未知参数、NaN、无限数、越界值或数字冒充布尔值。设置失败保持旧配置不变。暂停与倒拖使用相同的确定性时钟，不依赖随机数或真实墙钟时间。

## 验收和导出

```powershell
# 第一套原有回归（包含新添加的 Python 构建测试）
python scripts/check.py --browser
# 第二套回归
python scripts/check_matrix.py --browser
# 逐帧导出第二套视频，需要 FFmpeg
python scripts/render_matrix_preview.py --output docs/matrix-preview.mp4 --duration 14.2 --fps 24
```

浏览器依赖仍来自 `requirements-dev.txt`。测试结果位于 `reports/matrix/`，包括五次转场连续性、循环接缝、倒拖像素一致、零外部请求、减少动态、兼容模式、恢复图形上下文，以及展厅渲染、入口目标文件和旧版渲染。

本轮环境的浏览器管理策略禁止 localhost / file URL 导航，因此以同一份离线 HTML 内容加载并执行真实渲染，链接目标在磁盘上验证；没有绕过管理策略，也没有把完整跨页点击导航记为已通过。

截图和视频必须来自本轮真实渲染，不能用静态滤镜图冒充播放效果。渲染导出是确定性帧采样，不是硬件跑分。软件 GL 和手机尺寸模拟不代表真机性能。
