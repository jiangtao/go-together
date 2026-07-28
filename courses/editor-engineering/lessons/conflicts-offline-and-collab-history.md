# Day 15：网络分区、语义冲突与协同历史

English title: **Network Partitions, Semantic Conflicts, and Collaborative History**

## 学习目标

今天验证协同系统在坏网络下仍可信。你将处理离线 updates、乱序/重复交付、Y.UndoManager 本地意图、y-indexeddb、update 持久化与压缩、快照恢复、Schema 兼容和无法由 CRDT 自动解决的语义冲突。

## 背景与问题

CRDT 的核心承诺是所有有效 updates 最终到达后副本收敛，不是“每个结果都符合业务语义”。两人同时改同一标题、删除正在编辑的文档、修改权限或升级到不兼容 Schema，都需要产品规则。

离线客户端可能积累大量 updates；服务端也可能崩溃、重复接收或只保存部分增量。如果仅依赖在线内存 provider，CRDT 算法正确仍会丢数据。

## 原理机制

y-indexeddb 可以把 Y.Doc updates 持久化到浏览器 IndexedDB，并与 network provider 组合。客户端重开时先从本地恢复，再交换 state vectors 获取缺失 updates。服务端应持久化二进制 updates或合并 snapshot，并保证在确认前达到明确 durable 级别。

Y.mergeUpdates 能合并与去重二进制 updates，但不执行 Y.Doc garbage collection；需要控制体积时应定期加载到 Y.Doc、验证后生成新 snapshot，并保留恢复和备份策略。不能在客户端还可能依赖旧历史时随意裁剪。

Y.UndoManager 按 shared type scope 和 transaction origin 选择性记录本地变化。y-prosemirror 的 yUndoPlugin 提供适合编辑器的本地意图 undo。远端变化不应被本用户 undo，但会参与位置与结构演进。

### 核心术语

- network partition：客户端之间暂时无法通信但仍可本地工作。
- eventual convergence：所有 updates 最终交付后状态一致。
- semantic conflict：结构已收敛，但结果违反业务期望或需要人工选择。
- update log/snapshot：增量事实与可加速加载的合并状态。
- compaction：在可恢复前提下减少更新数量和体积。
- transaction origin/trackedOrigins：UndoManager 选择本地意图的依据。
- schema compatibility window：不同客户端版本可安全协同的版本范围。

## 架构边界与取舍

每个 Document 使用独立 Y.Doc/room，便于权限、生命周期、加载和恢复。标题等元数据可进入独立的受控业务存储或同一 Y.Doc；无论选择哪种，都要定义并发语义。课程默认正文由 Y.Doc 管理，title 仍使用 revision API，冲突显式提示，不假装 CRDT 已统一所有数据。

离线持久化提高恢复能力，但无权用户离线后再次打开本地数据涉及安全与撤权。生产产品要决定本地加密、缓存清理和重新授权；本课程只要求退出/撤权后停止网络同步并清理可识别缓存，不实现 E2EE。

Schema 升级必须保证同一 room 的客户端能解释 updates。破坏性节点改动需要版本门禁、双读/迁移或强制升级，不能让旧客户端把未知结构重写掉。

## 逐步实验：分区与恢复实验室

1. 建立两个客户端、y-indexeddb 与可拦截的 network bridge。
2. 分区后两端同时输入、删除、格式化，再以随机顺序和重复次数交付 updates。
3. 每个 seed 最终比较 state vectors、规范化 ProseMirror JSON 和 update diff。
4. 在并发过程中分别执行 undo/redo，证明只撤销本地 tracked origin。
5. 模拟服务端仅保存部分 updates、重启后从 snapshot + tail updates 恢复。
6. 生成 10,000 个小 updates，比较未压缩、mergeUpdates 和重建 snapshot 的体积/加载时间。
7. 让一个客户端使用不兼容 Schema，确认版本门禁阻止加入，而不是静默修复。

### 观察点

- 结构相等但标题冲突时，用户看到什么？
- mergeUpdates 后 state vector 和最终文档是否保持一致？
- UndoManager trackedOrigins 配错会撤销谁的变化？
- y-indexeddb synced 与 network synced 有何不同？
- 服务端何时可以确认 update durable？
- Schema 不兼容时，binding 的“恢复非法结构”能否替代产品迁移？

## 产出物

- Conflict Taxonomy：结构并发、元数据冲突、删除、权限和 Schema 版本。
- 分区/恢复 runbook 与至少 100 个随机 seed。
- 本地意图 undo 策略与测试。
- 10,000 updates 的体积、加载、压缩和恢复报告。

## 指标与获取方法

可靠性指标包括收敛率 100%、静默丢 update 为零、重复 update 副作用为零、恢复成功率、snapshot 校验失败率和 Schema 门禁命中率。性能记录断线积压 bytes、重连 encode/apply/persist p50/p95、10,000 updates 恢复时间和 compaction 前后体积。失败 seed 必须可重放。

## 常见失败模式

- 把“最终收敛”写成“没有业务冲突”。
- 服务端收到 update 就确认，尚未 durable 已丢失。
- 只保存 JSON snapshot，不保存或正确合并 Yjs updates。
- UndoManager 追踪所有 origins，用户撤销远端内容。
- 无限累积 update log，首次加载持续恶化。
- 未做 Schema 版本门禁，让新旧客户端同 room 互相损坏。

## 课后任务

设计“离线用户删除一段，而在线用户在其中继续写”的产品解释。区分 CRDT 最终结构、用户通知、版本恢复和审计需要，不要提出修改 CRDT 算法。

## 能力项

- **partition-conflict-mechanism**：解释分区、update 收敛、语义冲突与本地意图历史。
- **collab-recovery-policy**：设计 y-indexeddb、服务端持久化、snapshot、compaction 和 Schema 门禁。
- **partition-seed-verification**：用随机 seed、state vector、故障恢复和性能证据证明可靠性。

## 评测提示

评测会提供一个已收敛但业务错误的案例，要求指出 CRDT 与产品规则的边界；不会要求实现底层 CRDT。

## 定向回炉

- 收敛/语义混淆：为同一案例分别写结构结论和产品结论。
- 持久化缺口：从客户端 update 到服务端 durable 逐跳标确认点。
- undo 错误：缩为两端各一次输入，检查 transaction origin。
- 性能无证据：固定 10,000 updates，分别测 merge 与 snapshot 恢复。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [Yjs Offline Support](https://docs.yjs.dev/getting-started/allowing-offline-editing)
- [Yjs Document Updates](https://docs.yjs.dev/api/document-updates)
- [Y.UndoManager](https://docs.yjs.dev/api/undo-manager)
- [Yjs ProseMirror binding caveats](https://docs.yjs.dev/ecosystem/editor-bindings/prosemirror)
- [y-prosemirror persistence warning](https://github.com/yjs/y-prosemirror#utilities)

