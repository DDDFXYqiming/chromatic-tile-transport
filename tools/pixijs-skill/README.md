# PixiJS 单入口技能包

`pixijs-complete.skill.zip` 保存本项目使用的完整整合版。上游为 [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills)，固定修订 `6aae70d76cf410432dd144029c07a1ad4bb12793`，MIT 许可证随包保留。

包内只有一个可发现的 `pixijs/SKILL.md`。全部 81 个上游文件均已保留，26 个专题改为内部 `GUIDE.md`，原始文件和符号链接元数据另存于包内归档。它作为开发参考使用，页面运行只依赖 `src/vendor/` 中固定版本的 PixiJS 代码。

安装时将压缩包中的 `pixijs` 文件夹放入当前环境实际使用的个人技能目录。本项目本机使用 `C:/Users/39795/.codex/skills/pixijs/`。如果已有旧 PixiJS 技能目录，先移至扫描目录外备份，再安装这个单入口；不要把原始归档中的各个 `SKILL.md` 解压回技能扫描目录。

安装后可用 `$pixijs`。从安装目录运行 `python scripts/verify_bundle.py` 可检查文件完整性、Git 原始内容哈希、本地链接及唯一入口。

## 重建或更新

保留的 `build_bundle.py` 与 `verify_bundle.py` 用于重新打包。先将上游仓库克隆到技能扫描目录之外，检出待验证的固定修订，再指定输入与一个尚不存在的输出目录。

```powershell
python tools/pixijs-skill/build_bundle.py --repo <上游仓库路径> --output <输出目录>/pixijs
python tools/pixijs-skill/verify_bundle.py <输出目录>/pixijs
```

构建器只读取指定本地仓库，不自行下载、安装或替换已有技能。更新后还应检查入口描述、专题路由和相关接口是否适用于项目所用的 PixiJS 版本。上游示例采用 CDN，它是参考示例；本项目离线页面仍使用本地 vendor。
