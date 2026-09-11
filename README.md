# 星海视觉实验室 · 两套效果，一个仓库

| 实验 | 入口 | 素材与动作 |
|---|---|---|
| 01 · 寻色迁移 | [Demo](dist/index.html) | 用户提供的五张星铁原画；OKLab 一对一配对、曲线格片迁移 |
| 02 · 绯刃交锋 / Matrix Motion | [五镜头战斗番 Demo](dist/matrix-battle.html) | 五张简洁赛璐璐首帧生成五段战斗视频，大幅动作与点阵衔接；一轮 21.5 秒 |

从仓库根目录启动 [双效果展厅](index.html)：

```powershell
python scripts/serve.py --directory . --port 8765
# http://127.0.0.1:8765/
```

两套页面左上角返回展厅，顶部切换效果；手机也保留导航。01 的影像档案、设置、沉浸和时间轴继续可用。

Matrix 页面现已对齐寻色迁移的完整展厅风格，恢复暖白中文标题、章节文案与画面状态卡，补齐页头影像档案、巡航控制、下一幕入口、侧边选幕和底部影像导航。四个系列共用这套页面组件，影像档案和导演台都可切换 [花园初见原版](dist/matrix-motion.html)、[浮光花园视频](dist/matrix-video.html)、[青空偏航](dist/matrix-anime.html) 和 [绯刃交锋](dist/matrix-battle.html)。纯画面与沉浸继续可选。[界面说明](docs/MATRIX_INTERFACE.md)。

## 02 的战斗番、青空日漫与历史对照

最新“绯刃交锋”在同样的五首帧、五视频流程中加入战斗番主题。红衣剑士与深蓝对手在同一竞技场中对峙、突进、交锋、腾空与施展决胜斩，青紫刀光和明确身体位移配合实时 Matrix 点阵。[战斗番说明](docs/BATTLE_MOTION.md) · [实际提示词](assets/matrix-battle/PROMPTS.md)。

前一组 [“青空偏航”](dist/matrix-anime.html) 保留，包含奔跑、近景绕行、螺旋下坠、几何空间穿越和纸飞机滑行。人体有问题的首帧已在视频生成前替换，提示词和审片局限完整保留。[五镜头说明](docs/ANIME_MOTION.md) · [实际提示词](assets/matrix-anime/PROMPTS.md)。

2026-09-11 新增视频版，使用用户授权的阿里云 Token Plan 生成两个 5 秒、720P 片段。人物转头、抬手与鱼的游动来自视频，点阵与显影仍由网页实时处理。导演台可以关闭“画面自身运动”比较首帧，也可以进入 [原网格版本](dist/matrix-motion.html)。[视频接入、实际用量和验证说明](docs/VIDEO_MOTION.md) · [实际生成提示词](assets/matrix-video/PROMPTS.md)。

保留的网格版本是**同一组素材、三个镜头**的阶段性实验。视频版本已经有不同构图与主体动作，但仍需继续审看角色细节和画风一致性，本版不代表最终视觉优化完成。

[视觉效果使用指南](docs/MATRIX_VISUAL_GUIDE.md) · [提示词与决策记录](docs/MATRIX_PROMPT_LOG.md)

以下介绍保留的网格对照版。

![浮光花园实际合成画面](assets/matrix-botanical/cover.webp)

人物、鱼、花枝和背景分别加载。花枝复用为远景与前景两个实例，各层有自己的位置、大小、转角、透明度、深度和漂移。采用已安装的官方 PixiJS Skills 方法：MeshPlane 让人物呼吸、发梢与花枝弯曲，MeshRope 让鱼身与尾部摆动。合成画面交给原来的 WebGL 2 显影与点阵渲染器；每帧没有截图编码或模型调用。[Skill 选择、安装和实际应用](docs/PIXI_SKILLS.md)。

默认使用原画优先的导演编排，每幕 5.2 秒：完整原画 3.04 秒，点阵整段（含进入与退出）1.20 秒，其他显影合计 0.96 秒。三镜头一轮 15.6 秒。导演台会显示实际时间分配，也可选择“原画”独立观看镜头，或固定为其他显影模式。

导演台提供图层开关、独立漂移、局部形变及 0–1.5× 动作幅度。打开“定机位看动作”会固定当前构图，仍可播放局部动作；关闭“局部形变”即可比较。关闭定机位后恢复镜头和显影。点击“慢看双镜头切换”可观察点阵衔接，再次点击退出。空格暂停，F 沉浸，Esc 返回；时间轴和滚轮可以倒拖。

新素材在 `assets/matrix-botanical/`，使用内置 imagegen 制作，透明 PNG 的 alpha 已检查。[素材与完整提示词](assets/matrix-botanical/PROMPTS.md) · [分层实现与参数](docs/LAYERED_MOTION.md) · [Matrix 显影原理](docs/MATRIX_MOTION.md)。

## 构建与验证

```powershell
python scripts/build_matrix.py --linked
python scripts/build_matrix.py --linked --scenes examples/matrix-video/scenes.json --config examples/matrix-video/config.json --output dist/matrix-video.html
python scripts/build_matrix.py --linked --scenes examples/matrix-anime/scenes.json --config examples/matrix-anime/config.json --output dist/matrix-anime.html
python scripts/build_matrix.py --linked --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle.html
python scripts/build_showcase.py
# 包含全部图层的离线版本
python scripts/build_matrix.py --output dist/matrix-motion-offline.html
python scripts/build_matrix.py --scenes examples/matrix-video/scenes.json --config examples/matrix-video/config.json --output dist/matrix-video-offline.html
python scripts/build_matrix.py --scenes examples/matrix-anime/scenes.json --config examples/matrix-anime/config.json --output dist/matrix-anime-offline.html
python scripts/build_matrix.py --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle-offline.html
# 旧星铁 Matrix 配置仍可单独构建
python scripts/build_matrix.py --scenes examples/starrail/scenes.json --config examples/matrix-motion/starrail.config.json --output dist/matrix-motion-starrail.html
```

```powershell
$env:PYTHONUTF8 = '1'
# 使用已安装 Chrome 时可设置 CHROME_BIN
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

第一条同时验证旧五图渲染器、网格分层与新视频输入，第二条保持原效果回归。覆盖 alpha、独立运动、定机位形变对比、网格不翻折、三镜头接缝、倒拖、上下文恢复、实际播放、手机布局、兼容路径和离线资源。新分层报告位于 `reports/layers/`；截图和采样视频不代表所有设备的实时帧率。

01 的完整说明在 [README-transport.md](README-transport.md)。两套技能分别在 `skills/chromatic-tile-transport/` 与 `skills/matrix-motion/`，入口是 [skill.md](skill.md)。

01 的游戏美术权利归原权利人。02 使用原创插画与生成视频。网格对照版保留二维形变与 2.5D 镜头；视频版增加转头、眨眼和抬手，仍可能出现生成细节变化。运行时无需模型、CDN、后端或上传服务。Canvas 2D 兼容模式保留分层漂移，局部形变不可用。
