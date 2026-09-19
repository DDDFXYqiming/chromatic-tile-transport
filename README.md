简体中文 | [English](README.en.md)

# Chromatic Tile Transport

一个在浏览器里运行的视觉实验室。

这个仓库起初只是想回答一个很具体的问题。两张图之间的转场，能不能让每一块颜色自己找到下一站。后来问题越做越大，项目里又多了一套 Matrix Motion，用分层画面、真实视频和固定点阵去试另一种方向。

现在这里有两套效果。

| 效果 | 入口 | 看到什么 |
| --- | --- | --- |
| 寻色迁移 | [效果 01](dist/readme-transport.html) | 格片根据颜色、位置和局部亮度寻找目标位置，再沿各自的曲线完成转场 |
| Matrix Motion | [效果 02](dist/matrix-battle.html) | 原画、视频、线描和固定点阵在同一条时间轴上重新显影 |

## 看两段实际演示

### 寻色迁移

五张 AI 插画沿用五幕影像档案的展示方式，保留章节文案、底部五张缩略图和完整转场。每张图停留 3.2 秒，再用 5.8 秒完成寻色迁移，约 45 秒走完一轮。

https://github.com/user-attachments/assets/8773b3f9-8837-4490-bd41-9b429a566d7d

### Matrix Motion

选的是「绯刃交锋」这一组。人物在运动，画面也会经过线描和点阵切换，21.5 秒看完一轮。页头、章节导航和转场都来自实际网页。

https://github.com/user-attachments/assets/ad2d0456-bcb2-4b8d-ac2b-1b06ea7c28c8

Matrix Motion 现在保留四个版本。最初的花园分层版、浮光花园双视频、青空偏航五镜头和绯刃交锋五镜头都在影像档案里，可以从页面右上角切换。

## 在本地打开

项目是静态网页，运行时不需要模型、后端或账号。视频也是已经保存进项目的本地文件，构建和播放不会读取生成服务的凭据。

需要 Python 3.10 或以上。在仓库根目录运行下面的命令。

```powershell
python scripts/serve.py --directory . --port 8765
```

然后打开 `http://127.0.0.1:8765/index.html`。服务仓库根目录很重要，因为展厅页面会从根目录寻找 `dist`、`src` 和 `assets`。

页面里可以用空格播放或暂停，用左右键换幕，用滚轮和时间轴倒拖。Matrix Motion 的导演台可以切换原画、双色、色块、线描和固定点阵。视频版还可以暂时关掉画面自身运动，用来比较首帧和视频。

## 如果想改它

先从 [docs/README.md](docs/README.md) 开始。那里按用途放了构建、时间轴、分层、视频、PixiJS、验收和素材说明。

最常用的检查命令如下。

```powershell
$env:PYTHONUTF8 = '1'
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```

效果 01 和效果 02 有各自的源码和时间轴。改 Matrix Motion 时，入口在 `src/matrix/`，生成页面用 `scripts/build_matrix.py`。生成后的 `dist/*.html` 只是产物，源码改完再构建。

## 这个仓库现在处于什么状态

它已经能稳定地作为一个本地视觉实验来运行，时间轴、倒拖、点阵桥、视频解码、离线页面和移动布局都有浏览器检查。画面本身仍然带着生成素材的痕迹。快动作里偶尔会重绘脸、手和武器，视频模型也不会每次都严格照着提示词走。这些局限写在各自的文档里，没有用额外特效把它们藏起来。

如果你想把它换成自己的图片或视频，最值得先读的是 [素材与许可](docs/MEDIA_LICENSE.md)、[复现说明](docs/REPRODUCTION.md) 和 [Matrix 文档索引](docs/README.md)。

## 许可

源代码和脚本按 [MIT License](LICENSE) 发布。示例图片、视频、封面和报告截图有各自的来源与使用边界，不能因为代码开源就自动获得新的素材授权。请先读 [docs/MEDIA_LICENSE.md](docs/MEDIA_LICENSE.md)，再替换成你有权使用的素材。

项目包含 AI 生成的示例素材。
