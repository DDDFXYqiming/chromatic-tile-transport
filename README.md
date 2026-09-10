# 星海视觉实验室 · 两套效果，一个仓库

| 实验 | 入口 | 素材与动作 |
|---|---|---|
| 01 · 寻色迁移 | [Demo](dist/index.html) | 用户提供的五张星铁原画；OKLab 一对一配对、曲线格片迁移 |
| 02 · 浮光花园 / Matrix Motion | [Demo](dist/matrix-motion.html) | 四张原创 AI 插画、五个独立图层实例；12 秒全景、特写与留白镜头 |

从仓库根目录启动 [双效果展厅](index.html)：

```powershell
python scripts/serve.py --directory . --port 8765
# http://127.0.0.1:8765/
```

两套页面左上角返回展厅，顶部切换效果；手机也保留导航。01 的影像档案、设置、沉浸和时间轴继续可用。

## 02 的新素材与分层运动

![浮光花园实际合成画面](assets/matrix-botanical/cover.webp)

人物、鱼、花枝和背景分别加载。花枝复用为远景与前景两个实例，各层有自己的位置、大小、转角、透明度、深度和漂移。画面先用 Canvas 2D 合成，再作为动态纹理交给原来的 WebGL 2 显影与点阵渲染器；每帧没有截图编码或模型调用。

默认播放原画镜头，用同一套图层完成“完整构图 → 人物特写 → 留白构图”，一轮 12 秒。导演台的“导演编排”启用自动双色、线稿和点阵，也可单独比较五种显影模式。

导演台增加图层开关、独立运动开关、横向与纵向构图控制。点击“慢看双镜头切换”可观察点阵衔接，再次点击退出。空格暂停，F 沉浸，Esc 返回；时间轴和滚轮可以倒拖。

新素材在 `assets/matrix-botanical/`，使用内置 imagegen 制作，透明 PNG 的 alpha 已检查。[素材与完整提示词](assets/matrix-botanical/PROMPTS.md) · [分层实现与参数](docs/LAYERED_MOTION.md) · [Matrix 显影原理](docs/MATRIX_MOTION.md)。

## 构建与验证

```powershell
python scripts/build_matrix.py --linked
python scripts/build_showcase.py
# 包含全部图层的离线版本
python scripts/build_matrix.py --output dist/matrix-motion-offline.html
# 旧星铁 Matrix 配置仍可单独构建
python scripts/build_matrix.py --scenes examples/starrail/scenes.json --config examples/matrix-motion/starrail.config.json --output dist/matrix-motion-starrail.html
```

```powershell
$env:PYTHONUTF8 = '1'
# 使用已安装 Chrome 时可设置 CHROME_BIN
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

第一条同时验证旧五图渲染器与新分层素材，第二条保持原效果回归。覆盖 alpha、独立运动、三镜头接缝、倒拖、实际播放、手机布局、兼容路径和离线资源。新分层报告位于 `reports/layers/`；截图和采样视频不代表所有设备的实时帧率。

01 的完整说明在 [README-transport.md](README-transport.md)。两套技能分别在 `skills/chromatic-tile-transport/` 与 `skills/matrix-motion/`，入口是 [skill.md](skill.md)。

01 的游戏美术权利归原权利人。02 使用新生成的原创插画；当前为平面图层的 2.5D 动画，没有人物骨骼、独立发丝模拟或真实玻璃折射。运行时无需模型、CDN、后端或上传服务。
