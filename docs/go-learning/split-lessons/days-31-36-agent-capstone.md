# Day 31-36：Agent Capstone

English title: **Days 31-36: Agent Capstone**

本切片服务于 36 天 Go 学习主线的最后 6 天。它不是产品路线，也不是要做一个完整 Agent 平台；它只是把前 30 天学过的 Go 后端能力，接到一个足够小、可测试、可解释、可关闭的 Agent 扩展案例上。

学习边界：

- 贯穿领域仍然是 `Trip`，Agent 只作为扩展案例出现。
- 核心测试不访问真实 LLM、不访问真实外部工具，用 fake model 和 fake tool 保证可重复。
- 每天都必须有可运行产物：代码、migration/query、测试、流式验证、hardening 证据或复盘文档。
- 每天都用 Node.js -> Go 对照来解释心智迁移，不用“产品功能清单”替代学习目标。

## Day 31：provider abstraction

### 学习目标

把真实 LLM provider 隔离到可替换接口后面，让 Agent loop 可以在没有网络、没有 API key、没有真实模型波动的情况下被测试。今天的重点不是“接入某个模型 SDK”，而是学会在 Go 里把外部 provider 变成小接口和边界适配器。

### Node.js 对照

在 Node.js / TypeScript 中，你可能会定义 `LLMClient` interface，用 Jest mock 或 fake `fetch` 控制模型响应。Go 的对应做法是：由使用方定义小接口，用 struct 实现 fake model，用显式 `error` 表达 provider 失败。Go 不需要类继承，也不鼓励让核心逻辑依赖庞大的 SDK client。

### Go 核心心智

- interface 应由 Agent loop 所在包定义，只包含 loop 真正需要的方法。
- provider adapter 是边界层，负责把 OpenAI、Anthropic、Ollama 等 SDK 形状转换成课程内的 `ModelRequest` / `ModelResponse`。
- fake model 是一等测试工具，不是临时 hack。它要能脚本化返回 final answer、tool call、model error 和 context cancel。
- 所有 provider 调用都接收 `context.Context`，测试里可以用 deadline 证明 loop 会退出。
- 模型消息、tool call、observation 要有课程内稳定结构，避免 provider SDK 类型扩散到 service、memory、HTTP/gRPC 层。

### 实践步骤

1. 定义 `Model` 小接口，例如 `Complete(ctx context.Context, req ModelRequest) (ModelResponse, error)`。
2. 定义课程内 DTO：`ModelRequest`、`ModelMessage`、`ModelResponse`、`ToolCall`、`ToolSpec`。
3. 实现 `ScriptedModel`，按预设脚本逐次返回响应；当脚本耗尽时返回清晰错误。
4. 让 `AgentRunner` 依赖 `Model` 和 `ToolRegistry`，不要依赖真实 provider client。
5. 实现最小 loop：发送用户输入 -> 模型返回 final answer 或 tool call -> tool observation 追加进 messages -> 再问模型 -> 得到 final answer。
6. 写表驱动测试覆盖三条路径：直接 final、一次 tool call 后 final、model error。
7. 写 context 测试：fake model 阻塞时，`ctx` cancel 后 loop 返回 `context.Canceled` 或 `context.DeadlineExceeded`。

### 建议文件

- `internal/agent/model.go`
- `internal/agent/messages.go`
- `internal/agent/runner.go`
- `internal/agent/fake_model_test.go`
- `internal/agent/runner_test.go`

### 测试/验证命令

```bash
gofmt -w internal/agent
go test ./internal/agent
go test ./...
```

如果当前 scratch project 还没有 `internal/agent`，先创建最小包，再跑 `go test ./...` 确认 package 边界没有破坏。

### 检索问题

- 为什么 Agent 核心测试首先需要 fake model，而不是直接调用真实 LLM？
- Go 里“由使用方定义 interface”和 TypeScript 里“导出一个共享 client interface”的差异是什么？
- `ModelResponse` 为什么不应该直接暴露某个 provider SDK 的 response type？
- context cancel 应该在 provider adapter、Agent loop、tool call 哪些位置被观察？

### 常见误区

- 把 provider SDK client 直接塞进 `AgentRunner`，导致测试必须访问网络。
- 为未来 provider 设计过大的 interface，比如一次性放入 embeddings、chat、stream、image、retry、billing。
- fake model 只返回字符串，无法表达 tool call、错误、阻塞和取消。
- 在 loop 里用 `context.Background()` 覆盖调用方传入的 `ctx`。
- 把 provider 的错误原样泄漏到 HTTP/gRPC response，而没有在边界层分类。

## Day 32：sqlc-backed memory

### 学习目标

