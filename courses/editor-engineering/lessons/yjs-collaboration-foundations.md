# Day 13：Yjs 与 ProseMirror 协同基础

English title: **Yjs and ProseMirror Collaboration Foundations**

## 学习目标

今天先理解协同模型，再接 binding。你将比较 prosemirror-collab 的中央权威 step/rebase 方案与 Yjs CRDT，掌握 Y.Doc、Y.XmlFragment、transaction origin、binary updates、state vectors 和 y-prosemirror 的数据所有权。

## 背景与问题

多人同时编辑时，每个客户端都会立即产生本地变化，而网络会延迟、乱序、重复或中断。单机 revision 只能拒绝冲突，不能提供连续实时体验。协同系统必须在不阻塞本地输入的同时，让所有有效操作最终得到一致结果。

“ProseMirror 支持 collaboration”并不等于它提供完整服务。原生 collab plugin 负责跟踪本地未确认 Steps、接收远端 Steps 和 rebase，但需要中央 authority 分配版本并保存历史。Yjs 则提供 CRDT shared types、updates 和 provider 生态，y-prosemirror 负责把 Y.XmlFragment 映射到 ProseMirror state。

## 原理机制

### 中央权威 Step 模型

prosemirror-collab 客户端维护已同步 version 和本地未确认 Steps。服务器按唯一顺序接受 Steps；客户端收到远端 Steps 后，把本地未确认变化 rebase 到新基础。它的优势是模型与 ProseMirror Steps 接近、权威顺序清晰；代价是需要维护 authority、版本历史、重连和裁剪策略。

### Yjs update 模型

Y.Doc 包含 shared types。所有变更发生在 Yjs transaction 中，并产生二进制 update。官方保证 updates 可交换、可结合且幂等，因此在最终收到相同 updates 后，各副本收敛。State vector 描述一个副本已知的客户端时钟，用于只编码对方缺失的差异。

y-prosemirror 的 ySyncPlugin 把 Y.XmlFragment 与 ProseMirror state 连接。协同启用后，Y.Doc 是内容协同事实源，ProseMirror State 是当前编辑投影；普通 ProseMirror JSON 不能替代 Y.Doc update 历史。

### 核心术语

- authority/version：中央权威方案的有序 Step 日志与确认位置。
- CRDT：允许并发本地更新并通过确定合并达到收敛的数据类型。
- Y.Doc/shared type：Yjs 文档与可协同数据结构。
- update：可传输、持久化和重复应用的二进制增量。
- state vector：描述副本已知状态，用于计算缺失差异。
- transaction origin：标记更新来源，避免 provider 回环并支持选择性历史。
- binding：连接 Yjs shared type 与编辑器模型的适配层。

## 架构边界与选型决策

本课程生产主线选择稳定版 Yjs v13 + y-prosemirror，而不是手写 CRDT，也不把官方 collab demo 直接当服务端。理由是：需要离线、本地持久化、Awareness、相对位置和成熟 provider 组合；y-prosemirror 已提供内容同步、共享光标和本地意图 undo。

原生 prosemirror-collab 仍值得学习：当系统已有强中央权威、严格有序审计、在线为主且团队愿意实现 authority 时，它可能更直接。选 Yjs 也不等于后端消失；认证、授权、update 持久化、备份、限流、监控和 Schema rollout 仍由产品系统负责。

课程锁定稳定 y-prosemirror/Yjs v13 路线。官方仓库当前开发分支正在面向新包线演进，不能因为 README 上出现不稳定分支就自动升级；依赖升级必须另开 ADR 与兼容测试。

## 逐步实验：两副本与两编辑器

1. 创建 docA/docB，各自取得同名 Y.XmlFragment。
2. 先不接网络 provider，分别在两端产生并发更新；收集 update Uint8Array。
3. 以不同顺序、重复次数应用 updates，比较最终 state vector 与 ProseMirror JSON 投影。
4. 接入 ySyncPlugin，让两个 EditorView 分别绑定 docA/docB，再用手工 update bridge 同步。
5. 记录 transaction origin，证明远端应用不会再次无条件回送。
6. 与 prosemirror-collab 示例画对照图：本地未确认、authority、Y.Doc、provider 各在哪里。

### 观察点

- 乱序和重复 update 为什么不会造成重复文本？
- 两个客户端 JSON 相等，state vector 是否也一定相等？需要什么同步步骤？
- ySyncPlugin 是否允许同时把普通 history plugin 当主要 undo？
- provider 是事实源、传输层还是二者兼有？
- 只保存当前 JSON 后重新创建 Y.Doc，哪些协同信息消失？

## 产出物

- 协同 ADR：原生 collab 与 Yjs 的需求、代价、选择和升级边界。
- Y.Doc ↔ y-prosemirror ↔ EditorState ↔ provider 数据流图。
- 至少 100 个可重放并发操作序列。
- update 大小、state-vector diff 和首次同步基线。

## 指标与获取方法

收敛质量不能只比较 HTML。每个 seed 在所有 updates 最终送达后，比较 Yjs state vectors、编码差异长度和规范化 ProseMirror JSON；失败时保存 seed、交付顺序和 update digest，不保存真实正文。性能记录每次 update bytes、总传输 bytes、encode/apply p50/p95、首次全量同步和增量同步。

## 常见失败模式

- 同时让 ProseMirror JSON autosave 与 Y.Doc updates成为可写主存储。
- 把 provider 当作 CRDT 本身，或把 CRDT 当作认证系统。
- 为每次会话复用固定 Yjs clientID，造成冲突风险。
- update 收到后不标 origin，形成广播回环。
- 只测两个客户端顺序输入，不测并发、乱序和重复。
- 直接采用不稳定新包线而没有依赖 ADR。

## 课后任务

为你的产品写“为什么不用原生 prosemirror-collab”反方论证，再写 Yjs 方案的三个新增运维成本。选型必须能经受反驳。

## 能力项

- **collaboration-model-comparison**：解释中央 authority/rebase 与 Yjs update 收敛模型。
- **yjs-prosemirror-boundary**：明确 Y.Doc、binding、EditorState、provider 和 JSON projection 的所有权。
- **convergence-update-verification**：用随机序列、state vector 和 update 指标验证收敛。

## 评测提示

评测会给出乱序/重复交付场景，要求解释验证方法；不会要求实现 CRDT 算法。说“Yjs 自动解决”而不能指出数据与服务边界，不能通过。

## 定向回炉

- 模型混淆：重画 authority step log 与 Yjs updates 两张图，不混用术语。
- 事实源不清：为 JSON、Y.Doc、provider storage 标注 authoritative/projection/transport。
- 收敛证据弱：对同一 seed 打乱并重复 updates，比较 state vector diff。
- 版本风险：核对 stable package 说明并补依赖升级 ADR。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [ProseMirror Guide：Collaborative editing](https://prosemirror.net/docs/guide/#collab)
- [ProseMirror collab example](https://prosemirror.net/examples/collab/)
- [Yjs Introduction](https://docs.yjs.dev/)
- [Yjs Document Updates](https://docs.yjs.dev/api/document-updates)
- [y-prosemirror 官方仓库](https://github.com/yjs/y-prosemirror)

