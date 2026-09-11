# 视频动画与 Matrix Motion

2026-09-11 的阶段性实现。用户本轮明确授权使用本机 Pi 中的阿里云 Token Plan 密钥生成素材，因此本轮开始实际视频生成；此前不调用视频模型的要求保留为旧网格实验的历史范围。

## 本轮成品

初版双镜头保留在 [视频版](../dist/matrix-video.html)。当前展厅默认进入 [绯刃交锋战斗番](BATTLE_MOTION.md)，另保留 [青空偏航日漫版本](ANIME_MOTION.md)。两个镜头使用不同构图和动作，均通过实时原画、双色、线描和固定点阵处理。导演台可关闭“画面自身运动”，比较静止首帧与视频，也可进入 [网格对照版](../dist/matrix-motion.html)。2026-09-12 界面对齐后，视频版默认展示完整标题、状态与导航，纯画面可在导演台开启；慢速双镜头演示保留在主标题下方。

| 镜头 | 生成方式 | 实际观看到的变化 |
|---|---|---|
| 花园初见 | `happyhorse-1.1-i2v`，用现有完整合成画面作为首帧 | 人物转头看鱼，鱼身转向，长鳍和尾部连续摆动 |
| 掌心相遇 | `happyhorse-1.1-r2v`，参考人物、鱼、花枝与背景四张原图 | 人物位于左侧，抬手并眨眼，鱼从右侧靠近手掌 |

仅提交了两次生成，各请求 5 秒、720P。两个任务均成功，返回的 `usage` 各为 `duration: 5`、`video_count: 1`、`SR: 720`，合计 10 秒。API 没有返回实际 Credits 数字，本记录不估算或伪造 Credits 扣量；应以套餐控制台为准。[Token Plan 计量说明](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview)

当前已经有真实视频中的姿态、表情与主体运动，也有两个不同镜头，但仍有需要继续审看的细节。第一段转头幅度超过提示词中的轻微动作，鱼尾有少量出框；第二段的背景色温、角色饰物与线条细节相对第一段有轻微变化。完整画面的视频无法像原网格版一样独立开关鱼或花枝，也无法实时重新调整人物动作。此次没有继续追加生成来追逐细节。

## 文件与提示词

- `assets/matrix-video/originals/` 保留 API 下载的原始 MP4。
- `assets/matrix-video/garden.mp4` 与 `encounter.mp4` 是网页使用的 H.264、24 fps、无音轨版本，长度裁为 5 秒，关键帧间隔为 12 帧，以便拖动定位。保留原始 AI 生成元数据。
- 同目录 `*-poster.jpg` 取自网页视频首帧，仅用于缩略图与无法加载视频时的降级。
- `first-frames/garden.png` 是首个任务实际使用的首帧，复制自原项目的干净合成画面。
- [生成提示词](../assets/matrix-video/PROMPTS.md) 索引实际提交的两个提示词。
- `generation/*.json` 保存模型、任务 ID、输入文件哈希、参数、状态、返回用量和输出哈希。没有密钥、图片 Base64 或临时签名下载链接。

## 调用过程

