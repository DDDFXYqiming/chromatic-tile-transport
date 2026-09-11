# 绯刃交锋 · 五镜头战斗番实验

本组响应用户“再做一组同样要求，额外偏向战斗番”的指令。沿用简洁的 2010 年后电视日漫方向，先用内置图像工具制作五张首帧并检查人体，再逐张生成五段大动作视频。新增独立入口 [matrix-battle.html](../dist/matrix-battle.html)；上一组 [青空偏航](ANIME_MOTION.md)、初版双视频、网格对照与效果 01 继续保留。

## 角色与首帧

成年红衣剑士使用短蓝黑发、青色发夹、黑上衣、深灰长裤和黑白鞋；对手为深蓝封闭头盔装甲人。两人各持一把剑，青色与紫色刀光区分攻防。背景保持同一明亮的混凝土竞技场、少量大立柱和蓝天。

第一张以青空组的肩部近景为人物与画风参考，同时更换战斗服装与场景；其余四张统一以新的对峙首帧为角色、服装与画风参考。构图分别指定侧面冲刺、双剑接触、侧面腾空和站立双手举剑。避免把大幅透视造成的畸形当成动态感，重点审查躯干到骨盆的连接、双膝方向、握柄以及脚掌支撑。

内置 `image_gen` 共五次，五张均选用，无重生成。五张全部完成并经过静态检查后才开始视频提交。原画清单与 SHA-256 在 [image-manifest.json](../assets/matrix-battle/image-manifest.json)，全部实际提示词见 [PROMPTS.md](../assets/matrix-battle/PROMPTS.md)。

## 五段实际动作与审片

| 镜头 | 引导目标 | 已观察到的画面 |
|---|---|---|
| 刃前对峙 | 压低重心、冲刺接近、首次交锋 | 从宽对峙转为跑动与近身双剑碰撞，摄影机移位并推近 |
| 疾行突进 | 并排追拍、俯身避开横斩、擦过后转身 | 连续奔跑、低姿态穿过紫刀、背后低机位追拍，景别有明显变化 |
| 双刃交锋 | 近身攻防、碰撞与绕拍 | 双剑交替接触、双方脚步移动，摄影机绕到背后再回到宽侧面 |
| 腾空避斩 | 越过低扫、空中转肩、落地吸收冲击 | 空中抬膝与旋身斩弧，镜头跟随高度变化，随后双脚落地扬尘 |
| 青刃决意 | 高举蓄力、跨步下劈、冲击波与收势 | 青白竖斩、前跨弓步、地面尘浪、拉远后的收刀与再次对峙 |

分秒与角度是提示词中的引导目标，不是模型精确执行的测量值。快动作中仍能看到脸型、护手形状与服装细节的重绘；第二段近身交错时双方轮廓重叠，部分片段的低机位近景会裁去头部。第三段未严格按要求生成指定数量的冲击帧，第四段落地后没有持续保留全身。素材满足本轮五段大幅战斗动作的实验用途，不能宣称每一帧人体和武器连续性都已完美。

## 视频用量与来源

通过用户本轮延续授权的 Pi `aliyun-tokenplan` 凭据调用 `happyhorse-1.1-i2v`。五次创建均成功，每次 5 秒、720P，共 25 秒源素材，无视频重试。每次 API 返回 `video_count=1`、`duration=5`、`SR=720`。返回数据没有实际 Credits 数字，此处不推算扣量。

- `assets/matrix-battle/first-frames/` 保存五张最终 PNG。
- `prompts/` 保存五张图片及五段视频的实际提示词。
- `generation/` 保存任务 ID、参数、输入输出哈希和返回用量；不含密钥、Base64 输入或临时签名 URL。
- `originals/` 保留原始 API 视频；资产根目录的五个 MP4 是网页副本。
- 网页副本为 5 秒、H.264、24 fps、CRF 19、12 帧关键帧间隔、无音轨，保留原视频 AI 生成元数据。封面来自解码后第一帧。
- `reports/battle/frames/` 保存每秒抽取的审片画面，`reports/battle/summary.json` 汇总实际生成记录和输入哈希核对。

## 播放与编排

配置在 `examples/matrix-battle/`。每幕 4.3 秒，其中点阵桥 0.85 秒，五幕循环 21.5 秒。桥接区的两段视频重叠播放，因此短于五段原片的 25 秒总时长。播放倍率约 0.963，沿用青空组的节奏；原画每幕约 2.622 秒，其他显影合计约 0.828 秒。

视频解码、PixiJS VideoSource、显影 shader 和共享时间轴均复用既有实现，本轮无需改动这些渲染机制。新增 battle 配置及构建路由，影像档案和导演台提供“花园初见 · 原版 / 浮光花园 · 视频 / 青空偏航 / 绯刃交锋”四个版本链接。关闭“画面自身运动”可用首帧对照；移动端可用五幕导航，完整战斗构图推荐横屏。

链接版应从仓库根目录启动支持 Range 的本地预览服务；离线版内嵌全部代码、封面和视频。正常播放与构建测试均不调用模型、上传图像或读取 Pi 凭据。

```powershell
python scripts/build_matrix.py --linked --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle.html
python scripts/build_matrix.py --scenes examples/matrix-battle/scenes.json --config examples/matrix-battle/config.json --output dist/matrix-battle-offline.html
python scripts/build_showcase.py
python scripts/serve.py --directory . --port 8765
python scripts/check_matrix.py --browser
python scripts/check.py --browser
python scripts/render_matrix_preview.py --battle --clean --duration 21.5 --fps 24 --output reports/battle/matrix-battle-preview.mp4
```

导出需要 FFmpeg 或 `FFMPEG_BIN`。最后一项是实际网页画面逐帧编码，不能作为实时 FPS 基准。五镜头浏览器验收由 `tests/browser_anime.py --profile battle` 执行，检查真实解码、五段不同内容、五处接缝、确定性倒拖、仅桥接两片同时播放、四版本导航、手机布局、离线资源与控制台错误。像素差异只证明变化，不作为人体结构或审美评分。


本轮检查结果：Matrix 标准渲染 23 项、网格 20 项、初版视频 16 项、青空五镜头 10 项、战斗五镜头 10 项浏览器检查均通过；效果 01 的 33 项浏览器检查及 40 项 Python 测试、19 项数值测试通过。效果 01 的源码与 dist/index.html 没有 Git 内容差异。另在应用内打开本地页面观察实际播放，确认 WEBGL 2 / VIDEO 与无控制台错误。