把 Agent memory 从内存 map 推进到可查询、可恢复、可验证的数据层。今天的重点是用 migration + sqlc + repository wrapper 持久化 `agent_runs` 和 `agent_steps`，并用事务保证 run 状态和 step 写入一致。

### Node.js 对照

在 Node.js 中，你可能会先用内存数组、Redis 或 ORM model 记录 run/step。Go 课程里要刻意练习 SQL-first：schema 和 query 是源头，sqlc 生成类型安全代码，应用自己的 repository wrapper 负责把 generated type 转成 domain type。

### Go 核心心智

- `agent_runs` 和 `agent_steps` 是不同生命周期：run 表达一次执行，step 表达执行中的模型输出、tool call、observation、final/error。
- SQL 约束是业务不变量的一部分，例如 run status 枚举、step sequence 唯一性、外键级联或限制。
- sqlc generated code 不写业务语义；业务边界放在 wrapper 或 service。
- 事务要覆盖“创建 run + 第一条 step”或“追加 step + 更新 run status”这类一致性操作。
- memory 不是聊天记录大杂烩，敏感输入、token、完整隐私文本要有最小化策略。

### 实践步骤

1. 写 migration：`agent_runs` 包含 `id`、`trip_id`、`status`、`started_at`、`finished_at`、`final_answer`、`error_message`；`agent_steps` 包含 `run_id`、`seq`、`kind`、`tool_name`、`input_json`、`output_json`、`error_message`、`created_at`。
2. 为 `agent_steps` 增加 `(run_id, seq)` 唯一约束，保证事件顺序可恢复。
3. 写 sqlc queries：`CreateAgentRun`、`GetAgentRun`、`UpdateAgentRunStatus`、`AppendAgentStep`、`ListAgentSteps`。
4. 运行 `sqlc generate`，观察 nullable 字段在 Go 里生成为什么类型。
5. 写 `MemoryStore` wrapper，隐藏 generated package 的 row type，向上返回课程内 `AgentRun` / `AgentStep`。
6. 实现事务方法：`StartRunWithStep(ctx, input)` 和 `FinishRunWithStep(ctx, input)`。
7. 写 repository tests：创建 run、追加 steps、按 seq 读取、事务失败 rollback、context cancel。

### 建议文件

- `db/migrations/00000x_create_agent_memory.up.sql`
- `db/migrations/00000x_create_agent_memory.down.sql`
- `internal/db/query/agent_memory.sql`
- `internal/memory/store.go`
- `internal/memory/tx.go`
- `internal/memory/store_test.go`

### 测试/验证命令

```bash
migrate up
sqlc generate
go test ./internal/memory
go test ./...
```

如果本地没有测试数据库，先把 migration 和 query 作为静态产物完成，并在测试说明中写明 DB 环境缺失；但 repository 行为最终要用真实 DB 或可重复的 test DB 验证。

### 检索问题

- Agent memory 为什么不能只放在内存 map 里？
- `agent_runs` 和 `agent_steps` 为什么不应该合成一张大表？
- sqlc generated type 什么时候可以留在 repository 内部，什么时候需要转成 domain type？
- 怎样证明“追加 step 失败时，run status 没有被错误更新”？

### 常见误区

- 只保存 final answer，不保存 tool call 和 observation，导致无法复盘 Agent 行为。
- 把完整 prompt、token、隐私输入无差别落库。
- 让 service 层到处依赖 sqlc generated row，破坏分层边界。
- 忽略 `commit` error，或者以为 `defer Rollback` 会替代显式错误处理。
- 用 created_at 排序代替 `seq`，让并发或时间精度问题影响 step 顺序。

## Day 33：streaming progress

### 学习目标

把 Agent 执行过程以稳定 progress event 暴露给客户端，让调用方能看到 started、tool_called、observation、final、error 等阶段。今天的重点是流式协议、channel 所有权、取消和慢消费者隔离。

### Node.js 对照

Node.js 常用 `EventEmitter`、SSE、WebSocket 或 Readable stream 推送进度。Go 可以选择 SSE 或 gRPC server streaming，但必须显式处理 channel 生命周期、context cancel、buffer、关闭责任和 data race。

### Go 核心心智

- progress event 是协议 contract，不是日志字符串。字段要稳定，文本可以调整。
- 发布者拥有发送权和关闭权；订阅者通过 `ctx` 退出。
- 慢消费者不能拖死 Agent run。可以选择小 buffer + drop、隔离 goroutine 或返回背压错误，但要明确策略。
- 客户端取消后，服务端发送循环必须退出，不能泄漏 goroutine。
- event payload 不携带敏感输入；日志和 progress 都要做最小披露。

### 实践步骤

