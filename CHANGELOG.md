# Changelog / 变更记录

## Unreleased / 未发布

### Added / 新增

- 三相教学电源进入仿真：U2/V2/W2 是三条互相独立的相线（标称线电压 380 V），可与单相控制电源 L/N 一起接线。短路检测扩展到相间短路（U–V/U–W/V–W）、相与 N 的单相接地短路，以及两套电源混接，并沿用原有故障结构给出涉及端子和导线。
- 电机负载：U1–U2、V1–V2、W1–W2 作为三个绕组参与计算。Y 与 Δ 不单独建模，由用户按实训台方式自己连线；三个绕组都跨接两条不同相线时电机运转，缺一相或绕组两端同电位时停止。接线盒在运转时显示转子动画，面板、详情和分步观察同步显示运转/停止。
- 新示例「接触器自锁 + 电机」：单相控制回路上 SB2 启动、KM1 经 13–14 自锁、SB1 停止，三相主回路经 KM1 主触点给 Y 接法的电机供电。示例与自由接线使用同一套仿真规则，不硬编码结果。
- 此前声明为预留的 `POWER:U2/V2/W2` 与 `MOTOR:*` 端子全部可接线，预留端子提示随之移除。

English: The three-phase training supply is now simulated. U2/V2/W2 are three independent phase lines (380 V line-to-line) that can be wired alongside the single-phase L/N control supply, and short-circuit reporting covers phase-to-phase, phase-to-neutral and mixed-supply connections while keeping the existing fault structure. The motor terminal box carries three winding loads: Y and delta are not modelled separately but wired by the user as on a real bench, and the motor runs only while all three windings span two different phases, with a reduced-motion-aware rotor animation plus running/stopped state on the bench, inspector and observation panel. A new "self-holding contactor + motor" example combines the single-phase control circuit with a three-phase main circuit through the same rules. All previously reserved terminals can now be wired, so the reserved-terminal notices are gone.

### Scope / 边界

- 仍为理想通断模型：电机运转只表示三个绕组都得电，不代表转向、转速、转矩或真实电流；三相电源标注的 380 V 是教学标称值，不参与计算。热继电器跳闸仍不直接断开三相主通路。

English: The simulator remains an ideal switching model. A running motor means all three windings are energized; direction, speed, torque and real current are not modelled, and the 380 V phase-to-phase value is a teaching label rather than a computed quantity. A thermal trip still does not physically open the three-phase main paths.

## v0.2.0-alpha — 2026-10-04

### Added / 新增

- 可选分步观察：按下和松开分别记录为动作快照；最多保留当前接线修订的 120 条记录。历史只读，不恢复过去的输入或线圈状态。
- 选择任意线圈或灯，持续查看由实际接线计算的供电与回线，包含有效并联支路及其中的闭合触点；对比操作前后的状态和通路变化。排除悬空分支，不把电源连接误称为实测电流。
- 观察历史时保留查看通路的入口；窄窗口抽屉关闭后恢复打开按钮的键盘焦点。

English: Optional step observation records press and release independently, with up to 120 read-only snapshots per wiring revision. Select any coil or lamp to trace valid supply and return paths, including parallel branches and closed contacts, then compare changes between actions. Reviewing history never restores past inputs or relay memory. The path panel remains accessible during history review, and closing its narrow-window drawer restores keyboard focus.

### Improved / 改进

- 新线路自动规划并固定路径，示例打开时整理走线；旧线路可主动整理，单根线路可重新规划，均支持撤销并保留电气拓扑。
- 交叉处显示间隙、选中线置顶及 A/B 端点标记，重叠线可轮换选择。保留线身颜色，仅外圈缓慢变化。
- 全屏可打开器件与导线详情；中英文改为一键切换，正式实验台与视觉小样共用。
- 补充双语使用说明、架构及国际化约定；增加可选赞助说明页。修正本地公开快照导出工具的作者身份，避免误关联其他账号。

