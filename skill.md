---
name: chromatic-tile-transport
description: 使用本项目脚本，将用户提供的图片构建成内容驱动的寻色格片迁移网页；调整配色、焦点、密度与连续时间轴，并通过算法、像素和播放验收。适用于创建同类转场、替换素材或修复节奏问题，不用于生成图片。
---

# 寻色格片迁移 · 智能体操作规程

## 目标和边界

构建可运行的网页产物，而非输出效果描述、静态设计图或图片生成请求。格片目标位置必须由输入图片颜色计算，不能用随机置换或固定旋转冒充内容迁移。默认采用已经修复停顿的 V3.1 时间轴。

保留两项核心不变量：源格片与目标格子一一对应；相同图片、裁切、格阵与参数得到确定性的映射及画面。颜色配对不是语义理解，不能描述成“识别人脸后搬运五官”。没有外部模型调用、账号体系、分析埋点或 CDN 依赖。

本技能文件可能被安装到任意技能目录。**先找到包含 `project.json`、`scripts/build.py`、`src/matcher.js` 的实际项目根目录**，将其记为 `REPO_ROOT`。下列命令均从该目录运行，不把技能安装路径当作项目路径。未找到项目时，请用户提供项目目录或源码包，不凭空猜测本地路径。

`skill.md` 是规范源。`skills/chromatic-tile-transport/SKILL.md` 是同内容副本；变更规范后运行 `python scripts/sync_skill.py`。不需要修改本技能来替换图片或调整普通配置。

## 1. 先检查已有输入

读取 `project.json`、`README.md`，以及用户指定的 `scenes.json`、`config.json`。用户只要求修一个问题时，先复现该问题，不更换主题或大幅重做视觉。

确认图片是真实存在的可读取文件，PNG/JPEG/WebP 均可。不要根据文件名生成替代图片，不要从互联网自动找图混入用户素材。把用于构建的输入放在项目内；原图与压缩后的运行素材分目录存放，避免覆盖原图。没有授权，不把素材提交到公开仓库。

仅看已有主示例，无需安装依赖，打开 `dist/index.html` 即可。默认构建需要 Python 3.10+；算法测试另需 Node.js 18+。仅素材预处理、截图和浏览器验收需要 `requirements-dev.txt`；不要无理由引入前端框架或额外构建工具。

## 2. 为新图片建立清单

不要改默认 `examples/starrail/` 来试验用户新图片，除非用户明确要求更新该示例。新建 `examples/<项目名>/` 和 `assets/<项目名>/`，复制默认 `config.json` 后修改。

有已处理图片时直接编辑清单。需要批量压缩时：

```sh
python -m pip install -r requirements-dev.txt
python scripts/prepare_assets.py --input assets/my-originals --output assets/my-gallery --manifest examples/my-gallery/scenes.json --max-width 2048 --quality 86
```

此脚本要求 2–24 张图片，按文件名排序，拒绝覆盖已有清单/素材。用户指定顺序时通过 `scenes.json` 调整，不把自动字典排序当成设计决定。

每条清单必须包含：`slug`、`name`、`en`、`line1`、`line2`、`caption`、`tag`、`accent`、`position`、`src`。

- `slug` 使用唯一的字母/数字/下划线/短横线。
- `src` 相对于 **该 scenes.json 所在目录**；文件必须留在项目内；不填 URL 或 base64。
- `position: [x,y]` 是可见裁切焦点，取值 0–1。根据实际人物/主体位置设置；手机测试后再微调。
- `accent` 必须为六位 `#RRGGBB`。
- `width/height` 可省略，由构建器读取真实图像头。不要随意填写；不匹配会报错。

先采用明暗、构图反差明显的相邻两张图片验证，再扩展场景数。保留用户指定素材及顺序优先于自己的审美偏好。

## 3. 构建相同机制的网页

```sh
python scripts/build.py --scenes examples/my-gallery/scenes.json --config examples/my-gallery/config.json --output dist/my-gallery.html
```