1. 定义 `ProgressEvent`：`RunID`、`Seq`、`Type`、`Message`、`ToolName`、`At`、`Payload`。
2. 定义稳定类型常量：`started`、`model_called`、`tool_called`、`observation`、`final`、`error`。
3. 复用或实现 broadcaster：`Subscribe(ctx, runID) (<-chan ProgressEvent, error)`、`Publish(ctx, event)`、`Close(runID)`。
4. 选择一种协议入口：HTTP SSE `GET /agent-runs/{id}/events` 或 gRPC `WatchAgentRun`。
5. SSE 版本要设置 `Content-Type: text/event-stream`，每条事件 flush；gRPC 版本要在 `Send` 循环中观察 stream context。
6. 在 Agent loop 中发布事件：run started、模型调用开始、tool call、tool observation、final answer、error。
7. 写 cancel test：客户端断开或 context cancel 后，server goroutine 退出。
8. 写 slow consumer test：一个慢订阅者不会阻塞发布者和其他订阅者。

### 建议文件

- `internal/progress/event.go`
- `internal/progress/broadcaster.go`
- `internal/progress/broadcaster_test.go`
- `internal/http/agent_events.go` 或 `internal/grpc/agent_events.go`
- `internal/agent/runner_progress_test.go`

### 测试/验证命令

```bash
gofmt -w internal/progress internal/http internal/grpc internal/agent
go test ./internal/progress
go test ./internal/agent
go test -race ./internal/progress ./internal/agent
```

如果只实现 SSE，可用下面命令做手动观察：

```bash
curl -N http://localhost:8080/agent-runs/<run-id>/events
```

### 检索问题

- Agent progress event 应该包含哪些稳定字段，哪些内容只适合放日志？
- SSE 和 gRPC server streaming 在 Go handler/server 结构上有什么差异？
- “谁发送，谁关闭 channel”在 broadcaster 里如何落地？
- 慢消费者策略为什么必须在课程练习中明确，而不能靠默认 channel 阻塞？

### 常见误区

- 把 progress event 当作自由文本日志，后续客户端无法稳定解析。
- 每个订阅者共用同一个无缓冲 channel，任何一个慢消费者都会阻塞整个 run。
- handler 返回后没有关闭订阅，造成 goroutine 泄漏。
- 在 event payload 中塞入完整 prompt、API key、用户隐私输入。
- 只测 happy path，不测客户端取消和慢消费者。

## Day 34：integration slice

### 学习目标

把 HTTP/gRPC 入口、service、memory、tool、model、progress 串成一条可测链路：start run -> fake model -> tool -> memory -> progress -> final answer。今天的重点是验证边界连接，不是增加产品能力。

### Node.js 对照

Node.js 里常用 Supertest + fake service、Prisma test DB、mock provider 做集成测试。Go 里同样要用 fake model/tool 和 test DB，但更强调显式依赖注入、context 传播、接口边界和 `httptest` 或 in-process gRPC。

### Go 核心心智

- 集成测试只替换外部不稳定边界：真实 LLM、真实外部 API、真实时间和随机 ID。
- service 层负责 use case 编排：创建 run、调用 runner、写 memory、发布 progress、返回结果。
- interface 用在变化和不稳定边界，不要为每个 struct 都抽象。
- 测试要断言“发生了什么”：response、DB rows、progress events、错误映射，而不是只断言最终字符串。
- 使用 deterministic clock / ID generator，让事件顺序和快照稳定。

### 实践步骤

1. 实现 `POST /agent-runs` 或等价 gRPC unary：请求包含 `trip_id` 和用户问题，返回 `run_id`、`status`、`final_answer`。
2. 在 handler/server 中只做协议解析、调用 service、错误映射，不写 Agent loop。
3. 在 service 中创建 run，启动或同步执行 `AgentRunner`。课程练习建议先同步执行，等测试稳定后再练后台 goroutine。
4. fake model 第一次返回 `tool_call(trip_lookup)`，fake tool 返回 Trip observation，fake model 第二次返回 final answer。
5. 每一步写入 `agent_steps`，并发布 progress event。
6. 集成测试发起请求，断言 HTTP status 或 gRPC code、response body、run status、step 数量、step kind 顺序、progress event 顺序。
7. 增加一条 model error 集成测试，断言 run status 为 failed，错误 response 不泄漏内部细节。
8. 增加一条 context deadline 集成测试，证明 deadline 能从 handler/server 传到 model/tool/memory。

### 建议文件

- `internal/http/agent_runs.go` 或 `internal/grpc/agent_runs.go`
- `internal/service/agent_service.go`
- `internal/service/agent_service_test.go`
- `internal/agent/runner.go`
- `internal/tools/trip_lookup.go`
- `internal/integration/agent_run_test.go`

