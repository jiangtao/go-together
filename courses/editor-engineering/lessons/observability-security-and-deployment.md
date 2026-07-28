# Day 18：可观测性、安全与部署集成

English title: **Observability, Security, and Deployment Integration**

## 学习目标

今天把本地可用编辑器变成可运行组件。你将设计不采集正文的 telemetry、错误与同步健康指标，处理不可信输入、链接、NodeView、room 权限和数据最小化，并建立 feature flag、Schema rollout、预览部署、告警和回滚。

## 背景与问题

编辑器故障常只出现在特定文档、浏览器、Schema 或网络组合中。没有 transaction 来源、版本、节点规模和同步状态，线上错误无法定位；但直接上报正文、selection 或二进制 updates 又会泄露高敏感内容。

部署也不仅是上传静态资源。新客户端可能与旧客户端同时编辑同一 Y.Doc；Schema 不兼容会造成解析或结构损坏。Provider、持久化服务和前端版本必须有兼容窗口与回滚策略。

## 原理机制

可观测性分三类：

- logs/events：离散错误与状态转换，使用 documentId 的不可逆脱敏标识、版本、规模和错误码。
- metrics：输入 p95、Long Task、save failure、sync lag、reconnect、update bytes、schema rejection、crash-free session。
- traces：一次加载/保存/同步跨客户端与服务端的关联，传递随机 trace id，不传正文。

错误边界捕获 React UI 崩溃；EditorView/Plugin/provider 需要各自的错误与状态通道。安全上，所有外部 HTML、JSON、URL 和 Yjs room 请求均不可信；Schema 验证不等于授权或 XSS 防护。服务端在持久化/广播前检查身份、文档权限、消息大小和速率。

Schema rollout 使用版本门禁与 feature flag。先部署能读取新旧格式的代码，再受控写入新格式，观察错误与兼容指标，最后扩大；回滚时必须知道旧客户端能否读取已经写入的新结构。

### 核心术语

- redaction/data minimization：只收集定位所需最少数据。
- crash-free session：无未处理崩溃的编辑会话比例。
- sync lag/backlog：本地变化到远端 durable/可见的延迟与积压。
- feature flag/kill switch：控制能力启用和快速关闭的发布机制。
- compatibility window：新旧 Schema/客户端可安全共存的范围。
- CSP/Trusted Types：降低 DOM 注入风险的浏览器安全机制。
- canary/rollback：小流量验证与恢复旧版本流程。

## 架构边界与取舍

遥测 SDK 不应读取 doc.textContent、clipboard、selection 内容或 update payload。可以记录 node count、schemaVersion、operation category、bytes、duration、error code 和 digest。调试需要正文时必须走受控、明确同意、短期且审计的流程，不属于课程默认方案。

客户端校验改善体验，服务端授权保护数据。Awareness payload 同样不可信，远端 displayName 必须安全渲染。NodeView 中的嵌入链接、图片和第三方内容需要 URL allowlist、sandbox 与 CSP，而不是依赖 React 自动转义解决全部问题。

部署 smoke 只证明基本路径，不替代 migration、分区和恢复演练。回滚前要确认服务端数据格式是否已向前写入；无法向后读取时，前端二进制回滚可能让情况更糟。

## 逐步实验：生产演练

1. 定义 telemetry event schema：editor_loaded、transaction_applied、save_state_changed、sync_state_changed、error；逐字段做敏感性审查。
2. 接入错误边界和 provider/save 状态，建立本地 dashboard 或可查询日志。
3. 注入 parse failure、plugin exception、storage failure、401/403、oversized update、断网和 Schema mismatch，验证错误码与用户提示。
4. 对恶意链接、HTML、Awareness displayName 和越权 room 运行安全测试。
5. 用 feature flag 发布一个新 node type：只读兼容 → 小流量写入 → 扩大 → kill switch。
6. 部署预览环境，执行 smoke、同步、刷新恢复和回滚演练。

### 观察点

- 不看正文，错误是否仍能按版本、浏览器、节点规模和操作分类？
- 客户端收到 403 后是否停止重连风暴并清理 presence？
- kill switch 关闭 UI 后，已存在的新节点如何读取？
- telemetry SDK 自身失败或变慢时是否影响输入？
- 回滚前哪些 durable 数据必须兼容旧版本？

## 产出物

- Telemetry schema 与字段级隐私审查。
- 运行 dashboard/查询、告警阈值和 operations runbook。
- 威胁模型与安全测试结果。
- Schema rollout、预览部署和回滚证据。

## 指标与获取方法

质量/运行指标包括 crash-free session、parse/schema errors、save/sync failure、403/429、reconnect storm、stale presence、rollback success 和 P0/P1 数。性能记录 telemetry CPU/网络开销、初始化增量、bundle delta 和错误上报 p95；课程初始要求遥测额外 CPU/网络开销低于测量总量的 1%，若测量方法无法支持该精度，应报告置信区间而非伪造数字。

## 常见失败模式

- 错误日志直接附带全文 JSON 或 Yjs update。
- 只在客户端隐藏文档，provider room 无服务端授权。
- feature flag 关闭写入，却无法读取已经存在的新节点。
- 403 后无限重连，造成服务压力与告警噪声。
- 回滚只换前端 bundle，不检查 Schema 和持久数据兼容。
- 遥测在主线程同步序列化大对象。

## 课后任务

写一个“新 list 属性发布失败”的事故演练：检测信号、影响范围、kill switch、数据保护、回滚、恢复验证和事后指标。不得引用真实用户内容。

## 能力项

- **editor-operability-model**：解释编辑、保存、同步、错误与发布的可观测面。
- **privacy-rollout-design**：设计数据最小化、服务端权限、Schema 兼容与回滚。
- **production-drill-verification**：用攻击、故障、告警、部署和回滚证据验证。

## 评测提示

评测会给出一条含敏感内容或无法回滚的 telemetry/deploy 方案，要求定位风险。只展示监控页面不能证明字段安全和恢复可用。

## 定向回炉

- 可观测性不足：在不增加正文的前提下补版本、规模、来源和状态。
- 安全错层：把 UI、客户端 validation、服务端 auth 分开。
- rollout 不可逆：重写为先读后写，补 kill switch 与旧数据兼容。
- 指标开销未知：禁用/启用 telemetry 做同夹具 AB。

## 验证命令（按需）

npm run typecheck

npm run lint

npm test

npm run test:e2e

npm run build

## 资料

- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy Level 3](https://w3c.github.io/webappsec-csp/)
- [Trusted Types](https://w3c.github.io/trusted-types/dist/spec/)
- [Yjs FAQ：权限与 Y.Doc 边界](https://docs.yjs.dev/api/faq)