构建失败时读取明确错误，修复清单或配置；不要删除校验，也不要回退到远程图片加载。产物内嵌全部素材、脚本与样式，可以离线打开。

`config.json` 的顶层文本字段为 `title`、`brand`、`description`、`notice`。保留诚实的素材权利和非官方说明。可选 `autoplay`、`cleanView` 为布尔值。`options` 是运行参数，`motion` 是时间参数。

需要浏览器 HTTP 环境时：

```sh
python scripts/serve.py
```

它只监听 localhost。不要未经用户要求启用公网访问、隧道或 Pages。

## 4. 参数调整顺序

先固定颜色匹配为 `options.mapping: "color"`。只改变一个参数组，并保留前后对照。

| 需求 | 修改位置 | 建议起点与验收 |
|---|---|---|
| 太细碎或性能成本高 | `options.density`、`trails` | 152→96，或关闭尾迹；检查轮廓仍可辨认。Canvas 兼容路径有自己的更低格阵上限。 |
| 颜色更相似但允许更远迁移 | `options.spatial` | 0.022→0.002；读取平均色差和移动距离，不只靠感觉。 |
| 运动太散 | `options.spatial` | 0.022→0.095；不要把它改成固定位置映射。 |
| 只改变播放速度 | `options.duration` | 4 / 5.8 / 8 秒；不修改内部阶段关系。 |
| 完整原图看不清 | `options.holdTime` | 增加完整图片停留；不在转场中间增加停留。 |
| 主体被裁掉 | 清单 `position` | 重新计算桌面和手机可见区域，逐张验收。 |
| 查看原色搬运 | `options.holdColor` | 设 true 并 seek(0.76)；检查后恢复 false。 |
| 修改转场两端手感 | `motion` | 读取下节，保持阶段重叠，重新构建并跑时间回归。 |

所有修改后的数字必须有限；布尔值不能填字符串。未知参数是错误，不是被忽略的配置。`WarpArchive.configure()` 能即时更新 `options` 中的字段，不接受 `motion`；修改 `motion` 必须重新构建。

## 5. 时间轴：不可重新引入两段空等

默认时间设计：

```text
launchBase  = 0.015     launchSpread = 0.035
landBase    = 0.950     landSpread   = 0.035
ramp        = 0.08
splitEnd    = 0.10      fillStart    = 0.88
```

前四个参数是全局进度；后三个是每块格片的局部旅程进度，不能混为一谈。

计算器保留 V3 的颜色相关出发/抵达属性，`timing.js` 将其转换到更紧凑的时间窗口。局部进度为 `u=clamp((p-start)/(end-start),0,1)`。移动用 `travel(u)`，缝隙用 `mosaic(u)`，因此拆分和回填与移动发生重叠。

**禁止的修法：**只降低 `duration`；等拆分完成再开始迁移；等所有格片落位再统一填缝；给播放、滚动和导出各写一条时间曲线；只改 WebGL 而不改 Canvas；用白闪、黑屏或视频覆盖停顿；用随机噪声掩盖内容配对。

只调整 `src/timing.js` 的规范实现或配置，不在 `main.js` 中重新硬编码阶段常数。JS 与 GLSL 应继续来自同一个模块。出发顺序可以不同，但格片应在自己的拆分阶段开始移动，落位前就开始回填。

`src/matcher.js` 中每块格片的 `attrs` 步长是 10：目标 xy、控制点1 xy、控制点2 xy、旧起始时间、旧结束时间、色差、归一化移动距离。修改时间不应改变 `map` 或前六个路径属性。禁止因字段名包含“旧”就删除它们，它们仍携带配色相关的顺序信息。

## 6. 自动验收

先跑可在无浏览器环境完成的测试：

```sh
python scripts/check.py
```

