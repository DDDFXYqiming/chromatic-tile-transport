# PixiJS 与网格动画

项目使用 `pixi.js@8.20.1` 合成二维图层，再把结果交给 Matrix 显影渲染器。库文件和许可证在 `src/vendor/`，普通构建无需联网安装依赖。

人物与花枝使用 MeshPlane，修改 `aPosition` 缓冲区后调用 `update()`。鱼身由 MeshRope 的中心线控制，背景使用 Sprite。两个离屏 Application 关闭自动 ticker，由共享时间轴驱动。

相关代码位于 `src/matrix/mesh.js`、`deformation.js` 和 `layers.js`。区域权重针对示例素材设计。人物纹理没有独立眼皮、口型和背面，无法完成完整角色表演。Canvas 兼容路径禁用局部网格形变。

开发参考来自 [PixiJS 官方技能仓库](https://github.com/pixijs/pixijs-skills)，固定修订为 `6aae70d76cf410432dd144029c07a1ad4bb12793`。[可移植参考包](../tools/pixijs-skill/README.md) 包含上游文档，安装位置由开发环境决定。

更新运行库时，用 `npm ci --ignore-scripts` 安装锁定依赖，再复制官方 bundle 与许可证。验证应覆盖网格翻折、面部比例、资源释放和上下文恢复。
