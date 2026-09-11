# 绯刃交锋 · 实际生成提示词

2026-09-11，用户追加战斗番方向。内置 image_gen 先完成五张首帧，逐张检查结构后，再使用授权的阿里云 Token Plan 生成五段 5 秒、720P 视频。图片与视频均各调用五次，无重生成。

| 分镜 | 图片提示词 | 视频提示词 | 最终首帧 | 生成记录 |
|---|---|---|---|---|
| 刃前对峙 | [图片](prompts/01-faceoff-image.txt) | [视频](prompts/01-faceoff-video.txt) | [PNG](first-frames/01-faceoff.png) | [任务与用量](generation/01-faceoff.json) |
| 疾行突进 | [图片](prompts/02-charge-image.txt) | [视频](prompts/02-charge-video.txt) | [PNG](first-frames/02-charge.png) | [任务与用量](generation/02-charge.json) |
| 双刃交锋 | [图片](prompts/03-clash-image.txt) | [视频](prompts/03-clash-video.txt) | [PNG](first-frames/03-clash.png) | [任务与用量](generation/03-clash.json) |
| 腾空避斩 | [图片](prompts/04-vault-image.txt) | [视频](prompts/04-vault-video.txt) | [PNG](first-frames/04-vault.png) | [任务与用量](generation/04-vault.json) |
| 青刃决意 | [图片](prompts/05-finish-image.txt) | [视频](prompts/05-finish-video.txt) | [PNG](first-frames/05-finish.png) | [任务与用量](generation/05-finish.json) |

第一镜的输入参考为 [上一组肩部近景](../matrix-anime/first-frames/02-turn.png)，仅延续人物身份和电视日漫画风，战斗服装、对手和竞技场均在新提示词中指定。第二至第五镜都引用 [新的对峙首帧](first-frames/01-faceoff.png)，约束角色、服装与配色，分别生成新的动作和景别。

五张图全部完成后才提交视频。每段视频的输入 PNG 哈希写入各任务记录，并与 [图片清单](image-manifest.json) 对照。实际发送的视频提示词也完整保存于任务 JSON，文件与记录内容一致。

图片提示词强调可读轮廓、合理四肢、手握真实剑柄；视频提示词明确 0–2 秒附近的起势、后续攻击或闪避、镜头轨迹与收势，而非只写“史诗级战斗”。时间分段属于引导，实际结果与局限以 [审片说明](../../docs/BATTLE_MOTION.md) 为准。

网页使用的五个 MP4 位于本目录，原始 API 输出另存 originals/。读取已有任务只使用 status/download，不重复执行 submit；构建与播放不使用凭据。