再准备并运行完整回归：

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python scripts/check.py --browser
```

这会重建默认五幕示例，并检查匹配、时间曲线、构建输入、发布安全的模拟流程、WebGL/Canvas、无 Worker、暂停、逆向、循环与手机布局。发布安全测试是 mock，不是实际上新建了仓库。

用户新图片用通用验收脚本：

```sh
python scripts/inspect_demo.py --html dist/my-gallery.html --output reports/my-gallery
python scripts/inspect_demo.py --html dist/my-gallery.html --output reports/my-gallery-mobile --width 390 --height 844
```

必须检查输出 JSON：所有相邻组计划准备完成；`uniqueTargets == count`；没有未处理 JS/GL 错误；逆向回到同进度像素一致；没有外部网络请求；无横向溢出。打开脚本输出的截图，不能只看到 `allPassed` 就跳过图像检查。

默认五幕的时间修复验收还包括：五组 `map` 哈希与 `tests/fixtures/v3-desktop-metrics.json` 完全一致；旧停顿区的真实格片时间速度不为零；五个循环接缝恢复完整图像。不要在仅修改时间曲线时“更新基线”来让配对哈希测试通过。

不要把平均色差降低百分比当成美感评分，也不要求任意新图片的每项成本一定优于同坐标——算法优化的是组合目标，某项可能有取舍。

## 7. 视觉和交互验收

在浏览器中等待：

```js
WarpArchive.getState().plansReady === WarpArchive.getState().sceneCount
```

然后暂停，并依次观察：

```js
WarpArchive.pause();
WarpArchive.seek(0);
WarpArchive.seek(0.14);
WarpArchive.seek(0.20);
WarpArchive.seek(0.40);
WarpArchive.seek(0.81);
WarpArchive.seek(0.87);
WarpArchive.seek(1);
```

第一处应在格片分离时持续启程，第二处应持续移动并逐步缩小缝隙，不能出现整面格阵停住再切下一阶段。用相同方法抽检其余每一组图片，最后一幕还要检查回到第一幕的循环。

至少以 4、5.8、8 秒各播放一遍。检查正放、反向拖动、暂停再恢复、切换密度、窗口缩放、手机竖屏；确认文字和按钮仍是清晰的 DOM，没有被一同格片化。

视觉不自然时先区分原因：有加载提示且 Worker 正在算计划，是初始化/重算；进度匀速但画面几乎不变，是时间设计；帧时间长，是渲染成本。不要把这三种问题混为一谈。软件渲染的浏览器测试不是用户显卡性能测试；逐帧导出 MP4 更不代表实时 FPS。

需要视频时：

```sh
python scripts/render_preview.py --html dist/my-gallery.html --output docs/my-preview.mp4 --pairs 2 --fps 24
```

这一步另需 FFmpeg。不要为了补视频而改变验收页面的默认转场速度。

## 8. 交付和 GitHub 写入

交付构建好的 HTML、完整源码、用户素材/优化素材、清单、配置以及本轮报告。仅提供截图不算交付。报告中注明实际运行过哪些测试，哪些只是建议；不要复制旧测试报告冒充本轮执行。

用户明确要求私密仓库时才发布。先审查 `scripts/publish_private.py`，可先运行：

```sh
python scripts/publish_private.py --dry-run
```

在用户已授权的本地环境：

```powershell
pwsh -File .\scripts\publish-private.ps1
```

或跨平台：

```sh
python scripts/publish_private.py --owner DDDFXYqiming --name chromatic-tile-transport --login
```

脚本必须先核实账号，再创建 `private` 仓库，读取确认私密后才推送，最后核对远程 SHA。禁止默认公开、部署 Pages、将令牌写入 README/.env、修改无关仓库或 force-push。已有同名仓库默认停止；只有明确允许复用才传 `--resume-existing`。

当前交付环境未完成实际建库和推送。未来执行者只能在收到真实仓库响应及提交验证后报告“已上传”，不能把本地 dry-run、模拟测试或仓库名称当成远程存在的证据。
