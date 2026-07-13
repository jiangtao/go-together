# Day 06：small interface + context timeout

English title: **Day 06: small interface + context timeout**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 能从“依赖完整对象”迁移到“由使用方定义小接口”的 Go 风格。
- 能定义 `TripStore`，让 service 依赖行为而不是具体数据库或内存实现。
- 能正确传递 `context.Context`，支持 timeout、deadline 和 parent cancel。
- 能用 fake store 测试 found、not found、invalid id、timeout、cancel 场景。

### Node.js 对照

- Node.js 常用 class、repository object、dependency injection container 或 mock library 替换依赖。
- Go 通常由调用方附近定义小接口，只声明当前函数真正需要的方法。
- Node.js 常用 AbortController、request timeout 或框架生命周期取消异步操作。
- Go 的 `context.Context` 是跨 API 边界传递取消信号、deadline 和 request-scoped value 的标准方式。

### Go 核心心智

- 接口越小，越容易 fake，越不容易把 service 绑死在具体实现上。
- Go interface 是隐式实现：类型不需要声明 `implements TripStore`。
- 接收 `context.Context` 的函数应该把 ctx 继续传下去，不要在内部偷换成 `context.Background()`。
- timeout 不是强制杀死 goroutine，而是协作式取消；被调用方必须主动监听 `ctx.Done()`。
- 创建带 timeout 的 context 后要 `defer cancel()`，释放 timer 和父子 context 关联资源。

### 实践步骤

1. 定义 `type TripStore interface { FindTrip(ctx context.Context, id string) (Trip, error) }`。接口放在 service 使用方附近。
2. 定义 `type Service struct { store TripStore }` 和 `NewService(store TripStore) Service`。
3. 实现 `Service.GetTrip(ctx context.Context, id string) (Trip, error)`：先校验 id，再调用 store。
4. 写 `fakeStore`，用 map 或函数字段返回指定结果，覆盖 found、not found、invalid id。
5. 实现 `slowStore`：在 `FindTrip` 中 `select` 等待 `time.After(delay)` 或 `<-ctx.Done()`。
6. 写 timeout 测试：`context.WithTimeout(context.Background(), 50*time.Millisecond)` 调用 200ms 的 `slowStore`，期望返回 `context.DeadlineExceeded`。
7. 写 parent cancel 测试：提前调用 `cancel()`，期望 service/store 迅速返回 `context.Canceled`。
8. 写一个反例式测试或注释：如果 store 内部改用 `context.Background()`，timeout 测试会卡住或失败。
9. 确认错误包装仍保留 context 错误类别：`errors.Is(err, context.DeadlineExceeded)` 必须为 true。

### 建议文件

- `internal/trip/service.go`
- `internal/trip/store.go`
- `internal/trip/service_test.go`
- `internal/trip/context_test.go`
- `internal/trip/fake_store_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'TestService|TestTripStore|TestContext|TestTimeout|TestCancel' -v
```

### 检索问题

- 为什么一个接收 `context.Context` 的小接口，比直接依赖完整 `*sql.DB` 更适合早期学习和测试？
- Go interface 为什么通常由使用方定义，而不是由实现方提前定义？
- `context.WithTimeout` 后为什么要 `defer cancel()`？
- `context.Canceled` 和 `context.DeadlineExceeded` 分别代表什么？
- 为什么业务函数内部不应该把传入的 ctx 替换成 `context.Background()`？

### 常见误区

- 在 package 顶层提前定义巨大接口，最后每个 fake 都要实现一堆无关方法。
- 把 interface 放在实现方，导致调用方被迫依赖更宽的能力集合。
- 函数签名接收了 ctx，但内部没有传给 store 或外部调用。
- timeout 测试只用 `time.Sleep`，没有检查 `errors.Is` 和返回耗时。
- 忘记 `defer cancel()`，让 timer 资源留到超时自然结束。
- 把 context 当成参数袋，塞业务必需参数。必需参数应该显式出现在函数签名里。

## 阶段收束：Day 1-6 应该形成的能力

完成这 6 天后，学习者应该能独立说明并写出以下内容：

- 一个最小 Go module，包含 `cmd/` 入口和 `internal/` 包边界。
- 一个有 zero value 语义、构造函数和 receiver 方法的 `Trip` 领域模型。
- 一组 slice itinerary helper，能解释 array、slice、capacity、append、copy 和 aliasing。
- 一组 map/set/index/string helper，能解释 comma-ok、nil map、set 模拟、string byte 与 rune。
- 一套稳定错误类别和错误包装测试。
- 一个依赖小接口和 context 的 service，并能用 fake store 验证 timeout 与 cancel。

下一阶段进入 HTTP 和 JSON 前，不要求 Trip 练习切片像产品一样完整；只要求这些基础心智能被代码和测试证明。
