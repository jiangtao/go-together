# Day 8：撤销、重做与用户意图分组

English title: **Undo, Redo, and Grouping User Intent**

## 学习目标

今天不只让 Mod-Z 有反应，而是定义什么算“一次用户意图”。你将理解 prosemirror-history 如何保存可映射事件、时间分组、closeHistory、addToHistory、redo 失效和 selection 恢复，并为未来协同历史留下清晰边界。

## 背景与问题

如果每个字符都是一个撤销单位，撤销太碎；如果五分钟输入是一组，用户又无法控制。格式命令、粘贴、自动链接、远端同步、autosave metadata 和系统修复是否进入历史，也不能由“产生了 transaction”简单决定。

撤销是产品语义：它应该逆转当前用户可理解的意图，而不是数据库的最后一次写入。协同时更要避免一个用户撤销另一个人的内容。

## 原理机制

history plugin 记录包含反向 Steps 与位置映射的 events，并按时间、相邻性和显式边界分组。undo 生成新的 transaction，将最近 event 的变化反向应用，并把它移入 redo 分支。普通新编辑发生后，旧 redo 分支通常失效。

Transaction metadata addToHistory=false 可排除系统变化；closeHistory 强制下一次变化建立新组。newGroupDelay 控制时间窗口，但时间不是唯一语义，命令边界往往需要显式 closeHistory。

历史在后续非历史变换发生时仍需映射旧 Steps 和 Selection。ProseMirror history 与 Yjs UndoManager 属于不同事实源；进入协同阶段后应使用 y-prosemirror/yUndoPlugin 的本地意图历史，而不是同时启用两套互相竞争的 undo 快捷键。

### 核心术语

- history event：用户可撤销的分组单位。
- done/undone branch：撤销与重做分支。
- newGroupDelay：基于时间的分组窗口。
- closeHistory：显式结束当前历史组。
- addToHistory：控制 transaction 是否进入历史。
- local intent：协同环境中仅撤销本客户端贡献的变化。

## 架构边界与取舍

文档编辑历史与产品版本历史不是同一个系统。undo/redo 面向当前会话和用户意图；版本快照面向恢复、审计与分享。autosave 不应制造 history event，恢复旧版本则应由产品明确决定是一次可撤销 transaction，还是重建新文档状态。

自动格式化若是输入意图的直接结果，可以与输入同组；后台规范化或远端更新通常不应进入本地历史。不存在通用答案，必须用用户预期和协同所有权解释。

## 逐步实验：历史行为矩阵

1. 建立 15 条操作序列：连续输入、停顿输入、格式化、粘贴、列表变换、selection-only、系统 metadata、自动链接、删除与 redo。
2. 每一步记录 doc、selection、undoDepth 和 redoDepth。
3. 调整 newGroupDelay，观察时间与结构相邻性。
4. 对工具栏命令使用 closeHistory，验证一次点击对应一次撤销。
5. 对系统 transaction 设置 addToHistory=false，并在其前后执行 undo，检查旧事件是否仍正确映射。
6. 执行 1,000 次编辑后测量 undo p50/p95 和堆内存增量。

### 观察点

- selection-only transaction 是否改变历史深度？
- undo 后的新编辑为什么清空 redo？
- addToHistory=false 是否意味着该变化与历史完全无关？
- 一次 paste 产生的多个 Steps 是否应是一个 event？
- 协同切换后为什么不能保留两套 history plugin？

## 产出物

- History Policy：操作类型、分组、是否进入历史、selection 预期。
- 15 条操作序列自动测试。
- 单机 history 到协同 UndoManager 的切换 ADR。
- 延迟和内存基线。

## 指标与获取方法

质量指标是序列通过率、内容恢复率、selection 恢复率、redo 分支规则和系统 transaction 排除率。性能要在相同初始文档和操作序列上采样，记录历史深度、Steps 数、undo/redo p95 与 heap delta；开发模式与生产构建不可混比。

## 常见失败模式

- 同时绑定浏览器原生 undo、prosemirror-history 和 Yjs undo。
- 只恢复正文，不验证 selection。
- 用 debounce 时间直接定义所有用户意图。
- 把 autosave、远端更新或 presence 写入本地历史。
- 为修复历史问题清空全部 history，掩盖边界错误。

## 课后任务

为“粘贴后自动清理格式”定义历史语义。说明清理是粘贴的一部分还是独立可撤销操作，并用三条用户场景支持决定。

## 能力项

- **history-grouping-mechanism**：解释 event、分组、映射、undo/redo 分支和 selection 恢复。
- **history-intent-policy**：按用户意图与事实源定义哪些变化进入历史。
- **history-sequence-verification**：用操作矩阵、延迟和内存证据验证策略。

## 评测提示

评测会选择一条历史序列，要求逐步说明深度与用户预期。不会只检查 undo 按钮是否可点击。

## 定向回炉

- 分组不清：将序列缩为两个输入和一个命令，标注期望 event。
- 事实源混淆：重画会话历史、版本历史、协同历史三层。
- 选择遗漏：每条序列补充 selection before/after。
- 资源无证据：固定 1,000 次序列重新采样。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [ProseMirror Reference：history](https://prosemirror.net/docs/ref/#history)
- [ProseMirror Guide：Transaction metadata](https://prosemirror.net/docs/guide/#state.transaction)
- [Y.UndoManager](https://docs.yjs.dev/api/undo-manager)
- [y-prosemirror Undo/Redo](https://github.com/yjs/y-prosemirror#undoredo)

