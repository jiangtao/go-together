# Day 07：HTTP Routing

English title: **Day 07: HTTP Routing**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 Express/Fastify 的 route 心智迁移到 Go `net/http` 的 `http.Handler` / `http.HandlerFunc`。当天结束时，你应该能解释一个 request 如何从 `ServeMux` 进入 handler，handler 如何解析路径参数并调用 service，以及为什么 handler 测试不需要启动真实端口。

当天最小能力：

- 实现 `GET /healthz`。
- 实现 `GET /trips/{id}`。
- 把路由构造封装成 `NewRouter(...) http.Handler`。
- 用 `httptest` 验证 handler 行为。

### Node.js 对照

Node.js 里常见写法是：

```ts
app.get("/trips/:id", async (req, res, next) => {
  const trip = await tripService.getTrip(req.params.id)
  res.json(trip)
})
```

Go 里不是把一个全局 app 当作中心对象持续挂载回调，而是围绕 `http.Handler` 组合：

```go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}
```

`http.HandlerFunc` 是一个适配器，让普通函数也能满足 `http.Handler`。从 Node.js 迁移时，不要把 handler 当成“轻量 controller 里塞业务逻辑”，而要把它看成协议适配层。

### Go 核心心智

`net/http` 的核心不是框架，而是接口组合。router 负责分发，handler 负责协议边界，service 负责用例。Go 1.22+ 标准库 `ServeMux` 支持方法和路径模式，例如 `GET /trips/{id}`，可以用 `r.PathValue("id")` 读取路径参数；如果学习环境更旧，再观察 chi 这类 router 的风格也可以，但第一遍建议先用标准库。

关键判断：

- `NewRouter(service)` 返回 `http.Handler`，而不是直接 `ListenAndServe`。
- `main.go` 负责端口、日志和进程生命周期。
- handler 里不创建真实数据库连接。
- path id 是外部输入，必须校验后再传给 service。

### 实践步骤

1. 定义 handler 依赖的小接口，例如 `TripService` 只暴露 `GetTrip(ctx, id)`。
2. 写 `NewRouter(service TripService) http.Handler`，内部创建 `http.NewServeMux()`。
3. 注册 `GET /healthz`，返回 `200 OK` 和一个很小的 JSON body，例如 `{"status":"ok"}`。
4. 注册 `GET /trips/{id}`，读取 `id`，空 id 或非法 id 返回 bad request。
5. handler 调用 `service.GetTrip(r.Context(), id)`，成功时写 JSON。
6. 暂时只做最小错误处理：not found 可以先返回 `404`，更完整的错误映射留到 Day 9。
7. 写最小 handler test：构造 fake service，不启动真实端口，直接对 `http.Handler` 发 request。
8. 可选手动验证：用 `go run` 启动本地 server，再用 `curl` 访问 health endpoint。

### 建议文件

- `cmd/trip-api/main.go`：只负责进程入口、端口、router 装配。
- `internal/triphttp/router.go`：`NewRouter` 和路由注册。
- `internal/triphttp/handlers.go`：health 和 trip handlers。
- `internal/triphttp/handlers_test.go`：`httptest` 覆盖成功和失败路径。
- `internal/trip/service.go`：handler 依赖的 service 接口或已有 service。

### 测试/验证命令

```sh
gofmt -w ./cmd ./internal
go test ./...
go run ./cmd/trip-api
curl -i http://localhost:8080/healthz
curl -i http://localhost:8080/trips/trip_123
```

如果还没有可启动的 `cmd/trip-api`，当天至少要保证：

```sh
go test ./internal/triphttp -run Test
```

### 检索问题

- `http.Handler` 和 `http.HandlerFunc` 为什么可以互相配合？
- Go 1.22 `ServeMux` 的路径模式和 Express `:id` 参数有什么差异？
- handler test、server integration test、service test 分别证明什么？

### 常见误区

- 在 handler 里直接写业务规则，导致协议层和领域层混在一起。
- 在测试里启动真实端口，造成慢、脆弱、端口冲突。
- 把 `http.ResponseWriter` 当作可以随时重写状态码的对象；一旦写入 header/body，状态码基本就已经提交。
- 忘记使用 `r.Context()`，让取消和超时信号无法传到 service。
