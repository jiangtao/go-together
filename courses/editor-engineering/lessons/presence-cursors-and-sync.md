# Day 14：Provider、Awareness 与协同光标

English title: **Providers, Awareness, and Collaborative Cursors**

## 学习目标

今天让协同从“内容最终相同”变成可理解的多人体验。你将掌握 provider/room 生命周期、Awareness 的临时状态、Yjs RelativePosition、远端 cursor/selection 渲染、身份与权限边界，以及连接频率和带宽控制。

## 背景与问题

内容同步与“谁在线、正在看哪里”是两种数据。内容需要持久和最终交付；presence 过期后应消失。若把光标整数位置直接广播，远端在并发插入后会把光标画到错误内容；若把 Awareness 永久保存，离线用户会永远显示在线。

Provider 负责把 Y.Doc updates 和 Awareness 消息连接到网络或数据库。现成 provider 能减少协议工作，但 room 鉴权、生命周期、重连、限流和持久化策略仍需明确。

## 原理机制

Yjs Awareness 是独立于 Y.Doc 的状态型 CRDT。每个客户端只能更新自己的 local state，状态带递增 clock；provider 定期广播，超时或显式 null 后远端将其标记离线。Awareness 不进入文档 updates，也不应作为 durable presence history。

绝对 index 在协同编辑中会随远端变化失效。Y.RelativePosition 附着到 shared type 的相对位置；当副本收敛，它能解析到一致 absolute index。y-prosemirror 的 cursor plugin 使用 provider.awareness 与相对位置渲染远端选择。

Provider 生命周期通常包含 connecting、connected、disconnected、reconnecting、failed 和 destroyed。网络连接成功不等于 Y.Doc 已完成首次同步；UI 要区分 transport connected、document synced 与 local persistence synced。

### 核心术语

- provider：同步 Y.Doc/Awareness 的网络或数据库适配器。
- room/document GUID：隔离协同文档的路由身份，不等同用户权限。
- Awareness：不持久的在线状态与游标信息。
- RelativePosition：能随 CRDT 变化保持语义锚点的位置。
- synced event：某一 provider 完成其定义的同步阶段，不代表全部持久层完成。
- presence TTL/heartbeat：远端状态存活与离线判断机制。

## 架构边界与取舍

课程可使用 y-websocket 做本地学习 provider，但不把示例 server 当生产后端。生产必须在连接/room 加入前验证身份与文档权限，并为 update 大小、消息率、房间人数和连接数设限。客户端隐藏按钮不是授权。

Awareness 只发送展示所需的最小数据，例如匿名 displayName、颜色和 selection；不要广播 email、访问令牌、正文片段或业务权限。颜色由服务端/客户端验证，渲染用户名必须使用 textContent 等安全路径，不能拼 HTML。

频繁 selectionchange 会产生大量消息。光标要节流/合并，内容 updates 与 presence 可采用不同优先级；断网时无需把历史光标排队重放。

## 逐步实验：双标签页 Presence

1. 为同一 documentId 建立两个 Y.Doc、provider 和 EditorView；不同 documentId 必须进入不同 room。
2. 连接 ySyncPlugin、yCursorPlugin 与稳定的虚构用户信息。
3. 并发在远端光标前插入和删除，验证 RelativePosition 后光标仍附着预期内容。
4. 模拟断网、后台标签、正常 destroy 和异常关闭，记录 Awareness added/updated/removed。
5. 对 selection 高频移动做节流，比较每秒消息数与视觉延迟。
6. 尝试加入无权限 room，验证服务端/provider 边界拒绝，而不是只隐藏 UI。

### 观察点

- provider connected 与 document synced 的时间是否相同？
- Awareness state 消失后，远端 decoration 如何清理？
- RelativePosition 指向的 shared type 被删除时如何处理 null？
- 后台标签 heartbeat 降频会怎样影响在线状态？
- 远端用户名和颜色如何防止 DOM 注入或不可读组合？

## 产出物

- Provider 与连接状态矩阵。
- 双标签内容、在线状态和远端 selection 演示。
- Awareness payload schema、隐私规则与权限测试。
- 消息率、payload bytes、光标视觉延迟报告。

## 指标与获取方法

质量指标包括 room 隔离、无权限连接拒绝、RelativePosition 可解析率、disconnect 后 decoration 清理和 destroy 后零消息。性能记录 Awareness updates/秒、平均与 p95 payload bytes、selection-to-remote-paint p50/p95、房间人数增加时 DOM decorations 和带宽增长。课程初始目标把本地 Awareness 发送节流到每秒不超过 10 次，再以体验校准。

## 常见失败模式

- 把 userId 或 email 当 Yjs clientID 并跨会话复用。
- 将 Awareness 写入持久数据库作为在线事实。
- 广播裸 ProseMirror position，远端编辑后漂移。
- provider connected 就显示“全部已同步”。
- room 名可猜且服务端不校验权限。
- 每次 selectionchange 立即广播完整用户对象。

## 课后任务

设计 100 人只读围观场景：哪些 presence 要显示，哪些应采样或隐藏？说明带宽、视觉噪声、隐私和无障碍取舍，不要求实现。

## 能力项

- **provider-awareness-mechanism**：解释 provider、同步阶段、Awareness、heartbeat 与 RelativePosition。
- **presence-security-boundary**：设计临时状态、身份、room 权限和数据最小化边界。
- **cursor-sync-verification**：用并发映射、断连生命周期和频率/带宽数据验证。

## 评测提示

评测会给出“连接已成功但文档未同步”或“用户已离线仍显示光标”的场景，要求按状态层定位。不会提供 provider 配置答案。

## 定向回炉

- 内容/presence 混淆：为 Y.Doc update 与 Awareness 各写生命周期。
- 位置漂移：用同一字符前并发插入重新验证 RelativePosition。
- 权限错层：把 room join 放回服务端授权路径。
- 消息过量：记录 selection 事件数、实际发送数和远端 paint 延迟。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [Yjs Awareness & Presence](https://docs.yjs.dev/getting-started/adding-awareness)
- [Yjs Awareness API](https://docs.yjs.dev/api/about-awareness)
- [Y.RelativePosition](https://docs.yjs.dev/api/relative-positions)
- [y-prosemirror Remote Cursors](https://github.com/yjs/y-prosemirror#remote-cursors)
- [y-websocket 官方仓库](https://github.com/yjs/y-websocket)

