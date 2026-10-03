验收不通过

实际 HEAD 为 a290fd782b68448d0032398766abb4e65f7b199e，分支为 feat/visual-lab-six-studies。开始与结束时核对一致，匹配预期 a290fd7。

验收页面：http://127.0.0.1:8765/dist/portal-threshold.html

验收时间：2026-10-04 03:28（UTC+8）。连接方式为 agent.browsers.get("chrome")；运行时报告 Name=Chrome、Type=extension、ID=1。复用已有的 8765 服务，目标页面返回 HTTP 200，并在 Chrome 中执行 Ctrl+Shift+R 硬刷新。常规视口截图为 1692×784 像素；完整页截图另行标注。

| 验收项 | 结果 | 现场证据 |
| --- | --- | --- |
| 1. 顶部八个体验同排 | 通过 | 八个入口从 01 寻色迁移到 08 折叠剧场完整同排，03 画中门高亮。实时 DOM 的八个入口 y 坐标均约为 28.60，界面没有 03–08 下拉。见 01、02。 |
| 2. 底部仅切换本页内容 | 通过 | 逐个点击四册手记与两个箭头。页脚的实时 DOM 只有这六个按钮，链接集合为空。右箭头 04→01、左箭头 01→04 均在本页完成，URL 始终保持目标地址。见 02、09、10、11。 |
| 3. 文案与画面同步 | 不通过 | 潮汐→林间的两次实测中，旧海岸的浪线、礁石和水面仍清晰可辨时，新标题“穿过林光，听见层次。”和林间正文已可读。背景此时为海岸与树林的交叠图，尚未完成替换。见 03-04（674ms）及复测 15-04（682ms）。 |
| 4. 四册有完整文案、场景与纹理 | 通过 | 潮汐档案有海岸、礁石、水纹；林间频率有蕨叶、苔藓、溪流；夜色坐标有高地湖面、群山、石柱和观测建筑；缓慢远行有冰川、峡湾、瀑布与雾气。各册均有主标题、正文和产品札记。见 02、04、06、08。 |

底部点击记录如下。四册按钮都实际点击，首册也在后续从第二册返回时重新点击确认。

| 控件 | 实际结果 |
| --- | --- |
| 01 / JOURNAL 潮汐档案 | 海岸场景；“推开门，潮汐仍在。”；计数 01 / 04 |
| 02 / JOURNAL 林间频率 | 树林场景；“穿过林光，听见层次。”；计数 02 / 04 |
| 03 / JOURNAL 夜色坐标 | 高地湖场景；“回望时，星夜有址。”；计数 03 / 04 |
| 04 / JOURNAL 缓慢远行 | 峡湾场景；“留一点时间，让远方发生。”；计数 04 / 04，自动漫游进入选中状态 |
| 右箭头 | 从 04 回到 01；恢复潮汐正文与海岸 |
| 左箭头 | 从 01 回到 04；恢复远行正文与峡湾 |

转场判定依据

先观察到旧文案随海岸淡出，之后新文案开始淡入；淡入确有发生，但新文案恢复可读时旧海岸仍明显存在。因此按本次“旧场景上出现清晰新文案即失败”的判定条件，第 3 项不通过。这里记录的是交叠期间的错配，静止后的四册图文均对应。

复现路径为点击“潮汐档案”，等待海岸与首册正文稳定，再点击“林间频率”。复测起点见 [14-recheck-start-tidal.jpg](shots/14-recheck-start-tidal.jpg)，中间帧见下图。

![复测中间帧：新林间文案已可读，旧海岸仍可辨](shots/15-confirmed-tidal-to-forest-04-682ms.jpg)

对照首次同类帧 [03-tidal-to-forest-04-674ms.jpg](shots/03-tidal-to-forest-04-674ms.jpg)，以及完成后的 [15-confirmed-tidal-to-forest-08-1455ms.jpg](shots/15-confirmed-tidal-to-forest-08-1455ms.jpg)。文件名中的毫秒数是点击调用返回后到截图返回的累计时间，包含截图传输开销，只用于序列定位。

截图索引

本次保存 60 张 JPEG，目录为 D:/AI_Projects/chromatic-tile-transport/runs/qa-s03-r2/shots/。所有序列按实际捕获顺序保留。13 组捕获时画面已经处于林间，因此作为同册点击记录，不作为潮汐→林间的判定证据；明确起点的复测是 14、15 组。12 记录第四册启用漫游后回到首册的实际画面。

