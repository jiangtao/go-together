# Day 24：errgroup + context

English title: **Day 24: errgroup + context**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 从手写 WaitGroup + error 收敛迁移到 `errgroup.WithContext`。
- 理解第一个错误如何取消派生 context，以及慢任务为什么必须主动观察 `ctx.Done()`。
- 使用 `SetLimit` 控制 fan-out 并发上限，避免无界 goroutine。

### Node.js 对照

这一天对应 Node.js 里带取消语义的 `Promise.all`、`AbortController` 和并发限制工具如 `p-limit`。区别是 Go 的 `errgroup.WithContext` 把“等待所有 goroutine”“返回第一个错误”“取消派生 context”放在一个结构里，但它仍然依赖每个 goroutine 自己尊重 context。

### Go 核心心智

- `errgroup.Group` 管理 goroutine 生命周期和第一个 error；`Wait()` 返回第一个非 nil error。
- `errgroup.WithContext(parent)` 返回的 ctx 会在任一 goroutine 返回 error 后取消。
- 取消不是抢占式杀死 goroutine；慢任务要在 select、I/O、sleep 或循环中观察 `ctx.Done()`。
- `SetLimit(n)` 是并发保护，不是业务重试或队列系统。
- 需要返回多个结果时，仍要设计安全的结果收敛方式。

### 实践步骤

1. 定义 `PlanTrip(ctx, request) (TripPlan, error)`，内部并发调用 destination、budget、transport、risk 四个 planner。
2. 用 `g, ctx := errgroup.WithContext(ctx)` 创建 group，并调用 `g.SetLimit(3)`。
3. 每个 `g.Go(func() error { ... })` 内部调用对应 planner，传入派生 ctx。
4. 对结果写入使用 mutex，或让每个 goroutine 只写独立字段并保证写入发生在 `g.Wait()` 之前完成且无并发冲突。
5. 设计关键错误：例如 risk planner 返回 `ErrUnsafeDestination` 时，其他慢 planner 应该观察 ctx 并尽快退出。
6. 写 cancellation test：一个 fake 立即返回错误，另一个 fake 阻塞等待 ctx done；断言阻塞 fake 被取消。
7. 写 SetLimit test：用 atomic counter 记录同时运行数量，断言最大并发不超过 3。
8. 写 success test：全部 planner 成功时返回完整 `TripPlan`。

### 建议文件

- `internal/trip/planner.go`
- `internal/trip/planner_test.go`
- `internal/trip/planner_fake_test.go`
- `go.mod`

### 测试/验证命令

```bash
go get golang.org/x/sync/errgroup
gofmt -w internal/trip
go test ./internal/trip -run TestPlanTrip
go test -race ./internal/trip -run TestPlanTrip
go test ./...
```

### 检索问题

- WaitGroup 和 errgroup 的职责差异是什么？
- `errgroup.WithContext` 为什么不能替你强制停止一个不看 context 的 goroutine？
- `SetLimit(3)` 保护的是什么资源？它不能解决什么问题？

### 常见误区

- 以为 `errgroup` 会返回所有错误；默认只返回第一个非 nil error。
- goroutine 内部忽略派生 ctx，导致错误发生后其他任务仍然慢慢跑完。
- 在 `g.Go` 循环里捕获循环变量不清晰；即使使用现代 Go，也建议显式传参让意图可读。
- 结果收敛时没有锁，`-race` 才发现并发写同一个 struct 或 map。
- 为了限制并发使用 sleep，而不是 `SetLimit` 或明确的 worker/queue 机制。
