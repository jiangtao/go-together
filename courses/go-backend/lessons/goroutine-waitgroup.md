# Day 23：goroutine + WaitGroup

English title: **Day 23: goroutine + WaitGroup**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 从 `Promise.all` 迁移到 goroutine + `sync.WaitGroup`。
- 实现一个并发 enrichment 练习，证明耗时接近最慢分支而不是所有分支相加。
- 学会 WaitGroup 的边界：它只等待，不负责 error 收敛、取消或数据安全。

### Node.js 对照

Node.js 中 `Promise.all([weather(), hotel(), flight()])` 会并发等待多个异步任务，并在任一 promise reject 时整体 reject。Go 的 goroutine 更底层：`go func()` 只启动并发执行，`WaitGroup` 只负责等待全部结束。错误、结果、取消、共享内存安全，都要你自己显式设计。

### Go 核心心智

- `wg.Add(1)` 必须在启动 goroutine 之前发生，避免 goroutine 先结束导致计数错乱。
- `defer wg.Done()` 放在 goroutine 顶部，保证早返回也能释放计数。
- WaitGroup 不收集 error；用 mutex、channel 或专门的结果结构收敛。
- 多个 goroutine 写同一个 map/slice/struct 字段会 data race，必须加锁或单线程汇总。
- 每个可能阻塞的外部调用都接收并尊重 `context.Context`。

### 实践步骤

1. 定义 `TripSnapshot`，包含 weather、hotel、flight、activity 四类 enrichment 结果。
2. 定义四个 provider 小接口，例如 `WeatherProvider.GetWeather(ctx, tripID)`。
3. 实现 `RefreshTripSnapshot(ctx, tripID, providers) (TripSnapshot, []error)`。
4. 为每个 provider 启动一个 goroutine；在 goroutine 内调用 provider，并把结果写入局部变量或受 mutex 保护的结果结构。
5. 用 `sync.Mutex` 保护共享 `snapshot` 和 `errs`，或者让 goroutine 发送 typed result 到 channel 后统一汇总。
6. 写耗时测试：四个 fake provider 各 sleep 80-120ms，整体耗时应接近最慢 provider，而不是 4 个 sleep 相加。
7. 写 error test：一个 provider 失败时，函数仍等待其他 provider 完成，并返回部分 snapshot + errors。
8. 跑 race detector，确保共享写入没有竞态。

### 建议文件

- `internal/trip/snapshot.go`
- `internal/trip/enrichment.go`
- `internal/trip/enrichment_test.go`
- `internal/trip/fake_provider_test.go`

### 测试/验证命令

```bash
gofmt -w internal/trip
go test ./internal/trip -run TestRefreshTripSnapshot
go test -race ./internal/trip -run TestRefreshTripSnapshot
go test ./...
```

### 检索问题

- `wg.Add(1)` 为什么必须在 `go func()` 之前？
- WaitGroup 为什么不能替代 error handling？
- 怎样用测试证明代码真的并发执行，而不是顺序调用？

### 常见误区

- 在 goroutine 内部调用 `wg.Add(1)`，造成 `Wait()` 和 `Add()` 竞态。
- 多个 goroutine 直接 append 到同一个 `[]error`，普通测试偶尔通过，`-race` 才暴露问题。
- 以为 WaitGroup 会在某个 goroutine 报错时自动停止其他任务。
- fake provider 只返回静态值，不设置延迟，导致并发收益没有被测试证明。
- 忽略 context，让慢外部调用在上层取消后继续运行。
