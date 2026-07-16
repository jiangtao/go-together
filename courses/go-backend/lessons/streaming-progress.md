# Day 33：streaming progress

English title: **Day 33: streaming progress**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
