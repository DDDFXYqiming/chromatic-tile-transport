# Matrix Motion 界面

Matrix 页面采用深色背景、中文衬线标题、细边框和底部影像导航。

| 系列 | 入口 | 整轮时长 |
|---|---|---|
| 花园分层版 | [matrix-motion.html](../dist/matrix-motion.html) | 15.6 秒 |
| 花园双视频 | [matrix-video.html](../dist/matrix-video.html) | 10.4 秒 |
| 青空偏航 | [matrix-anime.html](../dist/matrix-anime.html) | 21.5 秒 |
| 绯刃交锋 | [matrix-battle.html](../dist/matrix-battle.html) | 21.5 秒 |

页头提供影像档案、巡航、导演台和沉浸按钮。左下方显示章节标题与下一幕入口，右上方显示播放状态、渲染后端和格点数量。底部时间轴支持正反拖动，章节变化会同步缩略图与侧边标记。

影像档案支持选幕和切换系列。打开档案时，时间轴和视频暂停；关闭后继续先前的巡航，或保留原来的暂停状态。Escape 关闭对话框并将焦点返回打开按钮。

默认展示完整界面。纯画面开关隐藏标题、状态与遮罩，沉浸模式进一步隐藏页头和底栏。小屏保留系列入口和章节导航，短竖屏收起次要说明。

源码位于 `src/matrix/index.template.html`、`style.css` 和 `main.js`。`tests/browser_matrix_interface.py` 检查组件同步、模态暂停、焦点恢复及不同屏幕尺寸的布局。
