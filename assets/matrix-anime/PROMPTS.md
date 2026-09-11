# 五镜头日漫 · 实际提示词记录

图片使用内置 `image_gen`，视频使用用户授权的阿里云 Token Plan `happyhorse-1.1-i2v`。顺序为先完成并筛选五张首帧，再开始视频生成。图片共生成七次，最终选定五张；视频共创建五个任务，每个 5 秒、720P。

| 镜头 | 最终首帧 | 实际图片提示词 | 实际视频提示词 | API 记录 |
|---|---|---|---|---|
| 01 屋顶 | [01-rooftop.png](first-frames/01-rooftop.png) | [v2](prompts/01-rooftop-v2-image.txt) | [动作与运镜](prompts/01-rooftop-video.txt) | [记录](generation/01-rooftop.json) |
| 02 近景 | [02-turn.png](first-frames/02-turn.png) | [提示词](prompts/02-turn-image.txt) | [动作与运镜](prompts/02-turn-video.txt) | [记录](generation/02-turn.json) |
| 03 下坠 | [03-fall.png](first-frames/03-fall.png) | [提示词](prompts/03-fall-image.txt) | [动作与运镜](prompts/03-fall-video.txt) | [记录](generation/03-fall.json) |
| 04 隧道 | [04-tunnel.png](first-frames/04-tunnel.png) | [提示词](prompts/04-tunnel-image.txt) | [动作与运镜](prompts/04-tunnel-video.txt) | [记录](generation/04-tunnel.json) |
| 05 天空 | [05-sky.png](first-frames/05-sky.png) | [v2](prompts/05-sky-v2-image.txt) | [动作与运镜](prompts/05-sky-video.txt) | [记录](generation/05-sky.json) |

最初的屋顶图由全新描述生成。02、03、04 及弃用的 05 初稿将其作为人物身份和画风参考，并明确要求更换姿势与场景。用户指出屋顶初稿的人体结构问题后，01 和 05 改用 02 的肩部近景作为身份、画风参考重新生成，避免继续参考初稿的全身姿势。屋顶最终改为侧跑，天空最终改为有双脚支撑的纸飞机滑行。两张弃稿在 `rejected/`，没有直接送入视频任务。

五个视频种子依次为 20260921–20260925。图片与任务的输入哈希可以对照 [image-manifest.json](image-manifest.json)。提示词中的位移、镜头角度和时间段是生成要求，实际执行程度与阶段性局限记录在 [ANIME_MOTION.md](../../docs/ANIME_MOTION.md)。
