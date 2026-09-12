# 视频动画与 Matrix Motion

视频版将本地 MP4 解码为 PixiJS VideoSource 纹理，再交给共享显影渲染器。播放页面无需模型服务或生成凭据。

[浮光花园](../dist/matrix-video.html) 包含两个 5 秒片段，展示人物转头、游鱼运动和抬手互动。[青空偏航](ANIME_MOTION.md) 与 [绯刃交锋](BATTLE_MOTION.md) 各有五段视频。四个系列均可从影像档案进入。

## 素材与配置

章节清单位于各自的 `examples/` 目录。`config.json` 中的 `videos` 将场景 slug 映射到 MP4、帧率和裁切焦点。`composition` 用于分层版，两种输入互斥。

网页副本为 H.264、24 fps、无音轨，封面来自首帧。参见 [素材说明](../assets/matrix-video/ASSETS.md) 和 [媒体许可](MEDIA_LICENSE.md)。

## 播放时间

正常巡航使用原生视频播放，暂停与倒拖按 24 fps 定位。桥接时两段视频同时更新，入场视频成为主镜头后保持连续。花园双视频每幕 5.2 秒，桥接 1.2 秒，整轮 10.4 秒。

视频定位是异步操作。截图与导出应等待 `seekAsync()` 或 `snapshotAsync()`。减少动态会固定首帧，加载失败则显示封面并提示降级。Canvas 兼容路径也能绘制本地视频。

本地服务器需要支持 HTTP Range 请求，使用 `scripts/serve.py` 从仓库根目录启动。离线页面内嵌全部素材与代码。

## 可选素材生成工具

`scripts/token_plan_video.py` 是独立的生成辅助工具，构建和播放不会调用它。凭据通过 `TOKEN_PLAN_API_KEY` 环境变量提供，脚本不读取其他应用的个人配置。

生成会调用付费服务。提示词、任务状态和下载记录应放在 Git 忽略的 `.local-generation/` 中。一次 `submit` 只创建一个任务，已有任务使用 `status` 或 `download` 继续处理。创建结果不明确时先核查状态，避免重复提交。

```sh
python scripts/token_plan_video.py submit --state .local-generation/clip.json --prompt .local-generation/prompt.txt --image assets/matrix-video/first-frames/garden.png --duration 5 --resolution 720P
python scripts/token_plan_video.py status --state .local-generation/clip.json
python scripts/token_plan_video.py download --state .local-generation/clip.json --output .local-generation/clip.mp4
```

## 验证与限制

`tests/browser_video.py` 覆盖解码、倒拖、桥接、暂停、运动开关、上下文恢复及离线资源。辅助脚本的单元测试使用模拟请求。

首版片段存在鱼尾出框、背景色温和角色细节变化。视频中的单个角色无法像独立图层一样开关或重新调整动作。
