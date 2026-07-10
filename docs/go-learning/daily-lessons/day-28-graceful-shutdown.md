# Day 28：graceful shutdown

English title: **Day 28: graceful shutdown**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Predictable shutdown for HTTP, gRPC, DB, goroutines**

### 学习目标

- 能用 root context 管住 HTTP/gRPC/Agent 后台 goroutine 的生命周期。
- 能解释 `Shutdown`、`Close`、`GracefulStop`、`Stop` 的差异。
- 能写测试证明 shutdown 时不再接收新工作，并等待已有工作收敛或超时。

### Node.js 对照

Node.js 里常见做法是监听 `SIGTERM`，调用 `server.close()`，停止接收新连接，再等待正在处理的请求完成，最后关闭 DB pool。Go 的 `http.Server.Shutdown(ctx)` 内置了类似语义；gRPC 侧有 `GracefulStop()`。但 Go 程序还常有自己启动的 goroutine，如果它们不观察 context，进程关闭路径仍然不可控。

本日迁移重点：从 “关 HTTP server” 转成 “root context 取消后，所有后台工作都能被等待、超时和记录”。

### Go 核心心智

- `signal.NotifyContext` 把 OS signal 转成 context cancellation。
- `http.Server.Shutdown(ctx)` 停止接收新请求，并等待 active requests；`Close()` 更像立即关闭连接。
- gRPC `GracefulStop()` 等待已有 RPC 完成；`Stop()` 是更强硬的停止。
- DB pool 关闭通常不接收 context，所以要安排在请求入口停止之后、进程退出之前。
- 后台 goroutine 需要 `Wait()` 或 `errgroup` 收敛，不能只靠主函数结束。

### 实践步骤

1. 创建 `App` 或 `Runtime` 类型，持有 root context、cancel、HTTP server、可选 gRPC server、DB pool fake、background `errgroup`。
2. 实现 `/healthz`：运行中返回 200；shutdown 开始后返回 503 或停止接收新请求。
3. 启动一个模拟 Agent planning goroutine：循环发布 progress，并在 `ctx.Done()` 后退出。
4. 实现 `Run(ctx)` 和 `Shutdown(ctx)`：收到 signal 或外部 cancel 后，先标记 draining，再停止 HTTP/gRPC 接收新工作，再 cancel root context，等待后台 goroutine，最后关闭 DB pool。
5. 写 `httptest` 或真实本地 listener 测试：请求处理中触发 shutdown，验证已有请求能完成；shutdown 后新请求失败或 healthz 不再 ready。
6. 写一个 timeout 测试：模拟后台任务不退出，`Shutdown` 在 deadline 后返回错误并记录日志。
7. 用 race detector 跑全量，确认 shutdown 与 progress/run goroutine 并发时没有 race。

### 建议文件

- `cmd/trip/main.go` 或当前练习入口
- `internal/runtime/app.go`
- `internal/runtime/app_test.go`
- `internal/runtime/health.go`
- `internal/runtime/shutdown_test.go`

保持练习小：HTTP、gRPC、DB 可以用 fake 或最小实现串出关闭顺序，不需要搭一个完整服务。

### 测试/验证命令

```bash
gofmt -w cmd internal/runtime
go test ./...
go test -race ./...
```

定向 shutdown 测试：

```bash
go test ./internal/runtime -run 'TestGracefulShutdown|TestShutdownTimeout' -count=1 -v
```

手动验证时可运行服务后发送 `SIGTERM`：

```bash
go run ./cmd/trip
```

另一个终端中执行：

```bash
pkill -TERM trip
```

### 检索问题

- `http.Server.Shutdown` 和 `http.Server.Close` 的区别是什么？
- 为什么 shutdown 要先停止入口，再取消后台工作，最后关 DB pool？
- 如果某个 goroutine 不监听 `ctx.Done()`，优雅关闭会在哪里卡住？

### 常见误区

- 只处理 HTTP server，不处理自己启动的 goroutine。
- 在 signal handler 里直接 `os.Exit(0)`，跳过 defer、日志 flush 和资源关闭。
- shutdown 没有 timeout，导致进程在部署或测试中无限等待。
- health check 在 draining 时仍返回 ready，让负载均衡继续打流量。
