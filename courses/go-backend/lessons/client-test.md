# Day 20：client + test

English title: **Day 20: client + test**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 用 generated gRPC client 从调用方视角验证 `TripService.CreateTrip` contract。
- 建立不依赖真实端口的测试 server，覆盖成功、输入错误和 deadline。
- 学会断言 gRPC response、`status.Code(err)` 和 context 行为。

### Node.js 对照

这一天类似 Node.js 里的 Supertest、Nest testing module 或 `@grpc/grpc-js` client integration test：不是只测 controller 函数本身，而是让真实 client 走一遍 RPC 调用路径。Go 里常用本地 listener 或 `bufconn` 创建内存连接，既能覆盖 gRPC 编解码和 interceptor，又不需要启动外部服务。

### Go 核心心智

- generated client 是调用方 contract；server unit test 不能替代 client 视角。
- 测试里也要使用 `context.WithTimeout`，避免挂死。
- client 只看到 protobuf response 和 gRPC status，不应该依赖 server 内部 error 类型。
- 测试 server 的生命周期要明确关闭：listener、connection、server 都要清理。
- 若当前依赖版本支持 `grpc.NewClient`，优先跟随项目约定；否则课程练习中使用 `grpc.DialContext` 也可以，重点是 client/server contract。

### 实践步骤

1. 写一个 `newTestGRPCServer(t, serviceFake)` helper，创建 gRPC server，注册 `TripServiceServer`。
2. 使用 `bufconn` 或 `net.Listen("127.0.0.1:0")` 建立测试连接；不要把测试绑死到固定端口。
3. 用 generated `pb.NewTripServiceClient(conn)` 发起 `CreateTrip`。
4. 写 success test：断言 response 中的 trip id、name、owner/member 字段符合 contract。
5. 写 invalid argument test：传空 name 或非法 owner，断言 `status.Code(err) == codes.InvalidArgument`。
6. 写 deadline test：fake service 阻塞并监听 `ctx.Done()`；client 使用很短 timeout，断言 `codes.DeadlineExceeded`。
7. 如果 Day 22 会加入 interceptor，先把 test helper 留出 server options 参数，后续复用。

### 建议文件

- `internal/grpcserver/testserver_test.go`
- `internal/grpcserver/trip_client_test.go`
- `internal/grpcserver/fake_service_test.go`
- `gen/trip/v1/trip_grpc.pb.go`

### 测试/验证命令

```bash
gofmt -w internal/grpcserver
go test ./internal/grpcserver -run TestTripClientCreateTrip
go test ./...
```

### 检索问题

- 为什么只直接调用 `tripServer.CreateTrip` 不足以证明 RPC contract 可用？
- client 侧为什么应该断言 `status.Code(err)`，而不是匹配完整错误字符串？
- deadline 是 client 的行为、server 的行为，还是双方协作的行为？

### 常见误区

- 测试使用固定端口，导致并行测试或本机已有进程时失败。
- 忘记关闭 `ClientConn` 或停止 gRPC server，造成测试泄漏。
- 在测试里直接比较 error string，让测试对 gRPC 错误格式过度敏感。
- deadline 测试里 fake service 不监听 `ctx.Done()`，结果只能测到 client 超时，不能证明 server 侧可取消。
- 为了测试方便跳过真实 generated client，导致编解码和注册错误不能被发现。
