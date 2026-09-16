# Go Agent 应用实战

面向前端应用侧转来、有一定 Node.js 后端基础的学习者。路线固定为 **WeKnora 完整应用与首次贡献 → Eino 深入 Agent 机制 → 按需 MCP**。

## 学习入口

- [课程结构](course.json)定义稳定课次与线路图。
- [课程评测政策](evaluation/policy.md)与[命令配置](evaluation/command-profile.json)定义本课证据边界。
- [Go 基础课](../go-backend/README.md)提供 HTTP、JSON、context、数据库与并发补课材料。
- [设计依据与阶段计划](../../docs/go-agent-learning-plan.md)保留原调研结论和课程映射。

课文中的系统操作是学习者实验，不代表作者已经替学习者完成。先固定项目版本与必要环境；每课至少深入 Go 业务逻辑或运行机制，保留对应验证。

## 分块与阶段里程碑

路线图分为三条主干，主干内按阶段递进。主干用于归纳知识，阶段用于检查产物；课次连线表达建议学习顺序，不代表所有模块都有强制先修关系。进入 Eino 仍以能独立追通问答链路为条件，不要求贡献已合并，MCP 实现仍是按需选修。

| 主干 | 阶段 | 里程碑与总结入口 |
|---|---|---|
| WeKnora 应用与后端 | 功能闭环 · Day 1-8 | [Day 8](lessons/application-chain-review.md)：独立解释上传、检索与问答链路 |
| WeKnora 应用与后端 | 后端与检索 · Day 9-16 | [Day 16](lessons/failure-attribution-review.md)：用证据定位取消、任务、一致性与检索问题 |
| 真实项目贡献 | 首次贡献 · Day 17-20 | [Day 20](lessons/contribution-evidence-package.md)：交付复现、Go 回归验证与贡献材料 |
| Agent 机制与复盘 | Eino 机制进阶 · Day 21-28 | [Day 28](lessons/orchestration-decision.md)：可测的小服务与框架职责总结 |
| Agent 机制与复盘 | 复盘与按需 MCP · Day 29-30 | [Day 30](lessons/next-step-and-mcp.md)：整理能力缺口，按真实需求决定下一步 |

## 与基础课的分工

基础课中的最小 Agent 是 Go 综合练习，不是需要重新实现一遍的前置产品。实战课复用已有业务与测试材料，在真实项目和框架边界增加验证。

| 基础课已有产物 | 实战课复用与新增 |
|---|---|
| 小 Tool 接口、Trip 查询、fake store | Day 23 复用业务查询与输入矩阵，新增 Eino 工具适配、schema 与调用 ID 验证 |
| 脚本模型与最小手写循环 | Day 22 复用场景和断言，改由 Eino 执行，验证框架消息与终态；不再手写另一套循环 |
| context、错误分类、SSE 事件与取消测试 | Day 25 复用业务事件和测试客户端，新增 Eino 事件映射及跨框架取消验证 |
| memory 持久化与工程加固 | Day 27 区分业务日志、上下文状态与执行恢复，按固定版本验证一个机制 |

没有这些基础课产物时，按本课范围补最小实现即可；不要求先把基础课所有 Agent 练习全部做完。复用仅限学习材料，评测仍只使用当前课允许的证据，不自动搬运通过状态。

## 30 个课次

| Day | 课次 | 阶段 |
|---|---|---|
| 1 | [固定版本与环境基线](lessons/version-and-baseline.md) | WeKnora 功能闭环 |
| 2 | [启动一个最小知识库](lessons/local-weknora-loop.md) | WeKnora 功能闭环 |
| 3 | [从上传操作追到 Go 业务逻辑](lessons/upload-request-path.md) | WeKnora 功能闭环 |
| 4 | [解析、切分与索引的状态边界](lessons/document-processing-states.md) | WeKnora 功能闭环 |
| 5 | [一次问答中的检索与引用](lessons/retrieval-and-citations.md) | WeKnora 功能闭环 |
| 6 | [问答流与页面状态](lessons/question-streaming-path.md) | WeKnora 功能闭环 |
| 7 | [参数与错误穿过前后端边界](lessons/parameter-and-error-contracts.md) | WeKnora 功能闭环 |
| 8 | [独立复述应用闭环](lessons/application-chain-review.md) | WeKnora 功能闭环 |
| 9 | [取消回答的真实语义](lessons/cancel-request-semantics.md) | WeKnora 后端与检索 |
| 10 | [用 Go 测试证明取消与清理](lessons/cancellation-regression-test.md) | WeKnora 后端与检索 |
| 11 | [异步任务、重试与幂等](lessons/async-task-retry.md) | WeKnora 后端与检索 |
| 12 | [数据库与索引的一致性](lessons/database-index-consistency.md) | WeKnora 后端与检索 |
| 13 | [并发上限与超时预算](lessons/concurrency-and-deadlines.md) | WeKnora 后端与检索 |
| 14 | [上下文构建与工具选择](lessons/agent-context-and-tools.md) | WeKnora 后端与检索 |
| 15 | [用固定数据检查检索与引用](lessons/retrieval-quality-fixture.md) | WeKnora 后端与检索 |
| 16 | [逐层定位问答失败](lessons/failure-attribution-review.md) | WeKnora 后端与检索 |
| 17 | [筛选一个值得贡献的问题](lessons/contribution-candidate-triage.md) | WeKnora 首次贡献 |
| 18 | [构造最小复现与失败测试](lessons/minimal-reproduction.md) | WeKnora 首次贡献 |
| 19 | [最小修复与回归范围](lessons/minimal-fix-and-regression.md) | WeKnora 首次贡献 |
| 20 | [整理可复查的贡献材料](lessons/contribution-evidence-package.md) | WeKnora 首次贡献 |
| 21 | [从完整应用抽出 Eino 小服务](lessons/eino-service-boundary.md) | Eino 机制进阶 |
| 22 | [让 Agent 循环可确定测试](lessons/eino-scripted-model.md) | Eino 机制进阶 |
| 23 | [一个只读业务工具的契约](lessons/eino-readonly-tool.md) | Eino 机制进阶 |
| 24 | [工具循环的错误与终止边界](lessons/eino-loop-failure-bounds.md) | Eino 机制进阶 |
| 25 | [HTTP 与 Agent 事件流](lessons/eino-http-stream.md) | Eino 机制进阶 |
| 26 | [比较平台与框架的职责](lessons/platform-framework-comparison.md) | Eino 机制进阶 |
| 27 | [上下文管理与中断恢复](lessons/context-or-resume.md) | Eino 机制进阶 |
| 28 | [何时需要编排或多个 Agent](lessons/orchestration-decision.md) | Eino 机制进阶 |
| 29 | [完整链路验证与证据索引](lessons/full-chain-verification.md) | 复盘与按需 MCP |
| 30 | [复盘与按需 MCP 接入](lessons/next-step-and-mcp.md) | 复盘与按需 MCP |

## 当前完成边界

30 篇课文和节点定义是教程交付；学习者是否完成由逐课证据决定。WeKnora 系统部署和真实模型验证有单独前置条件，Eino 在能独立追踪问答链路后开始。首次贡献不以合并为门槛，MCP 不作为必修实现。
