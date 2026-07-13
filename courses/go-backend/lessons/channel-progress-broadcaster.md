# Day 25：channel progress broadcaster

English title: **Day 25: channel progress broadcaster**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Progress broadcaster with channel ownership**

### 学习目标

- 能用 channel 实现一个最小 progress broadcaster，把 Agent run 的进度事件发布给多个订阅者。
- 能解释 “谁发送，谁关闭 channel” 在 broadcaster 中为什么必须有明确所有权。
- 能处理慢消费者、订阅取消和 broadcaster 关闭，避免 goroutine 泄漏。

### Node.js 对照

Node.js 里你可能会用 `EventEmitter`、callback、SSE writer 或 RxJS subject 来广播进度。它们的常见心智是“emit 事件，谁监听谁处理”。Go 里 channel 不是 EventEmitter：channel 有发送方、接收方、关闭方和阻塞语义。如果把同一个 channel 暴露给外部随便 send/close，就很容易 panic、阻塞或泄漏。

本日迁移重点：从 “event bus 谁都能 emit” 转成 “broadcaster 拥有发送和关闭权，subscriber 只读并通过 context 退出”。

### Go 核心心智

- `chan T` 会阻塞；buffer 只能缓冲峰值，不能替代背压设计。
- channel 关闭表示“以后不会再发送”，不是“请停止接收方工作”的通用信号。
- 发送方负责关闭 channel；接收方不关闭别人还可能发送的 channel。
- 每个 subscriber 最好有自己的只读 channel，避免一个慢消费者拖住所有人。
- `context.Context` 用来表达订阅生命周期，broadcaster 内部负责在取消后移除 subscriber。

### 实践步骤

1. 定义 `ProgressEvent`，包含 `RunID`、`Step`、`Message`、`At`，可选加入 `Seq` 便于测试排序。
2. 定义 `Broadcaster`，内部持有 mutex、`map[int]chan ProgressEvent`、关闭标记和下一个 subscriber id。
3. 实现 `Subscribe(ctx context.Context) (<-chan ProgressEvent, func(), error)`：返回只读 channel 和取消函数；`ctx.Done()` 后自动移除订阅并关闭该 subscriber channel。
4. 实现 `Publish(event ProgressEvent) bool`：向当前 subscribers 广播；对每个 subscriber 使用 non-blocking send 或短 timeout，避免慢消费者卡死发布者。
5. 实现 `Close()`：由 broadcaster 统一关闭所有 subscriber channel，后续 `Publish` 返回 false 或稳定错误。
6. 写测试覆盖：多个 subscriber 都收到事件；取消一个 subscriber 后不会再收到；慢消费者不会阻塞快速消费者；`Close` 后所有 channel 都能退出。
7. 用 `go test -race` 验证 `Subscribe`、`Publish`、`Close` 并发调用没有 data race。

### 建议文件

- `internal/agent/progress/event.go`
- `internal/agent/progress/broadcaster.go`
- `internal/agent/progress/broadcaster_test.go`

如果你前面几天已经有 `internal/trip` 或 `internal/agent` 目录，优先沿用现有结构；不要为了这一天重排整个练习仓库。

### 测试/验证命令

```bash
gofmt -w internal/agent/progress
go test ./...
go test -race ./...
```

定向调试时可先跑：

```bash
go test -run TestBroadcaster ./internal/agent/progress -count=1 -v
go test -race ./internal/agent/progress -count=1
```

### 检索问题

- “谁发送，谁关闭 channel” 在 broadcaster 中具体由哪个类型承担？
- 为什么 subscriber 应该拿到 `<-chan ProgressEvent`，而不是 `chan ProgressEvent`？
- 慢消费者有哪三种处理策略：阻塞、drop、隔离？本练习选哪一种，代价是什么？

### 常见误区

- 让 subscriber 自己 close channel，导致 publisher 后续 send panic。
- 在持有 mutex 时执行可能阻塞的 channel send，把整个 broadcaster 锁死。
- 只测试单 subscriber，不测试取消、关闭和慢消费者。
- 认为 buffer 足够大就不会阻塞；真实系统中 buffer 只是延迟问题暴露。