### 测试/验证命令

```bash
gofmt -w internal/http internal/grpc internal/service internal/agent internal/tools internal/integration
go test ./internal/service
go test ./internal/integration
go test ./...
```

如果集成测试依赖 test DB，也要在测试说明中写出启动 DB、执行 migration、清理数据的命令。

### 检索问题

- 这个链路里哪些边界最适合用 interface？哪些地方直接用具体类型更清楚？
- 为什么 integration slice 要用 fake model/tool，而不是接真实 provider？
- 如何同时证明 response、memory rows、progress events 都来自同一次 run？
- handler/server test、service test、integration test 各自应该覆盖什么？

### 常见误区

- 在 handler 里直接写 Agent loop，导致协议层和业务编排粘在一起。
- 集成测试只断言 final answer，不检查 memory 和 progress。
- 为了测试方便绕过 repository wrapper，直接操作 sqlc generated queries。
- 后台 goroutine 未等待，测试偶发通过或失败。
- 对每个内部类型都抽 interface，反而让课程切片难以读懂。

## Day 35：hardening

### 学习目标

把 capstone 从 happy path 推到可维护状态。今天集中练习错误、取消、race、shutdown、日志字段和验证命令，让最终切片可以被解释、排障和安全关闭。

### Node.js 对照

Node.js hardening 常见主题是 unhandled rejection、AbortController、process signal、stream close、日志脱敏和 integration test。Go 的对应主题是显式 error chain、`context.Context`、goroutine 收敛、race detector、`http.Server.Shutdown` / gRPC graceful stop、`slog` 字段稳定。

### Go 核心心智

- 错误路径和取消路径不是附加项，它们是 Go 服务能力的一部分。
- race detector 只能发现被测试执行到的并发路径，所以要让测试真正跑过 broadcaster、runner、shutdown。
- shutdown 要停止接收新请求，取消后台 run，并等待 goroutine 收敛。
- 结构化日志字段要稳定，方便按 `run_id`、`step_seq`、`tool_name`、`status` 排查。
- 日志、memory、progress 都不能记录 token、密钥、完整隐私输入。

### 实践步骤

1. 补 model error 测试：fake model 返回错误，run 进入 failed，progress 发出 error event。
2. 补 tool error 测试：tool 返回 observation error 或 fatal error，分别验证 loop 行为。
3. 补 memory error 测试：append step 失败时，service 返回可分类错误，并尽量保持 run 状态一致。
4. 补 context cancel 测试：model 阻塞、tool 阻塞、DB 阻塞或 stream 阻塞时，`ctx` cancel 后能退出。
5. 补 slow consumer 和 no subscriber 场景，保证 progress 发布策略稳定。
6. 跑 `go test -race ./...`，如果失败，根据报告里的 read/write goroutine 栈定位共享变量。
7. 实现 shutdown path：root context、server shutdown timeout、runner wait、broadcaster close、DB pool close。
8. 统一日志字段：`run_id`、`trip_id`、`step_seq`、`event_type`、`tool_name`、`status`、`duration_ms`、`error_kind`。
9. 写一份 hardening note，记录失败路径、race 结果、shutdown 行为和日志字段。

### 建议文件

- `internal/agent/runner_error_test.go`
- `internal/progress/broadcaster_race_test.go`
- `internal/service/agent_service_error_test.go`
- `internal/runtime/shutdown.go`
- `internal/runtime/shutdown_test.go`
- `internal/observability/logging.go`
- `docs/go-learning/scratch/agent-hardening-note.md`

### 测试/验证命令

```bash
gofmt -w internal
go test ./...
go test -race ./...
```

如果 race 测试耗时较长，可以先缩小范围定位：

```bash
go test -race ./internal/agent ./internal/progress ./internal/service
```

但 Day 35 完成前必须回到全量 `go test -race ./...`。

### 检索问题

- 如果线上 Agent run 卡住，你会先看日志、数据库、stream 状态，还是 goroutine dump？为什么？
- race detector 报告里的 read/write stack 应该怎么读？
- shutdown 时 HTTP/gRPC server、Agent runner、broadcaster、DB pool 的关闭顺序是什么？
- 哪些错误应该映射给客户端，哪些只应该进入内部日志？

### 常见误区

- 只补 happy path 单元测试，却没有覆盖 model/tool/memory/context 失败。
- `go test -race` 失败后只加 sleep，没解决共享变量所有权。
- shutdown 直接 `os.Exit` 或只关闭 server，不等待后台 run。
- 日志字段每处随手起名，导致最终排障无法按同一 key 查询。
- 把用户完整输入、provider token 或 tool 原始响应写进日志和 progress。

## Day 36：final review

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
