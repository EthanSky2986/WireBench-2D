# 质量改进计划 / Quality improvement plan

按依赖和风险逐批推进，每批有可复现的完成标准。发现新问题后先核对、再排优先级；不以“所有问题已解决”作为无法验证的承诺。

Work in small, verifiable batches. Prioritize data preservation and correct circuit behavior, then complete workflows and refine presentation.

## 1. 当前批次：器件对应与操作语义

- [x] SB 各组端子与对应按钮上下对齐，连续 14 位结构保持。
- [x] 按补充手绘和实物结构修正灯区：黄、绿、红三灯共用竖向面板，下方连续六位端子，保留固定引出线。
- [x] FR 查看、TEST、RESET 各自独立；正常/跳闸状态明确。查看不误触、重复测试不复位，鼠标与键盘一致。
- [x] 布线或平移经过 FR 操作区不触发器件；端子 ID、已有接线和存档格式保持兼容。
- [x] 更新中英文操作说明，并核对明暗主题及普通/全屏显示。

完成标准：自锁启动后保持；FR1 TEST 断开已接入的控制回路并点亮故障灯；RESET 后当前自锁示例保持停止；FR2 不影响只接 FR1 的回路；退出示例恢复原自主稿。所有效果由实际接线计算。

Current batch: align SB controls, correct the shared lamp enclosure and terminal bank, and separate FR inspection from TEST/RESET. Check routing, mouse/keyboard, themes, locales, and existing project compatibility.

## 2. 下一批次：我的实验与数据保护

先验证存储边界，再接入界面；不把“清空接线”当作“新建项目”。

- 新建命名实验、打开与切换、重命名、复制，以及把示例保存为自己的实验。
- 现有自主稿安全迁移为第一个项目；原存储内容保留，不静默覆盖损坏或未知版本。
- 新建、导入和切换前先保存；保存失败留在当前项目，允许导出，不能假报成功。
- 各项目线路与撤销历史互不混用；重新打开时从断电状态开始。
- 多标签页的旧数据不能无提示覆盖更新的数据；测试冲突及恢复路径。
- 项目集合格式与现有 v1 接线交换文件分层，旧文件仍可导入。
- 实际导出文件落盘，再从该文件导入，核对名称、端点、颜色和拐点。

存储模块已有独立的单元验证草稿，尚未接入或发布；不能把草稿通过测试视为完整项目管理已完成。删除项目、批量管理和云同步在基础流程可靠后再评估。

Next: a small local project library with safe legacy migration, independent histories, explicit save failures, stale-tab protection, and a real downloaded-file/import round trip. Storage-only prototypes do not count as a delivered workflow.

## 3. 教学完整性与真实参数

- 请一位教师或同学按 README 独立完成基础实验，记录误解和操作阻碍。
- 增加独立的 FR 保护练习，说明正确接线、旁路保护触点及故障指示的区别。
- 数值过载、整定电流、热脱扣延时和冷却需要先明确器件参数与可验证模型，再实现旋钮、故障场景和复位条件。
- 电机、三相与自动往返同样先确定模型，不通过固定动画冒充真实接线效果。

Then validate teaching use with an independent learner. Physical overload and motor behavior require documented parameters and a testable model before implementation.

## 4. 持续质量检查

每批改动先检查影响范围。行为变化使用实际线路或数据失败场景验证；纯外观使用浏览器检查。提交前运行 `npm run check`，公开推送后核对对应提交的 CI。

优先级：丢失数据/错误电气结果 → 误操作/不可恢复流程 → 布局和可访问性 → 性能和新能力。保留可复现问题、修复说明、测试证据和仍未支持的范围。所有用户提供图片继续仅作参考，不加入公开仓库；只发布代码生成的图形与程序截图。

Priority: data loss and incorrect circuit results, then accidental actions and broken recovery, layout/accessibility, and finally performance/new capabilities. Keep reproducible evidence and state limits honestly. User-supplied reference images remain excluded from publication.
