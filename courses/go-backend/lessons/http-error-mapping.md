# Day 09：HTTP Error Mapping

English title: **Day 09: HTTP Error Mapping**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 Node.js exception filter / error middleware 的心智迁移到 Go 显式 error classification 和 HTTP response mapping。当天结束时，你应该能实现统一 `WriteError`，把 domain/service error 映射为稳定的 HTTP status、error code 和安全 message。

当天最小能力：

- 定义统一 error response body。
- 使用 `errors.Is` / `errors.As` 识别错误类别。
- 区分 not found、validation、deadline/cancel、unknown。
- 保证 500 response 不泄露内部错误细节。
- 测试 wrapped error 仍能正确映射。

### Node.js 对照

Node.js 里常见做法是抛异常，然后交给框架 error middleware：

```ts
throw new NotFoundException("trip not found")
```

Go 更常见的边界是函数返回 `error`，上层显式决定如何处理。domain 层可以定义稳定错误类别，例如 `ErrTripNotFound`、`ErrInvalidTrip`，但不应该 import `net/http` 或返回状态码。

### Go 核心心智

错误文字用于人读，错误类别用于程序判断。`fmt.Errorf("load trip: %w", err)` 可以不断补上下文，同时保留底层类别；HTTP 层用 `errors.Is` / `errors.As` 把类别转换成协议响应。这个转换只发生在边界层。

推荐 error body：

```json
{
  "error": {
    "code": "trip_not_found",
    "message": "trip not found"
  }
}
```

关键判断：

- `ErrTripNotFound` -> `404 Not Found`。
- validation error -> `400 Bad Request`。
- `context.DeadlineExceeded` -> `504 Gateway Timeout` 或本服务约定的 timeout status。
- `context.Canceled` 通常表示客户端或上游取消；学习切片里可以映射成自定义 `499`，生产里要结合网关约定。
- unknown error -> `500 Internal Server Error`，body 不包含 DB SQL、stack、panic 细节。

### 实践步骤

1. 在 domain/service 层确认已有稳定错误类别，例如 `ErrTripNotFound`、`ErrInvalidTrip`。
2. 在 HTTP 层定义 `ErrorResponse` 和内部 `httpError` 映射结果。
3. 实现 `mapError(err error) (status int, code string, message string)`。
4. 实现 `WriteError(w http.ResponseWriter, err error)`，统一写 `Content-Type: application/json`。
5. 把 Day 7/8 handler 中散落的错误响应替换为 `WriteError`。
6. 写测试覆盖 direct error 和 wrapped error：`fmt.Errorf("service get: %w", ErrTripNotFound)` 仍返回 404。
7. 写测试覆盖 unknown error：日志可以记录内部错误，但 response body 只能给通用消息。
8. 写测试覆盖 deadline/cancel，确保它们不会被当成普通 500。

### 建议文件

- `internal/trip/errors.go`：domain/service 稳定错误类别。
- `internal/triphttp/errors.go`：HTTP error mapping。
- `internal/triphttp/errors_test.go`：mapping 单元测试。
- `internal/triphttp/handlers.go`：handler 使用 `WriteError`。
- `internal/triphttp/handlers_test.go`：端到端 handler response 断言。

### 测试/验证命令

```sh
gofmt -w ./internal
go test ./internal/triphttp -run 'Test(WriteError|MapError|HandlerError)'
go test ./...
```

可选手动验证：

```sh
curl -i http://localhost:8080/trips/not-exist
curl -i -X POST http://localhost:8080/trips -H 'content-type: application/json' -d '{"name":""}'
```

### 检索问题

- 为什么错误类别应该稳定，而错误文字可以随上下文变化？
- `errors.Is` 和 `errors.As` 分别适合什么场景？
- 为什么 domain 层不应该知道 HTTP status？
- 500 response 为什么不能把内部错误原样返回给客户端？

### 常见误区

- 用字符串包含判断错误类型，例如 `strings.Contains(err.Error(), "not found")`。
- 在 domain/service 层返回 `http.StatusNotFound`，导致核心逻辑依赖 HTTP。
- 包装错误时忘记 `%w`，导致 `errors.Is` 失效。
- 过度暴露内部错误，把 SQL、连接串、panic 信息写进 response。
- 把所有错误都返回 500，让客户端无法做正确处理。
