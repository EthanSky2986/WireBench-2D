# Changelog / 变更记录

## v0.1.0-alpha — 2026-10-01

首个 MIT 开源教学预览版。公开仓库使用全新历史，排除所有用户提供的图片。独立教学试用及真实文件下载与重新导入仍待验收；详见[发布检查记录](docs/OPEN_SOURCE_READINESS.md)。

First MIT open-source teaching preview. The public repository uses fresh history and excludes all user-supplied images. Independent classroom testing and a real file-download/reimport round trip remain unverified; see [release checks](docs/OPEN_SOURCE_READINESS.md).

### Added / 新增

- 自由端子接线及按钮点灯、接触器点动、自锁启停示例；理想开关、接触器、灯和保护辅助触点仿真。
- 16 个器件、113 个可选端子，正式实验台与详情使用统一的新版 SVG 外观。
- 中英文界面、全局明暗主题、侧栏折叠、全屏、缩放和平移。
- 导线选中闪烁、端点标记、重叠线轮选；手动拐点编辑、改色、删除与撤销/重做。
- 自主稿自动保存、校验后的项目文件导入导出、损坏存档保护；示例练习与自主稿分离。
- 运行状态复位、可撤销的清空接线，以及恢复原自主稿的退出实验入口。

English: Free terminal wiring with three editable examples; ideal switching and relay simulation; refined artwork for 16 devices and 113 terminals; bilingual UI and themes; full screen and navigation controls; overlapping-wire selection and editing; validated project persistence; independent example exercises; reset and exit controls.

### Fixed / 修复

- SQ 端子到下方线槽的短引线、SB 连续 14 位端子排及分组。
- 接线经过已有导线或器件时中断、选线出现大矩形焦点框的问题。
- 弹窗打开时背景编辑快捷键仍生效、小窗口缩放反向以及全屏切换丢失视图位置的问题。
- 页面离开或快速刷新前未及时写入待保存自主稿的问题。

English: Restored SQ leads into the duct and the continuous SB terminal bank; fixed interrupted wire drawing and rectangular wire focus outlines; isolated modal keyboard actions; corrected small-view zoom and viewport preservation; flushed pending workspace saves when leaving the page.

### Scope / 范围

仿真仍为逻辑通断模型；真实电压电流、三相电机运动、温升和串联分压尚未模拟。圆弯导线仍在视觉小样中，正式走线路径不会自动修改。文件下载落盘、跨浏览器与高线数性能等验收状态以准备清单和验收记录为准。

The simulator remains a logical switching model. Physical voltage/current, three-phase motor motion, thermal behavior, and series-load voltage division are not simulated. Rounded wires remain in the material study; existing main-bench routes are not automatically changed. Consult the readiness and verification records for download, cross-browser, and high-wire-count checks.