| 序号 | JPEG 文件 | 内容 |
| --- | --- | --- |
| 01 | [01-journal-tidal-top-footer.jpg](shots/01-journal-tidal-top-footer.jpg) | 首屏；顶部八入口与潮汐场景 |
| 02 | [02-footer-all-controls.jpg](shots/02-footer-all-controls.jpg) | 滚动到底部；四册按钮与两个箭头 |
| 03 | [03-tidal-to-forest-01-172ms.jpg](shots/03-tidal-to-forest-01-172ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 04 | [03-tidal-to-forest-02-325ms.jpg](shots/03-tidal-to-forest-02-325ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 05 | [03-tidal-to-forest-03-488ms.jpg](shots/03-tidal-to-forest-03-488ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 06 | [03-tidal-to-forest-04-674ms.jpg](shots/03-tidal-to-forest-04-674ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 07 | [03-tidal-to-forest-05-835ms.jpg](shots/03-tidal-to-forest-05-835ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 08 | [03-tidal-to-forest-06-1014ms.jpg](shots/03-tidal-to-forest-06-1014ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 09 | [03-tidal-to-forest-07-1235ms.jpg](shots/03-tidal-to-forest-07-1235ms.jpg) | 潮汐→林间连续帧；04 帧为问题证据 |
| 10 | [04-journal-forest-full.jpg](shots/04-journal-forest-full.jpg) | 林间场景完整页截图 |
| 11 | [05-forest-to-night-01-210ms.jpg](shots/05-forest-to-night-01-210ms.jpg) | 林间→夜色连续帧 |
| 12 | [05-forest-to-night-02-443ms.jpg](shots/05-forest-to-night-02-443ms.jpg) | 林间→夜色连续帧 |
| 13 | [05-forest-to-night-03-731ms.jpg](shots/05-forest-to-night-03-731ms.jpg) | 林间→夜色连续帧 |
| 14 | [05-forest-to-night-04-1091ms.jpg](shots/05-forest-to-night-04-1091ms.jpg) | 林间→夜色连续帧 |
| 15 | [05-forest-to-night-05-1278ms.jpg](shots/05-forest-to-night-05-1278ms.jpg) | 林间→夜色连续帧 |
| 16 | [05-forest-to-night-06-1444ms.jpg](shots/05-forest-to-night-06-1444ms.jpg) | 林间→夜色连续帧 |
| 17 | [05-forest-to-night-07-1611ms.jpg](shots/05-forest-to-night-07-1611ms.jpg) | 林间→夜色连续帧 |
| 18 | [06-journal-night.jpg](shots/06-journal-night.jpg) | 夜色坐标稳定场景 |
| 19 | [07-night-to-journey-01-155ms.jpg](shots/07-night-to-journey-01-155ms.jpg) | 夜色→远行连续帧 |
| 20 | [07-night-to-journey-02-315ms.jpg](shots/07-night-to-journey-02-315ms.jpg) | 夜色→远行连续帧 |
| 21 | [07-night-to-journey-03-471ms.jpg](shots/07-night-to-journey-03-471ms.jpg) | 夜色→远行连续帧 |
| 22 | [07-night-to-journey-04-641ms.jpg](shots/07-night-to-journey-04-641ms.jpg) | 夜色→远行连续帧 |
| 23 | [07-night-to-journey-05-832ms.jpg](shots/07-night-to-journey-05-832ms.jpg) | 夜色→远行连续帧 |
| 24 | [07-night-to-journey-06-988ms.jpg](shots/07-night-to-journey-06-988ms.jpg) | 夜色→远行连续帧 |
| 25 | [07-night-to-journey-07-1172ms.jpg](shots/07-night-to-journey-07-1172ms.jpg) | 夜色→远行连续帧 |
| 26 | [08-journal-journey.jpg](shots/08-journal-journey.jpg) | 缓慢远行稳定场景 |
| 27 | [09-next-wrap-04-to-01-01-186ms.jpg](shots/09-next-wrap-04-to-01-01-186ms.jpg) | 右箭头 04→01 连续帧 |
| 28 | [09-next-wrap-04-to-01-02-352ms.jpg](shots/09-next-wrap-04-to-01-02-352ms.jpg) | 右箭头 04→01 连续帧 |
| 29 | [09-next-wrap-04-to-01-03-526ms.jpg](shots/09-next-wrap-04-to-01-03-526ms.jpg) | 右箭头 04→01 连续帧 |
| 30 | [09-next-wrap-04-to-01-04-700ms.jpg](shots/09-next-wrap-04-to-01-04-700ms.jpg) | 右箭头 04→01 连续帧 |
| 31 | [09-next-wrap-04-to-01-05-930ms.jpg](shots/09-next-wrap-04-to-01-05-930ms.jpg) | 右箭头 04→01 连续帧 |
| 32 | [09-next-wrap-04-to-01-06-1096ms.jpg](shots/09-next-wrap-04-to-01-06-1096ms.jpg) | 右箭头 04→01 连续帧 |
| 33 | [09-next-wrap-04-to-01-07-1251ms.jpg](shots/09-next-wrap-04-to-01-07-1251ms.jpg) | 右箭头 04→01 连续帧 |
| 34 | [10-next-wrap-result-01.jpg](shots/10-next-wrap-result-01.jpg) | 右向循环完成，首册海岸 |
| 35 | [11-prev-wrap-01-to-04-01-166ms.jpg](shots/11-prev-wrap-01-to-04-01-166ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 36 | [11-prev-wrap-01-to-04-02-330ms.jpg](shots/11-prev-wrap-01-to-04-02-330ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 37 | [11-prev-wrap-01-to-04-03-531ms.jpg](shots/11-prev-wrap-01-to-04-03-531ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 38 | [11-prev-wrap-01-to-04-04-696ms.jpg](shots/11-prev-wrap-01-to-04-04-696ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 39 | [11-prev-wrap-01-to-04-05-870ms.jpg](shots/11-prev-wrap-01-to-04-05-870ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 40 | [11-prev-wrap-01-to-04-06-1014ms.jpg](shots/11-prev-wrap-01-to-04-06-1014ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 41 | [11-prev-wrap-01-to-04-07-1168ms.jpg](shots/11-prev-wrap-01-to-04-07-1168ms.jpg) | 左箭头 01→04 连续帧；07 帧确认第四册 |
| 42 | [12-autoroam-return-to-01.jpg](shots/12-autoroam-return-to-01.jpg) | 自动漫游回到首册 |
| 43 | [13-recheck-tidal-to-forest-01-283ms.jpg](shots/13-recheck-tidal-to-forest-01-283ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 44 | [13-recheck-tidal-to-forest-02-557ms.jpg](shots/13-recheck-tidal-to-forest-02-557ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 45 | [13-recheck-tidal-to-forest-03-826ms.jpg](shots/13-recheck-tidal-to-forest-03-826ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 46 | [13-recheck-tidal-to-forest-04-1036ms.jpg](shots/13-recheck-tidal-to-forest-04-1036ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 47 | [13-recheck-tidal-to-forest-05-1253ms.jpg](shots/13-recheck-tidal-to-forest-05-1253ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 48 | [13-recheck-tidal-to-forest-06-1489ms.jpg](shots/13-recheck-tidal-to-forest-06-1489ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 49 | [13-recheck-tidal-to-forest-07-1763ms.jpg](shots/13-recheck-tidal-to-forest-07-1763ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 50 | [13-recheck-tidal-to-forest-08-1998ms.jpg](shots/13-recheck-tidal-to-forest-08-1998ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 51 | [13-recheck-tidal-to-forest-09-2264ms.jpg](shots/13-recheck-tidal-to-forest-09-2264ms.jpg) | 同册林间点击记录；捕获起点已是树林 |
| 52 | [14-recheck-start-tidal.jpg](shots/14-recheck-start-tidal.jpg) | 复测起点：海岸与潮汐正文已稳定 |
| 53 | [15-confirmed-tidal-to-forest-01-128ms.jpg](shots/15-confirmed-tidal-to-forest-01-128ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 54 | [15-confirmed-tidal-to-forest-02-322ms.jpg](shots/15-confirmed-tidal-to-forest-02-322ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 55 | [15-confirmed-tidal-to-forest-03-491ms.jpg](shots/15-confirmed-tidal-to-forest-03-491ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 56 | [15-confirmed-tidal-to-forest-04-682ms.jpg](shots/15-confirmed-tidal-to-forest-04-682ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 57 | [15-confirmed-tidal-to-forest-05-874ms.jpg](shots/15-confirmed-tidal-to-forest-05-874ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 58 | [15-confirmed-tidal-to-forest-06-1047ms.jpg](shots/15-confirmed-tidal-to-forest-06-1047ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 59 | [15-confirmed-tidal-to-forest-07-1245ms.jpg](shots/15-confirmed-tidal-to-forest-07-1245ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
| 60 | [15-confirmed-tidal-to-forest-08-1455ms.jpg](shots/15-confirmed-tidal-to-forest-08-1455ms.jpg) | 明确起点的潮汐→林间复测；04 帧为问题证据 |
