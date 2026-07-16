# Day 34：integration slice

English title: **Day 34: integration slice**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
