# Day 35：hardening

English title: **Day 35: hardening**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
