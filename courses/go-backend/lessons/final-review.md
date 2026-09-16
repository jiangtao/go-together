# Day 36：复盘与 WeKnora 进阶

English title: **Day 36: Final Review and WeKnora Learning Path**

返回：[课程目录](../README.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 36 天学习转成可复用的工程判断，并用 capstone rubric 完成自评。今天不是继续加功能，而是证明自己能解释这条链路：HTTP/gRPC -> service -> sqlc repository -> transaction -> Agent tool loop -> streaming progress -> tests -> structured logs -> race check -> graceful shutdown。

### Node.js 对照

Node.js 项目收尾时，你可能会写 PR checklist、测试报告、incident-style retro 和下一阶段计划。Go 课程的 final review 要更强调可执行证据：命令输出、测试覆盖、race 结果、migration/sqlc 可复现、context 传播、接口边界、错误映射和 shutdown 行为。

### Go 核心心智

- final review 是学习复盘，不是产品发布说明。
- 自评要基于证据：代码路径、测试命令、失败记录、修复记录和白板解释。
- Go 能力不是“写出最终答案”，而是能说明 package 边界、接口大小、error wrapping、context 取消、事务一致性、channel 所有权和 shutdown 收敛。
- rubric 是检查学习覆盖面的工具，不是为了刷分扩大范围。
- 下一阶段 30 天计划要继续围绕开源阅读和小切片复刻，不把课程变成用户自有产品路线。

下一阶段可参考 [Go Agent 学习与贡献计划](../../../docs/go-agent-learning-plan.md)：以 WeKnora 为主项目，从页面操作追到 Go 后端，验证取消、错误、检索或流式边界并准备首次贡献；能独立追踪问答链路后再用 Eino 拆出单 Agent 小服务，有实际接入需求时再学 MCP。它不增加本日必修项，也不以付费模型调用或上游 PR 合并作为本日通过条件。

### 下一阶段：WeKnora → Eino → 按需 MCP

针对前端应用侧转来、有一定 Node.js 后端基础的学习者，以 WeKnora 为主项目和首次贡献入口。每个任务至少追到一段 Go 业务逻辑，并补上关键行为验证。

围绕一条完整链路逐层深入：**上传文档 → 解析与切分 → 建立索引 → 用户提问 → 检索 → Agent 调用工具 → 流式返回**。具体问答模式经过哪些节点，以所选版本源码为准。

| 阶段 | 学习单元 | 研究重点 | 阶段产物 |
|---|---|---|---|
| WeKnora 功能闭环 | P01-P08 | 版本与环境、上传与处理状态、问答与引用、Go 路由和流式返回 | 能独立从页面操作追到 Go 业务处理，附调用图与一项校验测试 |
| WeKnora 后端与检索 | P09-P16 | 取消、异步任务、重试、一致性、并发限制、上下文与排序 | 一个后端边界问题的验证，10 份文档与 10 个问题的检索/引用证据 |
| WeKnora 首次贡献 | P17-P20 | 找前后端交界问题，核对认领和 PR，复现与最小修复 | 稳定复现、Go 回归测试、补丁或已有 PR 验证材料 |
| Eino 机制进阶 | P21-P28 | HTTP → 单 Agent → 一个业务工具 → 流式返回，再研究上下文和中断恢复 | 可离线测试的小服务，能解释与完整应用的职责差异 |
| 复盘与按需扩展 | P29-P30 | 重跑相关验证，确定一个实际接入需求 | 完整证据与下一目标；需要跨进程工具接入时再学 MCP |

这些单元已对应“Go Agent 应用实战”独立课程的 Day 1-30，可从网站课程选择器进入。它与当前 37 个基础 Lesson 分别记录进度。进入 Eino 的条件是能独立追踪 WeKnora 一次问答请求，不以贡献是否被合并为条件。

### 首个深入问题：取消回答

调查“页面停止回答后，后端是否还在调用模型”，不预设项目存在缺陷。先观察页面取消是断开连接还是发出显式请求，再追踪 Go handler、任务生命周期、context、工具执行与资源释放。区分独立后台任务和请求内任务的取消语义。

用阻塞的模型/工具替身与同步信号验证退出、终态和资源回收。完成时同时给出页面现象、Go 测试及源码位置，不能只用页面停止显示证明后端停止。

### 首次贡献的选题边界

- 页面参数在后端是否正确使用。
- 取消、重试或刷新后的请求与任务状态是否一致。
- 后端错误是否完整传到页面。
- 流式结束、异常、断连时的状态是否完整。
- 检索分数、来源与引用是否与页面展示一致。

这些是调查方向，不是已确认且无人处理的 Issue。先做最小复现，检查评论和关联 PR，再决定补丁范围；复现、补测试、验证已有 PR 都是成果。MCP-Go 与 PicoClaw 保留为后续备选，不替代 WeKnora 主线。

### 实践步骤

1. 冻结范围：不再新增 provider、tool、UI 或复杂 orchestration，只修影响 rubric 的缺口。
2. 跑全量验证命令，并保存关键输出摘要：`go test ./...`、`go test -race ./...`、`sqlc generate`、migration up/down。
3. 写 `36 天 Go 学习复盘`，至少包含：
   - 我从 Node.js 迁移到 Go 的 5 个关键心智变化
   - 我能独立写出的 Go 后端切片
   - 我还不稳定的主题
   - 我读懂的开源项目模式
   - 下一阶段 30 天计划
4. 按 capstone rubric 自评 100 分，并为每一项写证据链接或文件路径。
5. 白板解释最终链路，要求能从入口一路讲到 shutdown，不跳过 context、transaction、race 和 progress。
6. 做最后一次安全检查：日志、memory、progress 中没有 token、密钥、完整隐私输入。
7. 做最后一次边界检查：Agent 仍是扩展案例，Trip 仍是贯穿案例，课程主线没有变成产品路线。

### 建议文件

- `docs/go-learning/sprint-36-day/capstone-rubric.md`
- `docs/go-learning/scratch/36-day-review.md`
- `docs/go-learning/scratch/capstone-test-output.md`
- `docs/go-learning/scratch/open-source-reading-note.md`
- `docs/go-learning/scratch/next-30-days.md`

### 测试/验证命令

```bash
sqlc generate
migrate up
migrate down
go test ./...
go test -race ./...
```

如果某条命令无法运行，要写清楚原因、缺失依赖、替代验证和下一步修复。例如：本地没有 PostgreSQL 时，不能把 DB repository 标记为完成，只能标记为 migration/query 已准备、真实 DB 验证待补。

### 检索问题

- 不看代码，如何解释从 HTTP/gRPC 入口到 Agent final answer 的完整调用链？
- capstone rubric 里哪一项最弱？它缺的是代码、测试、验证命令，还是解释能力？
- 36 天后，哪些 Node.js 心智已经迁移到 Go？哪些还会让你写出 TypeScript 风格的 Go？
- 下一阶段 30 天为什么应该继续复刻开源小切片，而不是横向添加新框架？

### 常见误区

- Day 36 继续加新功能，反而没有完成测试、race、shutdown 和复盘。
- 只写“我学会了”，没有用命令输出和文件证据支撑。
- `go test ./...` 通过就忽略 `go test -race ./...`。
- 因为没有真实 provider 调用就认为 Agent 抽象不完整；课程目标是核心 loop 可测，不是 provider 数量。
- 下一阶段计划写成产品路线，而不是开源阅读、复刻和 Go 能力补强。

### Capstone rubric 对齐

| Rubric 维度 | Day 36 需要拿出的证据 |
|---|---|
| Go 核心心智 | package 边界说明、小 interface、显式 error、context 传播测试 |
| HTTP/gRPC API | `POST /agent-runs` 或 gRPC 入口、DTO/proto 与 domain 分离、错误映射测试 |
| 数据层 | migration up/down、sqlc generate、repository wrapper、transaction rollback 测试 |
| 并发与流式 | broadcaster/stream cancel 测试、慢消费者测试、`go test -race ./...` |
| Agent 抽象 | `Tool` interface、fake `Model`、tool call/observation 测试、无真实 LLM 依赖 |
| Memory 与 progress | `agent_runs` / `agent_steps` 持久化、progress event schema、SSE/gRPC stream cancel |
| 测试与验证 | 成功、错误、取消、rollback、race、shutdown 的测试输出记录 |
| 观测性与 shutdown | 稳定 `slog` 字段、敏感信息检查、server shutdown 和 runner wait |
| 开源阅读复刻 | 四遍阅读笔记，以及 100-300 行模式复刻说明 |
