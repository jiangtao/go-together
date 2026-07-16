# Day 22：interceptor + metadata

English title: **Day 22: interceptor + metadata**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 把 HTTP middleware 心智迁移到 gRPC unary interceptor。
- 使用 metadata 读取调用方传入的 auth/header-like 信息。
- 实现最小 logging/auth interceptor，并用测试证明失败返回 `Unauthenticated`。

### Node.js 对照

在 Express/Fastify/Nest 中，middleware 或 guard 通常读取 header、记录请求耗时、决定是否继续调用 handler。gRPC interceptor 做类似的事，但它围绕 RPC method、metadata、handler、status code 和 duration 工作。metadata 类似 header，却不是 HTTP handler 的 `req.headers`；它跟随 RPC context，在 client/server 两侧都由 gRPC 管理。

### Go 核心心智

- unary interceptor 签名围绕 `ctx`、`req`、`info`、`handler`；调用 `handler(ctx, req)` 才会进入真正 RPC。
- metadata 从 `metadata.FromIncomingContext(ctx)` 读取；key 通常按 lowercase 处理。
- interceptor 返回的 error 就是 client 看到的 RPC status。
- 日志记录 method、code、duration、request id 等边界信息；不要记录 token 明文。
- 如果要把认证后的 principal 放入 context，使用私有 key 类型，避免 string key 冲突。

### 实践步骤

1. 实现 `LoggingUnaryInterceptor(logger)`：记录 `info.FullMethod`、duration、`status.Code(err)`。
2. 实现 `AuthUnaryInterceptor(authenticator)`：从 incoming metadata 读取 `authorization` 或课程自定义的 `x-trip-token`。
3. auth 失败返回 `status.Error(codes.Unauthenticated, "missing or invalid credentials")`。
4. auth 成功时把 caller/principal 放入 context，再调用 handler。
5. 在 test server helper 中加入 `grpc.ChainUnaryInterceptor(logging, auth)`。
6. 写 metadata missing test：client 不带 token，断言 `codes.Unauthenticated`，并证明 service fake 没有被调用。
7. 写 metadata success test：client 使用 `metadata.NewOutgoingContext` 携带 token，断言 handler 能读到 principal。
8. 写日志测试时只断言关键字段存在，不断言完整格式，避免把日志实现锁死。

### 建议文件

- `internal/grpcserver/interceptors.go`
- `internal/grpcserver/auth.go`
- `internal/grpcserver/interceptors_test.go`
- `internal/grpcserver/testserver_test.go`

### 测试/验证命令

```bash
gofmt -w internal/grpcserver
go test ./internal/grpcserver -run 'Test(Auth|Logging)UnaryInterceptor'
go test ./...
```

### 检索问题

- HTTP middleware 和 gRPC interceptor 的相同点、不同点分别是什么？
- metadata 为什么适合承载 token/request id，却不适合承载大块业务数据？
- 为什么认证失败要返回 `Unauthenticated`，而不是 `PermissionDenied` 或 `Internal`？

### 常见误区

- 在日志里打印完整 token，给后续排障留下安全风险。
- interceptor 忘记调用 `handler(ctx, req)`，导致所有 RPC 都被“成功拦截”但业务没有执行。
- metadata key 大小写混用，测试在本机通过但实际调用方拿不到值。
- 认证后用普通 string 作为 context key，和别的包发生隐式冲突。
- 把所有鉴权逻辑写进每个 handler，错过 interceptor 作为边界机制的价值。
