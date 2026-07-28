# Day 11：自动保存、持久化与版本控制

English title: **Autosave, Persistence, and Version Control**

## 学习目标

今天让“已保存”成为可证明的状态。你将设计 dirty/saving/saved/error/conflict 状态机，使用 debounce、revision、幂等请求、乐观并发控制和原子写入，建立版本快照与恢复边界。

## 背景与问题

很多编辑器在 onChange 后启动定时请求，并在请求返回时显示“已保存”。若请求乱序，较旧响应可能覆盖新内容；若切换页面，debounce 尚未触发；若服务端成功但客户端丢失响应，重试可能创建重复版本。

可靠 autosave 必须区分本地编辑序号、正在发送的版本、服务端确认 revision 和最新 dirty 内容。UI 状态不是装饰，而是数据可靠性的可见承诺。

## 原理机制

每次 docChanged 增加本地 generation，并调度保存。请求携带 documentId、baseRevision、idempotencyKey 和该 generation 的不可变内容快照。服务端在事务中检查 baseRevision，写入内容和新 revision；冲突返回显式结果，不做 last-write-wins 静默覆盖。

响应到达时，客户端只确认与请求 generation 对应的快照。若期间又有编辑，状态仍为 dirty，并继续保存最新快照。网络超时后可用同一 idempotencyKey 重试，以区分“未执行”和“执行成功但响应丢失”。

版本历史按产品策略创建：可以每次 durable save 留 revision，也可按时间/里程碑生成 snapshot。恢复旧版本不是数据库覆盖细节，而是明确的新变更，通常产生新 revision 并保留恢复来源。

### 核心术语

- dirty generation：尚未被远端确认的本地内容代次。
- baseRevision：本次写入基于的服务端版本。
- optimistic concurrency control：写入时检测基础版本是否仍有效。
- idempotency key：安全重试同一业务请求。
- atomic write：内容与 revision 要么同时成功，要么都不变。
- durable acknowledgement：服务端确认数据已达到约定持久级别。

## 架构边界与取舍

Autosave 调度属于应用层，Transaction 只产生编辑变化。Repository/服务端负责 revision 与原子性。UI 只能依据明确状态机显示保存状态，不能以“请求已发出”显示已保存。

debounce 降低请求数但扩大未远端持久窗口；本地 durable storage 可缩小丢稿风险，Day 12 实现。beforeunload 只能作为提示，不能保证异步请求完成。课程默认持续输入时最多每两秒发一次保存，同时在停止输入后尽快落盘；具体值必须由指标校准。

## 逐步实验：可故障注入 Autosave

1. 画出 clean、dirty、saving、saved、error、conflict 状态与事件。
2. 实现 generation + debounce，不在 dispatchTransaction 中 await。
3. 模拟服务端 revision 检查和原子写入。
4. 注入慢响应、响应乱序、超时、成功后断连、409 conflict 和页面切换。
5. 对每次请求记录 generation、baseRevision、结果和下一状态，不记录正文。
6. 连续输入 30 秒，统计请求频率、确认延迟和最大未确认窗口。

### 观察点

- 旧响应晚到时，能否把新内容错误标记为 saved？
- 超时重试如何避免重复版本？
- conflict 后继续自动重试会发生什么？
- 恢复旧版本是否应该进入编辑 undo？
- server acknowledgement 代表写入内存、主库还是多副本 durable？契约是否明确？

## 产出物

- Autosave 状态机与不变量。
- 条件写 API、幂等策略和版本恢复契约。
- 至少 8 条故障序列自动测试。
- 请求频率、确认延迟和未确认窗口报告。

## 指标与获取方法

质量指标包括静默覆盖次数必须为零、重复请求副作用次数为零、状态机非法转移为零、每个确认可追溯到 generation。性能/可靠性记录每分钟请求数、保存 p50/p95、最大 dirty 时长、冲突率和错误恢复时间。使用虚拟时钟测试 debounce，真实计时只做集成验证。

## 常见失败模式

- debounce callback 捕获旧 EditorState。
- 任意成功响应都设置 saved。
- 409 后自动覆盖服务端而不提示语义冲突。
- 用 beforeunload 网络请求当可靠持久化。
- 版本恢复直接覆盖历史且无法撤回。
- 日志包含完整 JSON 正文。

## 课后任务

比较三种冲突策略：拒绝并提示、创建冲突副本、内容级协同。说明它们分别适用于什么阶段，为什么 Day 11 仍值得学习 revision，即使 Day 13 会引入 CRDT。

## 能力项

- **autosave-state-machine**：解释 generation、dirty、saving 与 durable acknowledgement。
- **persistence-version-policy**：设计条件写、幂等、原子保存和版本恢复。
- **save-failure-verification**：用乱序、超时、冲突和频率指标证明不丢写。

## 评测提示

评测会给出两次请求乱序返回的时间线，要求判断 UI 和 revision 应如何变化。不会接受“最后一次请求覆盖”这种无 generation 证据的回答。

## 定向回炉

- 状态混乱：只保留两次编辑和一次慢响应，重画 generation。
- 幂等缺失：模拟服务端成功但响应丢失，再用相同 key 重试。
- 版本边界不清：区分会话 undo、保存 revision 和里程碑 snapshot。
- 指标无意义：补最大 dirty 窗口与请求频率，而非只报平均延迟。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

## 资料

- [HTTP Conditional Requests](https://www.rfc-editor.org/rfc/rfc9110#name-conditional-requests)
- [ProseMirror Guide：Transactions](https://prosemirror.net/docs/guide/#state.transactions)

