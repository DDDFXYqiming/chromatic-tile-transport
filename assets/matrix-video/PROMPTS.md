# 本轮实际视频生成记录

2026-09-11，在用户明确授权下使用本机 Pi 配置中的阿里云 Token Plan 凭据。凭据未复制到项目。本轮仅创建两个任务，未执行额外重生成。

| 文件 | 模型与输入 | 提示词 | 参数与返回记录 |
|---|---|---|---|
| `originals/garden.mp4` | `happyhorse-1.1-i2v`，首帧 `first-frames/garden.png` | [实际提交原文](prompts/garden-i2v.txt) | [任务记录](generation/garden-i2v.json) |
| `originals/encounter.mp4` | `happyhorse-1.1-r2v`，按顺序参考 character、fish、flowers、background 四个 PNG | [实际提交原文](prompts/encounter-r2v.txt) | [任务记录](generation/encounter-r2v.json) |

两个请求都是 5 秒、720P，`watermark` 使用服务提供的 false 选项，固定种子分别为 20260911 与 20260912。网页副本去掉音轨、裁为 5 秒并缩短关键帧间隔，原始成品及其生成标记另行保留。封面和验收截图由实际视频提取，未额外生成图片。

首帧与参考图来自现有原创“浮光花园”素材。I2V 首帧已经合成了人物、鱼、前后花枝和背景；R2V 用原有四张图重新构造第二个镜头。提示词中的动作要求并不保证全部准确执行，实际观感与局限见 [接入与验收记录](../../docs/VIDEO_MOTION.md)。
