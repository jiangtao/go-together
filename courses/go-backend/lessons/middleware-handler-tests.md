# Day 10：Middleware + Handler Tests

English title: **Day 10: Middleware + Handler Tests**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 Express middleware 和 Jest/Supertest 心智迁移到 Go 的 `func(http.Handler) http.Handler`、函数组合和标准库 `httptest`。当天结束时，你应该能写 request id、access log、panic recovery middleware，并用 table-driven tests 覆盖 handler 行为。

当天最小能力：

- 实现 request id middleware。
- 实现 access log middleware。
- 实现 panic recovery middleware。
- 用 `httptest.NewRequest` 和 `httptest.ResponseRecorder` 写 handler tests。
- 用 fake service 覆盖 success、not found、bad id、JSON error。

### Node.js 对照

Express middleware 通常是：

```ts
app.use((req, res, next) => {
  req.id = randomUUID()
  next()
})
```

Go middleware 通常是：

```go
func RequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        next.ServeHTTP(w, r)
    })
}
```

这不是框架魔法，而是函数接收一个 handler、返回另一个 handler。顺序就是语义。

### Go 核心心智

middleware 是显式组合链。它可以在调用 next 前后做事，也可以提前返回。request id 要进入 context 或 response header；access log 要观察 status、method、path、duration；panic recovery 要保证 response 变成安全 500，同时不要吞掉日志。

推荐顺序可以先练习：

```go
handler := RequestID(Recover(AccessLog(mux, logger)))
```

这个顺序让 request id 先进入 request，再由后续 middleware 和 handler 共享。实际项目中顺序可以调整，但必须能解释每个 middleware 观察到什么。

### 实践步骤

1. 写 `RequestID(next)`：如果 request 已有 `X-Request-Id`，沿用；否则生成一个。
2. 把 request id 放入 context，并写回 response header。
3. 写 `AccessLog(next, logger)`：记录 method、path、status、duration、request_id。
4. 为 access log 包装 `ResponseWriter`，捕获 status code；如果 handler 没显式写 status，默认为 200。
5. 写 `Recover(next, logger)`：`defer recover()`，panic 时记录日志，并返回统一 500 JSON。
6. 把 middleware 组合放到 `NewRouter` 或单独 `WithMiddleware`。
7. 用 table-driven tests 覆盖 `GET /healthz`、`GET /trips/{id}` success、not found、bad id、`POST /trips` JSON error。
8. 用 `bytes.Buffer` 或测试 logger 捕获日志，断言关键字段存在，不断言完整字符串。

### 建议文件

- `internal/triphttp/middleware.go`：request id、access log、panic recovery。
- `internal/triphttp/middleware_test.go`：middleware 单元测试。
- `internal/triphttp/response_writer.go`：可选，封装 status capture。
- `internal/triphttp/handlers_test.go`：handler table-driven tests。
- `internal/triphttp/test_fakes_test.go`：fake service 和测试 helper。

### 测试/验证命令

```sh
gofmt -w ./internal/triphttp
go test ./internal/triphttp -run 'Test(RequestID|AccessLog|Recover)'
go test ./internal/triphttp -run 'TestHandlers'
go test ./...
```

如果实现了 race-sensitive 的日志或共享状态，再运行：

```sh
go test -race ./internal/triphttp
```

### 检索问题

- middleware test、handler test、service test 的边界分别是什么？
- 为什么 Go handler test 通常不需要真实 socket？
- `ResponseRecorder` 和真实 `ResponseWriter` 有哪些差异？
- middleware 顺序改变后，request id、日志、panic recovery 的可观察行为会怎样变化？

### 常见误区

- middleware 里调用了 `next.ServeHTTP` 后又继续写 response body，造成重复响应。
- 捕获 panic 后返回了原始 panic 内容，泄露内部细节。
- 日志测试断言完整 JSON 字符串，导致字段顺序或时间变化让测试脆弱。
- handler tests 依赖真实 DB，导致 HTTP 层测试慢且定位困难。
- 忘记测试 bad id、malformed JSON、not found 这些失败路径。
