# 星海视觉实验室 · 两套效果，一个仓库

在原有 **V3.1 寻色格片迁移**之外，新增独立的 **Matrix Motion / 星海成像**。五张星铁原画不变，第一套运行代码和 `dist/index.html` 原样保留。

| 效果 | 入口 | 观看重点 |
|---|---|---|
| 01 · 寻色迁移 | [原版 Demo](dist/index.html) | 格片根据颜色寻找目的地，沿曲线搬家 |
| 02 · 星海成像 | [Matrix Motion](dist/matrix-motion.html) | 镜头、双色、色阶与线稿；0.48 秒固定点阵桥 |

**双效果展厅：[index.html](index.html)**。从仓库根目录启动，再用浏览器打开 localhost：

```powershell
python scripts/serve.py --directory . --port 8000
# http://127.0.0.1:8000/
```

第二套默认入口是轻量链接预览，需要服务整个仓库；生成可双击的离线成品：

```powershell
python scripts/build_matrix.py --output dist/matrix-motion-offline.html
```

导演台可暂停并对比原画、双色、色块、线描、固定点阵；底部可倒拖，F 进入纯画面沉浸。它不需要 GIF、不调用模型、不上传素材。局部视差是焦点附近的连续变形，不是真实人物分层；效果受参考视频启发，不宣称源码或逐帧复刻。

第二套详见 **[原理、参数与验收](docs/MATRIX_MOTION.md)**，智能体入口为 **[Matrix Motion SKILL](skills/matrix-motion/SKILL.md)**；原版规程仍在 **[skill.md](skill.md)**。

```powershell
python scripts/check_matrix.py --browser
python scripts/check.py --browser
```


## 项目结构与开发

- `src/` 根目录文件属于效果 01；`src/matrix/` 属于效果 02，两套运行时独立。
- `src/showcase.html` 生成根展厅，`scripts/build_showcase.py` 不覆盖任何效果。
- `examples/matrix-motion/config.json` 调整第二套参数，仍使用 `examples/starrail/scenes.json` 的五张原图。
- `scripts/render_matrix_preview.py` 导出第二套的真实网页逐帧视频；这不是设备 FPS 跑分。

完整原版说明原文保存在 **[README-transport.md](README-transport.md)**。原图、压缩素材、旧构建器、旧匹配算法及旧成品未改变。

## 可复现的边界

Matrix Motion 是参考视频启发的独立实现，不是原站源码或逐帧复刻。静态图可以实现数字显影和镜头变化，但不能凭空得到人物骨骼动画或独立透明图层。

GPU 主效果为 WebGL 2；不支持时有简化 Canvas 2D 路径。自动浏览遵循系统减少动态偏好。源码没有外部模型、CDN、上传或分析埋点。美术版权归原权利人，勿将示例图片作为商业授权素材。
