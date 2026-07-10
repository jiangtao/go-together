# Day 21：server streaming + context

English title: **Day 21: server streaming + context**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 把 `WatchTrip` 建成 typed server-streaming RPC。
- 理解 stream 也是 RPC：有 request、有 context、有 status、有生命周期。
- 写出客户端 cancel 后服务端发送循环能退出的测试。

### Node.js 对照

这一天从 Node.js 的 SSE、Readable stream 或 WebSocket 经验迁移过来。SSE 常常发送自由形态 JSON 字符串，Readable stream 以 chunk 为中心；gRPC server streaming 则发送强类型 protobuf message。客户端通过 `Recv()` 拉取事件，服务端通过 `stream.Send()` 推送事件，取消和超时都挂在 RPC context 上。

### Go 核心心智

- server streaming 方法签名通常是 `WatchTrip(req, stream) error`，不是返回 slice。
- `stream.Context()` 是这条流的生命周期信号；发送循环必须观察它。
- `Send` 返回错误时要退出，不要继续发送。
- stream message 要小而稳定；不要把内部 domain struct 整个塞进 protobuf。
- client 收到 `io.EOF` 表示服务端正常结束；其他 error 要用 `status.Code` 判断。

### 实践步骤

1. 在 `.proto` 中增加 `rpc WatchTrip(WatchTripRequest) returns (stream TripEvent)`，并定义 `TripEvent` 的最小字段：`trip_id`、`sequence`、`type`、`message`、`occurred_at`。
2. 重新生成 Go code，确认 `_grpc.pb.go` 出现 `TripService_WatchTripServer` 和 client stream 类型。
3. 为 server 注入事件源小接口，例如 `WatchTrip(ctx context.Context, tripID string) (<-chan TripEvent, error)`。
4. 实现 server loop：先校验 request，再从事件 channel、`stream.Context().Done()` 中 `select`，每次事件转成 protobuf 后 `Send`。
5. 写 normal stream test：fake source 发送 2-3 个事件后关闭 channel，client `Recv()` 到 `io.EOF`。
6. 写 cancel test：client 收到第一个事件后调用 cancel；fake source 或 server 观察到 context done 并退出。
7. 给事件序号写断言，证明不是“只要能收到点东西就算过”。

### 建议文件

- `proto/trip/v1/trip.proto`
- `internal/grpcserver/trip_stream.go`
- `internal/grpcserver/trip_stream_test.go`
- `internal/trip/events.go`
- `gen/trip/v1/*.pb.go`

### 测试/验证命令

```bash
protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto
gofmt -w internal/grpcserver internal/trip gen
go test ./internal/grpcserver -run TestTripServerWatchTrip
go test ./...
```

### 检索问题

- server streaming 和 SSE 最大差异是什么？
- 为什么 `stream.Context().Done()` 不被观察时，cancel test 很容易变成假通过？
- client 侧应该如何区分正常结束 `io.EOF` 和 RPC 失败？

### 常见误区

- 把所有事件先收集成 slice 再返回，失去 streaming 的意义。
- 在发送循环里只 `range events`，不监听 context，client cancel 后 server 仍卡住。
- 多个 goroutine 同时调用同一个 server stream 的 `Send`，制造隐蔽竞态和乱序。
- 把 stream 当成日志文本通道，发送无法演化的自由字符串。
- 忘记重新生成 proto code，导致 server/client interface 和 `.proto` 不一致。
