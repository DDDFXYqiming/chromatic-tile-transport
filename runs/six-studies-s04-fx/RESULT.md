# 04 时差场 · 章节动效验收

2026-10-04，Windows 本机 Chrome 扩展实测。

分支 `remodel/s04-chapter-fx`，基线 `54be389`。运行入口为
`http://127.0.0.1:8765/dist/temporal-field.html`，静态服务根目录为本 worktree。

## 实现结果

- **02 / wave**：八道竖向时间片持续横向游移，片内影像以不同历史时刻和位移呈现；指针同时改变切片位置、相位和延迟。
- **03 / ribbon**：水平时间带沿连续曲线流动；指针改变带状边界和片内偏移。海面、堤岸的错位随播放持续变化。
- **05 / clear**：保留零历史延迟，加入跟随指针的当前帧透镜、呼吸半径、旋转细弧和轻微镜头运动。透镜内外采样同一时刻。
- `drawHistory` 与插画绘制共用时间片边界和延迟函数，视频与程序运动也能跟随指针重采样。
- radial 的圆形回看与 echo 的三层曝光保留原有绘制行为；已逐段回看并保存播放截图。

源码变更位于 `src/studies/temporal.mjs`。生成页面通过模块链接读取该文件，重新构建后生成 HTML 无内容差异。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| `python scripts/build_studies.py` | PASS |
| `python scripts/check_studies.py` | PASS |
| `node tests/studies_math.mjs` | 7 / 7 PASS |
| `PYTHONUTF8=1 python scripts/check.py --browser` | PASS，matcher 8 项、timing 11 项、Python 41 项及两组旧引擎浏览器检查 |
| Chrome 扩展逐章播放、指针跟随、暂停 | PASS |
| 视频解码与 64 帧历史上限 | PASS，ribbon / clear 均有真实视频解码；wave 使用星轨摆钟验证历史采样 |
| 减少动态效果设置 | wave / ribbon / clear 均默认暂停、立即换章、静止像素稳定 |
| Chrome 控制台错误 | 0 |

命令输出见 [checks.txt](checks.txt) 和 [check-legacy-log.txt](check-legacy-log.txt)。
Windows Python 检查使用 UTF-8 模式。

## 真实播放与指针证据

以下均在转场结束后采样。播放测试保持指针位置固定，采集相隔约 1.3–1.5 秒的两帧；指针测试先暂停，再把指针从画布归一化位置 `(0.32, 0.30)` 移到 `(0.80, 0.60)`。

对画布每隔 12 像素采样，RGB 平均绝对差大于 5 / 255 计为变化。数字仅衡量本次画面差异，视觉验收同时检查了实际画面。

| 章节 | 持续播放变化像素 | 暂停后移动指针变化像素 | 指针停住后的暂停差异 |
| --- | ---: | ---: | ---: |
| radial | 54.14% | 16.74% | 0 |
| wave | 67.18% | 54.93% | 0 |
| ribbon | 78.40% | 63.49% | 0 |
| echo | 65.55% | 保留原曝光行为 | — |
| clear | 70.06% | 80.40% | 0 |

完整采样结果、帧计数、时间间隔、视频状态和减少动态效果检查见 [browser-evidence.json](browser-evidence.json)。

### 02 / wave

[播放 A](02-wave-play-a.jpg) · [播放 B](02-wave-play-b.jpg) · [指针左侧](02-wave-pointer-left.jpg) · [指针右侧](02-wave-pointer-right.jpg)

![02 wave 实际播放](02-wave-play-b.jpg)

### 03 / ribbon

[播放 A](03-ribbon-play-a.jpg) · [播放 B](03-ribbon-play-b.jpg) · [指针左侧](03-ribbon-pointer-left.jpg) · [指针右侧](03-ribbon-pointer-right.jpg)

![03 ribbon 实际播放](03-ribbon-play-b.jpg)

### 05 / clear

[播放 A](05-clear-play-a.jpg) · [播放 B](05-clear-play-b.jpg) · [指针左侧](05-clear-pointer-left.jpg) · [指针右侧](05-clear-pointer-right.jpg)

![05 clear 实际播放](05-clear-play-b.jpg)

### 保留段与历史缓存

- radial：[播放 A](01-radial-play-a.jpg) / [播放 B](01-radial-play-b.jpg)，[指针左侧](01-radial-pointer-left.jpg) / [右侧](01-radial-pointer-right.jpg)。
- echo：[播放 A](04-echo-play-a.jpg) / [播放 B](04-echo-play-b.jpg)。
- wave 程序历史：[左侧](02-wave-history-pointer-left.jpg) / [右侧](02-wave-history-pointer-right.jpg)。
- ribbon 视频历史：[左侧](03-ribbon-history-pointer-left.jpg) / [右侧](03-ribbon-history-pointer-right.jpg)。
- clear 当前视频帧：[左侧](05-clear-history-pointer-left.jpg) / [右侧](05-clear-history-pointer-right.jpg)。

Chrome 留在正常播放的 ribbon 章节，可直接切换五章复看。