本次核对了阿里云官方 [Token Plan 多模态接入](https://help.aliyun.com/zh/model-studio/token-plan-multimodal-gen)、[HappyHorse 首帧图生视频](https://help.aliyun.com/zh/model-studio/happyhorse-image-to-video-api-reference) 和 [参考图生视频](https://help.aliyun.com/zh/model-studio/happyhorse-reference-to-video-api-reference)。使用北京区套餐专用域名，没有切换到普通按量计费凭据或其他平台。

`scripts/token_plan_video.py` 只供用户在智能体任务中明确要求生成素材时交互式调用。它在发请求时读取 `~/.pi/agent/models.json` 的 `aliyun-tokenplan` provider，并检查目标域名、Token Plan 凭据类型和 `qwen3.8-flash` 模型。它不会修改 Pi 配置。

一次 `submit` 只创建一个生成任务，先记录创建状态。已有同名任务记录时拒绝重复提交。请求结果不明确时保留状态供核查，不自行重试付费创建；`status` 和 `download` 通过保存的任务 ID 继续处理。查询请求不携带仅用于创建请求的异步头。

下面是本轮已执行命令的结构。不要为了重建页面、测试或观看演示重新执行 `submit`。提交参考图片需要 Pillow；网络请求使用 Python 标准库。

```powershell
python scripts/token_plan_video.py submit --model happyhorse-1.1-i2v --state assets/matrix-video/generation/<新任务名>.json --prompt assets/matrix-video/prompts/garden-i2v.txt --image assets/matrix-video/first-frames/garden.png --duration 5 --resolution 720P
python scripts/token_plan_video.py status --state assets/matrix-video/generation/<任务名>.json
python scripts/token_plan_video.py download --state assets/matrix-video/generation/<任务名>.json --output assets/matrix-video/originals/<文件名>.mp4
```

种子、提示词和输入记录用于追溯，不保证重新生成得到相同视频。网页从本地读取已经生成的文件，构建、测试与播放路径都不会调用此脚本或读取凭据。

## 视频怎样进入转场

`examples/matrix-video/scenes.json` 定义章节与封面，`config.json` 中的 `videos` 将每个 slug 关联到本地 MP4、24 fps 和裁切焦点。原有 `composition` 配置继续用于网格版，两种输入互斥。`src/matrix/video.js` 按已安装 PixiJS Skill 的方法使用 `VideoSource` 与 `Sprite`，浏览器负责解码，两个离屏合成面继续交给原 Matrix shader。

正常播放使用原生视频播放。每个镜头从前一段点阵桥中开始显示，成为主镜头后沿用同一视频时间，因此进入下一幕时不会重启视频。视频的时间覆盖“单幕时长 + 入场桥时长”，当前 5 秒素材被映射到这段时间。两幕总时间仍为 10.4 秒，重叠的桥接没有重复计入总长度。

暂停和倒拖采用固定素材帧定位。`MatrixMotion.seek()` 仍立即返回状态，视频定位期间 `composition.seeking` 为真；需要截图或导出时使用 `await MatrixMotion.seekAsync(seconds)`，随后使用 `await MatrixMotion.snapshotAsync()`，等待实际解码帧。连续快速拖动会合并过时目标。旧图片和网格模式继续支持原同步接口。

当前原生解码与 WebGL 合成按浏览器实际能力运行，逐帧导出结果不能当成实时帧率成绩。Canvas 兼容路径也可显示视频；无法加载或定位的视频会使用对应封面，并在导演台与诊断状态中明确提示。

## 构建、播放和验收

```powershell
python scripts/build_matrix.py --linked --scenes examples/matrix-video/scenes.json --config examples/matrix-video/config.json --output dist/matrix-video.html
python scripts/build_matrix.py --scenes examples/matrix-video/scenes.json --config examples/matrix-video/config.json --output dist/matrix-video-offline.html
python scripts/build_showcase.py
python scripts/serve.py --directory . --port 8765
```

本地服务器新增单段 HTTP Range 支持，以便视频定位。使用其他服务器时也应支持字节范围请求。离线单文件嵌入视频、封面和库，无需远程资源；其中版本切换链接需要相应的另一个页面文件存在。

```powershell
python scripts/check_matrix.py --browser
python scripts/check.py --browser
# 需要本机 FFmpeg，或通过 FFMPEG_BIN 指定其路径
python scripts/render_matrix_preview.py --video --clean --duration 10.4 --fps 24 --output reports/video/matrix-video-preview.mp4
```

`tests/browser_video.py` 验证真实 MP4 解码、各镜头的可见动作、点阵桥两端同时播放、倒拖像素一致、两处循环接缝、暂停无持续重绘、运动开关、上下文恢复、移动布局、封面降级和离线无外部请求。报告与截图在 `reports/video/`。Range 与 API 辅助脚本的测试不会创建模型任务。