English: New wires keep their planned routes; examples open with arranged wiring, while existing paths change only through explicit, undoable actions. Crossing gaps, a continuous selected wire and A/B markers improve readability. Full-screen inspection and one-click language switching are available throughout the app. Bilingual documentation and optional support pages are included; local public snapshot exports no longer use an identity associated with another account.

### Compatibility and scope / 兼容性与范围

- 设备、端子标识及 v1 接线文件格式不变。观察记录保存在内存，修改接线、复位或刷新后清除；接线撤销历史独立管理。
- 仍为理想通断模型，不计算实际电压、电流或吸合时间。“先预测再揭晓”和分级提示排故练习尚未实现。
- 自动检查覆盖 203 项测试；独立课堂试用、完整跨浏览器与移动触控、500 根线的交互性能仍待验证。

English: Electrical IDs and the v1 project format are unchanged. Observation history is transient and resets with wiring changes, reset, or refresh; wiring undo remains separate. The model does not calculate physical voltage, current, or actuation time. Prediction/reveal and guided fault exercises are future work. Automated coverage includes 203 tests; independent classroom trials, full browser/touch coverage and interactive performance at 500 wires remain unverified.

## v0.1.1-alpha — 2026-10-01

- 将“接线实验台”标题移至顶部品牌栏，移除重复的大标题区，为普通视图增加画布高度。1280×720 窗口实测增加 101 像素；全屏入口保留。
- 按补充资料将 HL1–HL3 合并到竖向共用灯面板，下方连续六位端子依次对应各灯的 1、2 端子，固定引出线保留。原端子 ID、存档格式和灯回路逻辑不变。
- SB1–SB3、急停与各自端子组上下对齐；保留连续 14 位端子排。
- FR 本体只查看详情，画布与详情均提供独立 TEST/RESET；区分正常和跳闸，布线/平移经过按钮不触发操作。旋钮和真实热保护仍明确为未模拟。
- 缩短 SQ 提示占用的宽度，避免英文说明相互重叠；同步更新中英文操作指南。
- 当前源码树移除内部开发约定、计划与验收记录，保留面向使用者和贡献者的公开文档。发布方式仍为下载后本地运行，不提供在线体验。

English: Compact header with more vertical canvas space; shared three-lamp enclosure with a six-position terminal bank; aligned SB controls; independent FR inspection, TEST and RESET with routing protection; clearer trip status and non-overlapping SQ hints. Electrical IDs and the v1 exchange format are unchanged. Internal development instructions, plans, and verification records are removed from the current source tree; public user and contributor documentation remains. Distribution continues as a local application to download, with no hosted demo. Real thermal/current behavior and multiple-project management remain future work.

独立教师或学生的课堂试用，以及导出文件实际落盘后重新导入的完整流程，仍待验证。

An independent classroom trial and a real file-download/reimport round trip remain unverified.

## v0.1.0-alpha — 2026-10-01

首个 MIT 开源教学预览版，不分发用户提供的照片、手绘或产品图片。发布时，独立教学试用及真实文件下载与重新导入仍待验证。

First MIT open-source teaching preview, excluding user-supplied photographs, sketches, and product images. Independent classroom testing and a real file-download/reimport round trip were unverified at this release.

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

仿真仍为逻辑通断模型；真实电压电流、三相电机运动、温升和串联分压尚未模拟。圆弯导线仍在视觉小样中，正式走线路径不会自动修改。发布时，真实文件下载与重新导入、完整跨浏览器兼容性和 500 根导线的性能均未完成验证。

The simulator remains a logical switching model. Physical voltage/current, three-phase motor motion, thermal behavior, and series-load voltage division are not simulated. Rounded wires remain in the material study; existing main-bench routes are not automatically changed. At this release, real file download/reimport, full cross-browser compatibility, and performance with 500 wires had not been verified.
