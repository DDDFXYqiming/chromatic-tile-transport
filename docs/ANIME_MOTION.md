# 青空偏航 · 五镜头日漫实验

本轮根据用户的新反馈更换了素材方向。目标是简洁的 2010 年以后电视日漫观感，以更大的主体动作、景别变化、绕行、前景擦镜与几何空间切换，制作五个视频连续衔接的 Matrix Motion 版本。

后续新增的 [绯刃交锋](BATTLE_MOTION.md) 作为展厅默认入口，本组继续独立保留。

## 素材与分镜

先使用内置 `image_gen` 生成关键画面，再将选定的五张图逐张交给阿里云 Token Plan 的 `happyhorse-1.1-i2v`。人物使用短蓝发、简单白外套、蓝上衣和深蓝短裤；背景围绕青蓝、白、珊瑚红的大形状与纸飞机组织。减少首帧中的复杂服装、饰物、细碎纹理和厚涂细节。

| 镜头 | 关键画面 | 视频中观察到的变化 |
|---|---|---|
| 追风起跑 | 白色屋顶的侧面跑姿 | 交替迈步、侧面跟拍转向正面推进，结尾镜头转向纸飞机 |
| 回眸擦镜 | 大圆环前的肩部近景 | 镜头绕到背后再回到面部，景别放大，纸飞机参与遮挡 |
| 螺旋下坠 | 俯拍白色螺旋楼梯 | 人物向纵深缩小、空间旋转，随后快速追近并以前景擦过 |
| 穿越方界 | 蓝色几何门框与悬浮平台 | 连续奔跑与跨跃，多个门框从近处经过，主要采用背后跟拍 |
| 纸翼回航 | 双脚有支撑的纸飞机滑行姿势 | 飞机倾斜、穿环、视点绕行和下降，人物调整平衡 |

这是五段不同的视频内容，不是将一个镜头复制五次。人物动作与相机变化来自视频，Matrix 的实时显影与固定点阵仍使用既有引擎。

## 用户指出的人体结构问题

最初屋顶图的人体结构被用户指出有问题。该图已从选定首帧中剔除，未提交给视频模型。重做时把人物从夸张低机位透视改成结构更清楚的侧面跑姿，明确头颈、躯干、单一骨盆与两条腿的连接，减少鞋底朝向镜头的放大。最后一镜也从较难判断的空中扭转姿势改成纸飞机滑行，让双脚支撑与重心更容易检查。

本轮内置图像生成共调用七次，选定五张，保留两张弃稿。最终图片、提示词版本与哈希见 [图片清单](../assets/matrix-anime/image-manifest.json)。首帧选择记录不能保证视频中每一帧的人体都正确；生成视频仍需完整观看，尤其关注快动作中的手、脚、关节和人物比例变化。

提示词使用“人物动作、空间位移、镜头轨迹、时间段、结构与画风约束”的顺序。图片阶段先保证静态姿势可读，再把夸张感交给环境和构图；视频阶段明确动作过程与运动范围，不再只写微风、呼吸和轻微摆动。分秒与角度属于引导目标，不是模型严格执行的测量结果。

## 用量与文件

视频生成共五次，均成功。每次请求 5 秒、720P，API 各返回 `duration=5`、`video_count=1`、`SR=720`，合计 25 秒素材。没有重复创建这五个视频任务。API 不返回实际 Credits 数字，因此此处不估算扣量。

- `assets/matrix-anime/first-frames/` 保存五张最终首帧。
- `assets/matrix-anime/rejected/` 保存被替换的屋顶与空中姿势初稿。
- `assets/matrix-anime/prompts/` 保存全部图片提示词、修订提示词和五段实际视频提示词。
- `assets/matrix-anime/generation/` 保存任务 ID、参数、输入与输出哈希和返回用量，不包含密钥或临时签名下载 URL。
- `assets/matrix-anime/originals/` 保存原始 API 输出；同目录上一级的五个 MP4 为网页副本，裁为 5 秒、H.264、24 fps、无音轨，关键帧间隔 12 帧，保留 AI 生成元数据。
- [提示词索引](../assets/matrix-anime/PROMPTS.md) 将每张最终图片与视频调用一一对应。

## 网页编排

入口为 [matrix-anime.html](../dist/matrix-anime.html)，配置位于 `examples/matrix-anime/`。五段每幕 4.3 秒，点阵桥 0.85 秒，整轮 21.5 秒。桥接两端重叠播放，所以整轮时长小于五段原片时长之和。

既有视频时间映射将每个源片段覆盖到“单幕 + 入场桥”，本版播放倍率约为 0.963，接近原速；前一版双镜头约为 0.775。本轮提高倍率是为了保留较快的动画节奏。默认原画每幕约 2.622 秒、点阵 0.85 秒、其他显影合计约 0.828 秒，使用逐场景色盘。

影像档案和导演台可在“花园初见 · 原版”“浮光花园 · 视频”“青空偏航”“绯刃交锋”之间切换，也可关闭画面自身运动对比首帧。效果 01 保持原样。移动端继续保留五个章节按钮；窄屏会按裁切焦点取景，完整构图仍推荐横屏观看。

```powershell
python scripts/build_matrix.py --linked --scenes examples/matrix-anime/scenes.json --config examples/matrix-anime/config.json --output dist/matrix-anime.html
python scripts/build_matrix.py --scenes examples/matrix-anime/scenes.json --config examples/matrix-anime/config.json --output dist/matrix-anime-offline.html
python scripts/build_showcase.py
python scripts/serve.py --directory . --port 8765
python scripts/check_matrix.py --browser
python scripts/check.py --browser
python scripts/render_matrix_preview.py --anime --clean --duration 21.5 --fps 24 --output reports/anime/matrix-anime-preview.mp4
```

最后一条是浏览器画面逐帧导出，需要 FFmpeg 或 `FFMPEG_BIN`，不能当成实时帧率基准。构建、测试和播放都不会再次调用模型或读取 Pi 凭据。

## 本阶段的判断

画面复杂度和运动量已经与原先花园版本明显不同。当前接受这五个片段用于整体风格审片，但不宣称已经解决所有生成问题。部分动作和镜头没有严格按提示词执行，第四段更多是背后跟拍，第五段后半的脸型与细节有重绘；个别镜头结尾主体被前景遮挡或暂时出画。下一轮应依据完整播放中的具体时间点修改，不用增加特效掩盖作画问题。

技术检查覆盖五源真实解码、不同镜头内容、五处接缝与循环、倒拖像素一致、仅两段桥接视频同时播放、五章导航、移动布局和离线无外部请求。报告在 `reports/anime/report.json`，静帧与整轮视频也在同目录。像素变化只证明画面变化，不能作为人体结构或审美质量评分。
