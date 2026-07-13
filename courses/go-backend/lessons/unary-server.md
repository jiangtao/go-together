# Day 19：unary server

English title: **Day 19: unary server**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 实现 generated `TripServiceServer` 的 unary RPC handler。
- 把 `CreateTripRequest` 显式转换为 service input，把 service result 显式转换为 `CreateTripResponse`。
- 学会把 domain/service error 映射成 gRPC `status` + `codes`。

### Node.js 对照

在 Node.js 里，这一天最像把一个 Express/Fastify/Nest controller 接到 service use case 上：controller 解析协议层输入，调用 service，再把异常或返回值映射成协议响应。区别是 Go gRPC handler 不是动态路由函数，而是生成接口要求你实现的具体方法；错误也不是 `throw` 给框架兜底，而是返回一个带 `codes.Code` 的 `error`。

### Go 核心心智

- gRPC server handler 是编译期接口：方法签名由 `_grpc.pb.go` 生成。
- `.pb.go` message 是协议 DTO，不要直接变成 domain model。
- `context.Context` 从 RPC 入口传入，向下传给 service/repository，不能在 handler 内偷换成 `context.Background()`。
- `status.Error` / `status.Errorf` 是 RPC 边界错误；domain 层仍然保留普通 Go error。
- gRPC codes 和 HTTP status 可以类比，但不能机械一一对应；要按调用方能采取的动作来选 code。

### 实践步骤

1. 打开 Day 18 生成的 `_grpc.pb.go`，找到 `TripServiceServer` interface 和 `UnimplementedTripServiceServer`。
2. 新建 `tripServer` struct，嵌入 `pb.UnimplementedTripServiceServer`，并注入一个小接口，例如 `CreateTrip(ctx context.Context, input CreateTripInput) (Trip, error)`。
3. 实现 `CreateTrip(ctx context.Context, req *pb.CreateTripRequest) (*pb.CreateTripResponse, error)`。
4. 在 handler 入口处理 `nil` request、空 name、非法 owner/member 输入；协议级输入错误返回 `codes.InvalidArgument`。
5. 把 request 转成 domain/service input，调用 service；不要让 service 接收 protobuf 类型。
6. 实现 `toStatusError(err error) error`，至少覆盖 invalid、not found、deadline/canceled、unknown/internal。
7. 写 handler unit tests：fake service 记录收到的 input，并分别返回 success、validation error、wrapped not found、unexpected error。

### 建议文件

- `internal/grpcserver/trip_server.go`
- `internal/grpcserver/status.go`
- `internal/grpcserver/trip_server_test.go`
- `internal/trip/service.go`
- `proto/trip/v1/trip.proto`
- `gen/trip/v1/*.pb.go`

### 测试/验证命令

```bash
gofmt -w internal/grpcserver internal/trip
go test ./internal/grpcserver -run TestTripServerCreateTrip
go test ./...
```

### 检索问题

- 不看笔记解释：为什么 gRPC handler 不应该直接返回 domain error？
- `codes.InvalidArgument`、`codes.NotFound`、`codes.Internal` 分别暗示 client 可以做什么？
- 为什么不要在 `internal/trip` domain/service 层 import generated protobuf package？

### 常见误区

- 手改 `_grpc.pb.go` 或 `.pb.go`，导致下一次生成覆盖改动。
- 把 HTTP status 的直觉机械搬到 gRPC codes，例如把所有业务失败都返回 `Internal`。
- 在 `CreateTrip` 里直接构造 DB/repository，使 handler 变成不可测的入口大杂烩。
- 把内部错误文字原样暴露给 client，泄露 DB、SQL 或 panic 细节。
- 忘记检查 `req == nil`，测试里直接 panic。
