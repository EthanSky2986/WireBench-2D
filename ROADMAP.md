# Roadmap / 路线图

路线图按优先级记录方向，不承诺固定日期。已实现内容见[变更记录](CHANGELOG.md)。v0.1.1-alpha 已包含 SB 对齐、共用灯面板六端子、FR 独立 TEST/RESET 和紧凑页头；继续以下载后本地运行的方式提供。

This roadmap orders priorities rather than promising dates. See the [changelog](CHANGELOG.md) for implemented work. v0.1.1-alpha includes aligned SB controls, a shared lamp panel with six terminals, independent FR TEST/RESET controls, and a compact header. It remains available for download and local use.

## Near term / 近期方向

- **本地多项目管理**：目前只有一份自动保存的自主稿。后续增加本地项目的创建、命名和切换，同时保护已有接线与损坏存档。
- **文件保存与恢复**：完成真实导出落盘和重新导入的完整验证，保持失败操作不丢失当前方案。
- **独立课堂试用**：请学生或教师在不依赖开发者提示的情况下完成三种基础实验，收集端子辨认、操作顺序和结果理解方面的反馈；该试用尚未完成。

English: Add local project creation, naming, and switching beyond the current single autosaved workspace; verify a real file-download/reimport round trip while preserving data on failure; complete the still-pending independent student/teacher trial of the three basic examples.

## Further improvements / 后续改进

- **接线可读性**：评估自动生成路径的分道、交叉处跨线桥和圆弯导线推广；保留用户手调路径，视觉交叉不改变电气连接。
- **兼容性与可访问性**：扩大桌面浏览器、键盘、减少动态效果和窄屏验证；根据试用反馈决定触控优先级。
- **性能**：用真实高线数方案测量缩放、拖动和选线，先定位问题再优化；500 根导线的性能尚未验证。
- **教学体验**：补充循序渐进的操作提示和故障练习，保持示例使用与自主接线相同的仿真规则。

English: Improve wire readability while preserving manual routes and topology; broaden browser and accessibility verification; measure larger circuits before optimizing, including the unverified 500-wire case; add progressive guidance and troubleshooting exercises without hard-coding example outcomes.

## Requires new electrical scope / 需要先补充电气定义

真实 24 V / 220 V 数值、三相电源、电机正反转与自动往返、温升和热保护延时需要明确器件参数、实验预期和模型边界。先收集资料并确定验证方法，再排入实现；已有电机端子不代表这些功能已经支持。FR 的 TEST/RESET 目前只操作逻辑跳闸状态，不模拟真实热过载或旋钮整定值。

Physical 24 V / 220 V behavior, three-phase supply, motor direction and reciprocation, heating, and timed thermal trips require device parameters, expected results, and explicit model boundaries before implementation. Reserved motor terminals do not mean these capabilities are supported. FR TEST/RESET currently changes the logical trip state; real thermal overload and current-dial settings are not simulated.
