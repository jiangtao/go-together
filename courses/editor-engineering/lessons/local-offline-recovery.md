# Day 12：本地离线恢复与同步状态机

English title: **Local Offline Recovery and the Sync State Machine**

## 学习目标

今天把“本地看得到”推进为“刷新后仍能恢复”。你将区分内存状态、浏览器 durable state 和服务端确认，使用 IndexedDB 保存版本化快照/队列，处理断网、刷新、崩溃、配额失败和重连。

## 背景与问题

在线 autosave 无法覆盖断网和标签页突然关闭。localStorage 是同步字符串存储，不适合频繁写大文档；IndexedDB 提供异步事务和结构化数据，但也可能被清理、配额不足或打开失败。

离线并非一个 boolean。浏览器的 navigator.onLine 只是信号；真正状态还包括本地是否 durable、远端是否可达、是否有积压、同步是否冲突、当前 Schema 是否能读取本地数据。

## 原理机制

本地持久化写入 versioned envelope，键至少包含 documentId 和本地 generation。写成功后才能把状态从 memory-only 推进到 local-durable。远端确认后可标记相应 generation 已同步，但不要立即删除唯一恢复副本。

启动时先读取本地与远端元数据，按 revision/generation 和策略决定恢复。单机 JSON 路径可保存最新 snapshot 加待同步操作；Yjs 阶段将使用 y-indexeddb 直接持久化 Y.Doc updates。二者不可同时作为同一内容的可写事实源。

Sync state 可以包含 loading-local、local-ready、offline-dirty、syncing、synced、conflict、storage-error。UI 必须告诉用户当前承诺：仅在本机、正在同步、已同步或无法保存。

### 核心术语

- local durable：浏览器事务已成功提交，但不代表云端持久。
- write-ahead queue：远端发送前先本地持久化的待处理记录。
- recovery point objective：可接受最多丢失多少最近工作。
- recovery time objective：从故障到恢复可编辑所需时间。
- quota/eviction：浏览器存储上限与被系统回收风险。
- reconciliation：本地与远端状态比较并选择恢复动作。

## 架构边界与取舍

IndexedDB 是可靠性增强，不是永久备份。产品仍需服务端 durable storage、备份和恢复演练。Service Worker 能让应用壳离线加载，但不自动解决文档数据同步。

课程在 Day 12 实现单机 versioned snapshot，以理解状态机；Day 15 会切换为 Yjs update persistence。切换时要删除双写，制定一次性迁移，并保留原始本地数据直至新路径确认。

每次 transaction 都写整份大 JSON 会造成主线程和存储压力。可以 debounce snapshot，但必须结合 write-ahead/更小的更新或合理 RPO。指标决定策略。

## 逐步实验：离线恢复演练

1. 定义本地记录 schema、版本和状态机。
2. 在 autosave 网络请求之前写入 IndexedDB；记录 write started/committed/failed。
3. 模拟离线编辑、刷新、关闭标签页、远端慢恢复和重复发送。
4. 注入 IndexedDB open failure、transaction abort、quota error 和损坏记录。
5. 启动时比较 local generation 与 remote revision，显示明确恢复选择。
6. 对 1,000 个小更新或等价快照测量启动读取、恢复与清理时间。

### 观察点

- 本地写还在 pending 时关闭标签页，UI 能承诺什么？
- 本地新、远端也新时，单机模型为什么需要 conflict？
- 清理已同步队列前需要哪些 durable 证据？
- IndexedDB 数据损坏时是否保留原始记录供恢复？
- 网络恢复后，重复发送是否被 Day 11 幂等契约吸收？

## 产出物

- 三层 durability 与 Sync State 图。
- IndexedDB adapter、版本化记录和恢复策略。
- 至少 5 个故障演练及结果。
- RPO/RTO、积压量和恢复 p50/p95 报告。

## 指标与获取方法

质量指标包括刷新后最后 local-durable generation 恢复率、重复发送副作用为零、损坏记录安全失败、状态 UI 与事实一致。可靠性记录 RPO、RTO、队列深度、local write 失败率和清理前确认率；性能记录启动读取、反序列化和 View 创建分段耗时。

## 常见失败模式

- 用 navigator.onLine 决定数据已经同步。
- 本地写尚未提交就显示“已保存在本机”。
- localStorage 同步写大 JSON，阻塞输入。
- 远端确认后立即删除所有本地副本，没有恢复窗口。
- 同时运行 JSON snapshot 和 Yjs updates 双写，出现两个事实源。
- 遇到损坏记录自动覆盖，丢失取证机会。

## 课后任务

为“浏览器清理站点数据”写用户承诺：哪些数据会丢、产品如何提示、服务端备份如何弥补。把“离线可用”和“永久保留”分开。

## 能力项

- **offline-durability-model**：解释内存、本地 durable 和远端确认的不同承诺。
- **offline-sync-state-machine**：设计可恢复、可重试、用户可见且无双事实源的流程。
- **recovery-drill-verification**：用故障注入、RPO/RTO 和积压指标验证。

## 评测提示

评测会给出本地写、网络写和 UI 状态交错的时间线。需要按已提交事实判断，不能把“调用了 API”当作 durable。

## 定向回炉

- 三层混淆：为每层写“成功条件”和“仍可能丢失方式”。
- 状态机缺口：加入 storage-error 与 conflict，再走一遍恢复。
- 双写风险：选定唯一内容事实源，另一份标为 projection。
- RPO/RTO 空泛：用固定 1,000 更新夹具重新测量。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [IndexedDB API](https://w3c.github.io/IndexedDB/)
- [Yjs Offline Support](https://docs.yjs.dev/getting-started/allowing-offline-editing)
- [y-indexeddb 官方仓库](https://github.com/yjs/y-indexeddb)

