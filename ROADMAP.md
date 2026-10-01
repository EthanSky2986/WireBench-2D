# Roadmap / 路线图

路线图按优先级记录方向，不承诺固定日期。已实现内容见[变更记录](CHANGELOG.md)，逐项发布验收状态见[开源准备清单](docs/OPEN_SOURCE_READINESS.md)。

This roadmap orders priorities rather than promising dates. See the [changelog](CHANGELOG.md) for implemented work and [open-source readiness](docs/OPEN_SOURCE_READINESS.md) for release checks.

近期执行顺序与完成标准见[质量改进计划](docs/QUALITY_PLAN.md)。先修正当前器件与交互，再独立完成本地项目管理及存档验收，随后扩展教学功能。

Near-term order and acceptance criteria are tracked in the [quality plan](docs/QUALITY_PLAN.md): device corrections, safe local project management, then teaching extensions.

## Alpha validation / Alpha 试用与验收

目标：让第一次接触项目的人能够独立启动，完成三种基础实验，知道模型的适用范围，并能提供可复现反馈。

Goal: A new user can start the application, complete the three basic examples, understand the model's limits, and report a reproducible problem.

- 从干净目录安装、检查、构建与启动；记录实际 Node.js 和浏览器环境。
- 验证导出文件实际落盘、再导入，以及原方案不会因失败操作而丢失。
- 请学生或教师完成一次不依赖开发者提示的试用，核对端子、操作顺序和实验结果。
- 采用已确认的 MIT 许可，记录第三方依赖；从公开副本排除用户提供的全部照片、手绘、产品图片及其副本，验证新历史不含旧提交。
- 提供中英文 README、最新截图、已知限制、贡献入口与问题模板。

English: Validate installation from a clean directory; verify real file export and reimport; complete an independent student/teacher trial; document MIT and dependency licenses; verify that the public copy and its fresh history exclude all user-supplied images and prior commits; provide bilingual onboarding, current screenshots, limits, and feedback templates.

## After the preview / 预览版后的改进

- **接线可读性**：评估自动生成路径的分道、交叉处跨线桥和圆弯导线推广；保留用户手调路径，视觉交叉不改变电气连接。
- **兼容性与可访问性**：扩大桌面浏览器、键盘、减少动态效果和窄屏验收；根据试用反馈决定触控优先级。
- **性能**：用真实高线数方案测量缩放、拖动和选线，先定位问题再优化。
- **教学体验**：补充循序渐进的操作提示和故障练习，保持示例使用与自主接线相同的仿真规则。

English: Improve wire readability while preserving manual routes and topology; broaden browser and accessibility verification; measure larger circuits before optimizing; add progressive guidance and troubleshooting exercises without hard-coding example outcomes.

## Requires new electrical scope / 需要先补充电气定义

真实 24 V / 220 V 数值、三相电源、电机正反转与自动往返、温升和热保护延时需要明确器件参数、实验预期和模型边界。先收集资料并确定验证方法，再排入实现；已有电机端子不代表这些功能已经支持。

Physical 24 V / 220 V behavior, three-phase supply, motor direction and reciprocation, heating, and timed thermal trips require device parameters, expected results, and explicit model boundaries before implementation. Reserved motor terminals do not mean these capabilities are supported.
