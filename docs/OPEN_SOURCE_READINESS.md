# Alpha 发布检查 / Open-source release checks

版本：[`v0.1.0-alpha`](https://github.com/EthanSky2986/WireBench-2D/releases/tag/v0.1.0-alpha)，2026-10-01 首个 MIT 开源教学预览版。维护者已批准发布，下面明确记录已验证项目与尚未完成的 Alpha 试用。

Version: `v0.1.0-alpha`, the first MIT open-source teaching preview, dated 2026-10-01. Publication is approved by the maintainer; completed checks and remaining alpha validation are recorded below.

## 已确定的发布方式

- 原创代码、文档与程序生成图形采用 [MIT](../LICENSE)。运行时依赖声明保留在 [第三方说明](../THIRD_PARTY_NOTICES.md) 和生产构建内。
- 用户提供的所有实物照片、产品图片、手绘图及旋转/公开资源副本均不随发布。应用中的“端子布局”直接从模型和布局代码生成，不请求原图。
- 旧私有仓库历史包含这些资料，因此保持私有。公开使用经过检查的新历史副本，不能直接将旧仓库改为公开；删除当前文件并不会删除旧提交中的副本。
- `package.json` 的 `private: true` 保留，以防误发布 npm 包。它不控制 GitHub 仓库可见性。

The public copy must use fresh history. All supplied reference images are excluded; generated screenshots and the code-rendered terminal layout remain. Keep the original repository private. MIT and third-party notices apply to their stated scopes; no npm publication is required.

## 可重复生成干净副本

先提交准备好的改动，确保 `git status --short` 为空，再执行：

```sh
npm run check
npm run prepare:public
```

脚本返回发布副本的绝对路径、来源提交、候选提交、扫描数量与截图元数据处理结果。它会：

1. 从明确的 `HEAD` 导出跟踪文件，不复制 `.git`、本地依赖或未提交内容。
2. 拒绝符号链接、子模块与原始图片路径，使用排除清单中的 SHA-256 指纹识别改名副本。指纹不能用于恢复原图片；任意重新编码的衍生图仍需人工检查。
3. 对副本中的程序截图去除 EXIF/XMP、Photoshop/IPTC 与注释段，保留 JPEG 像素压缩数据与 ICC 色彩信息。
4. 再次检查文件，随后初始化只有一个提交的 `main`，使用通用作者身份，不添加远程地址。
5. 不删除或改写来源仓库及其历史，不执行推送或公开操作。

Then enter the printed candidate directory, run `npm ci` and `npm run check`, and inspect the build and repository. The candidate has no remote and only one initial commit. The exporter never changes the source history or publishes anything.

默认副本在系统临时目录，正式发布前应将确认过的副本放到稳定目录或重新生成。记录实际使用的来源/候选提交，不能把之后的开发改动误认为已通过本次验收。

## 当前核查证据与限制

| 项目       | 证据 / 状态                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全新安装   | 干净发布副本使用 Node 24、npm 11 完成 `npm ci`、格式检查、类型与生产构建，以及 14 个文件中的全部 156 项测试                                                         |
| 依赖漏洞   | 干净发布副本安装报告 0 项依赖漏洞；这是当次数据库结果，不保证未来没有漏洞                                                                                           |
| 历史内容   | 核查时 11 个可达提交、219 个唯一 blob；限定密钥、私钥、令牌和个人绝对路径模式未命中；提交身份使用 GitHub noreply                                                    |
| 扫描范围   | 没有安装 Gitleaks/TruffleHog；限定规则与图像元数据检查不能保证发现所有敏感内容，最终仍需浏览候选文件                                                                |
| 图片       | 当前版本排除 24 份用户图片/副本（23 个唯一指纹）；历史资料只留在原私有仓库                                                                                          |
| 跨平台     | 本机 Mac + Node 24 已验证；来源提交的 Ubuntu/Windows × Node 22.12/24 四组 CI 均通过；公开提交结果见 [Actions](https://github.com/EthanSky2986/WireBench-2D/actions) |
| 浏览器     | 桌面浏览器主要流程已记录于 [验收记录](VERIFICATION.md)；手机触控和所有浏览器组合不作为本次 alpha 保证                                                               |
| 保存与文件 | 本地保存、导入校验、序列化已测试；真实文件下载落盘与从该文件重新导入仍需完成一次用户端验证                                                                          |
| 教学边界   | 理想通断模型；三相、电机运动、实际电压电流及温升不在当前能力范围                                                                                                    |

## Alpha 阶段待完成的独立试用

以下是尚未完成的人工验收，不代表已通过。请一位未参与开发的同学或老师按 README 操作，并记录环境和结果；反馈将用于后续 Alpha 修复。

- [ ] 全新目录按说明启动，完成按钮点灯、接触器点动、自锁启停。
- [ ] 自己改一条线，确认动作随实际接线变化；停止、急停、FR 测试符合预期。
- [ ] 导出一个有名称的方案，确认文件真正下载，再导入该文件核对名称、线数和路径。
- [ ] 尝试明暗、中英文、全屏、重置与退出示例，确认能够返回原自主稿。
- [x] 检查发布副本：121 个跟踪文件未命中 23 个排除指纹；图片为程序截图，敏感截图元数据已移除；新历史不含旧提交，MIT 与运行时依赖声明完整。

本次以明确标注边界的 Alpha 预发布开放反馈，不将上述人工试用写成通过。应用采用逻辑通断模型；不是完成课堂验收的稳定版。

An independent student/teacher trial and a real export/reimport round trip remain unverified. This alpha prerelease invites feedback with those limits stated explicitly; it is not a classroom-validated stable release.

后续参考资料继续只在本机核对：2026-10-01 灯面板补图的三个指纹已加入排除清单，当前共 26 个指纹。新截图由程序界面生成，原始补图不进入仓库。
