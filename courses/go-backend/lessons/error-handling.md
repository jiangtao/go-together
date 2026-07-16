# Day 05：error handling

English title: **Day 05: error handling**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 能从 Node.js `throw/catch` 心智迁移到 Go 的显式 `value, error` 返回。
- 能定义稳定的 sentinel error，并用 `errors.Is` 判断错误类别。
- 能用 `fmt.Errorf("%w", err)` 包装错误，同时保留错误链。
- 能区分错误类别、错误上下文和展示给外部协议层的错误信息。

### Node.js 对照

- Node.js 常用 exception、Promise rejection 或框架 error middleware 集中处理错误。
- Go 要求调用点显式检查 `err`，错误处理是正常控制流的一部分。
- JavaScript Error 通常靠 class、name、message 分类；Go 常用 sentinel error、自定义 error type、`errors.Is`、`errors.As`。
- Node.js stack trace 常被用于定位；Go 更强调在错误向上返回时补充当前上下文。

### Go 核心心智

- error 是值，不是异常；返回 error 不会自动中断程序。
- sentinel error 用来表达稳定类别，例如 `ErrTripNotFound`、`ErrInvalidTrip`。
- 错误消息可以变化，但错误类别一旦被上层依赖，就要保持稳定。
- 包装错误时使用 `%w`，否则 `errors.Is` / `errors.As` 无法穿透错误链。
- 领域层只表达领域错误，不要提前决定 HTTP status 或 gRPC code。

### 实践步骤

1. 在 `internal/trip` 定义 `var ErrTripNotFound = errors.New("trip not found")`。
2. 定义 `var ErrInvalidTrip = errors.New("invalid trip")`，用于可分类的校验失败。
3. 实现 `ValidateTripID(id string) error`：空 id 返回包装了 `ErrInvalidTrip` 的错误，并带上上下文。
4. 实现 `FindTrip(trips []Trip, id string) (Trip, error)`：找不到时返回包装了 `ErrTripNotFound` 的错误。
5. 实现一个 service 函数，例如 `GetTripName(trips []Trip, id string) (string, error)`，在调用 `FindTrip` 失败时继续包装上下文。
6. 写测试证明：错误文本包含上下文，但 `errors.Is(err, ErrTripNotFound)` 仍为 true。
7. 写测试证明：修改外层错误文字不应破坏错误类别判断。
8. 写测试区分 invalid id 和 not found，避免所有失败都返回同一个 error。

### 建议文件

- `internal/trip/errors.go`
- `internal/trip/find.go`
- `internal/trip/errors_test.go`
- `internal/trip/find_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'Test.*Error|TestFindTrip|TestValidateTripID' -v
```

### 检索问题

- 什么时候错误需要稳定类别？什么时候只需要补充上下文？
- `%w` 和 `%v` 包装 error 的结果有什么关键差异？
- 为什么领域层不应该直接返回 HTTP status？
- `errors.Is` 适合判断什么？`errors.As` 又适合什么？

### 常见误区

- 写了 `fmt.Errorf("find trip: %v", err)`，导致错误链断掉。
- 用字符串比较错误。错误消息是给人看的，类别判断应使用 `errors.Is` 或 `errors.As`。
- 把所有错误都做成 sentinel。只有上层需要稳定分类时才值得定义。
- 在低层吞掉错误，返回 zero value，让调用方无法知道失败原因。
- 错误信息缺少上下文，导致测试能过但调试时不知道哪一步失败。
