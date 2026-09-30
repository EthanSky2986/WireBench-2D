# Contributing / 贡献指南

欢迎提交可复现的问题、界面与文档改进，以及有依据的教学模型修正。项目已以 MIT 许可开放 alpha 教学预览版。使用中文或英文均可。

Reproducible bug reports, UI/documentation improvements, and well-supported corrections to the teaching model are welcome. The project is available as an MIT-licensed alpha teaching preview. Chinese and English are both welcome.

## Start here / 开始

需要 Node.js **22.12+**（推荐 **24 LTS**）和 npm：

Use Node.js **22.12+** (**24 LTS** recommended) and npm:

```sh
npm ci
npm run dev
npm run check
```

`npm run check` 包含格式检查、TypeScript/构建与逻辑测试。格式修改可使用 `npm run format`。交互改动还需在真实浏览器验证；请记录实际运行的检查。

`npm run check` runs formatting checks, TypeScript/build, and logic tests. Use `npm run format` to apply formatting. Interaction changes also need real-browser verification; report the checks actually performed.

## Report a problem / 反馈问题

通过仓库 Issue 模板说明：发生了什么、怎样复现、预期结果、实际结果、操作系统与浏览器。仿真问题最好附最小接线示例，写明按钮操作顺序和通断电状态。截图可帮助定位外观问题；项目文件请移除个人信息，不上传无权公开的资料。

Use an issue template to describe the steps, expected and actual results, OS, and browser. Simulation reports benefit from a minimal circuit plus the order of button and power operations. Screenshots help with visual issues. Remove personal information from attached projects and only share materials you have permission to publish.

## Make a focused change / 提交修改

- 先阅读[架构说明](docs/ARCHITECTURE.md)与[详细开发约定](docs/CONTRIBUTING.md)。涉及新器件、存档版本或数值仿真时，先在 Issue 中明确范围与数据来源。
- 一个修改解决一个清楚的问题，避免同时进行无关重构。新增依赖应有明确用途。
- PR 描述说明问题、修改后的行为、实际验证与仍存在的限制；UI 修改附截图，电气规则修改附可复现接线测试。
- 代码与原创文档采用 [MIT](LICENSE)。新增图片、资料或其他第三方内容需标明来源与许可，并更新 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；项目 MIT 不替代它们各自的授权。

English: Read the architecture and detailed conventions first; discuss new device/model or file-format scope with its evidence. Keep changes focused. Describe the problem, final behavior, actual validation, and remaining limits in the PR. Include screenshots for UI changes and circuit-based regression tests for electrical changes. Original code/docs use MIT; document separate rights for third-party materials.

## Boundaries to preserve / 必须保持的边界

| Boundary               | 约定 / Rule                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Electrical definitions | `src/sim/model.ts` 是器件与端子 ID 的唯一来源。Keep device and terminal IDs stable and defined in one place.                                           |
| Simulation             | `src/sim/engine.ts` 保持纯函数，不依赖 DOM、时钟或示例名称。Use actual circuit connectivity, not special behavior for named examples.                  |
| Layout                 | 外观、颜色、路径与交叉不改变电气拓扑。Artwork and wire geometry must not change connectivity.                                                          |
| Saved projects         | 导入统一经 `src/project.ts` 校验，存储使用 `src/storage.ts`；不静默丢弃未知数据。Validate external data and preserve damaged or unsupported originals. |
| Language / theme       | 系统文案集中于 `src/i18n`，中英文同步；主题使用语义色。Keep both languages complete and use semantic theme tokens.                                     |
| Evidence               | 未确认的额定值或未支持的接法不能伪装成真实仿真。Document model limits and do not invent physical ratings or results.                                   |

详细维护文档当前以中文为主；欢迎在保持技术含义一致的前提下补充翻译。

Detailed maintenance documents are currently primarily Chinese. Translations that preserve their technical meaning are welcome.
