# Day 19-24：gRPC 与并发

English title: **Days 19-24: gRPC and Concurrency**

这 6 天承接 Day 17-18 的 proto contract 与 Go code generation，把 `TripService` 从生成代码推进到可运行、可测试、可取消的 gRPC 与并发练习切片。课程目标仍然是学习主线：Trip 只是贯穿案例，用来稳定命名和情境，不是要做成旅行产品。

每一天都要写实际 Go 代码，并在当天结束前跑验证命令。若命令失败，先记录失败原因，再回到最小切片修通。

## Day 19：unary server

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

## Day 20：client + test

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

## Day 21：server streaming + context

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

## Day 22：interceptor + metadata

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

## Day 23：goroutine + WaitGroup

### 学习目标

- 从 `Promise.all` 迁移到 goroutine + `sync.WaitGroup`。
- 实现一个并发 enrichment 练习，证明耗时接近最慢分支而不是所有分支相加。
- 学会 WaitGroup 的边界：它只等待，不负责 error 收敛、取消或数据安全。

### Node.js 对照

Node.js 中 `Promise.all([weather(), hotel(), flight()])` 会并发等待多个异步任务，并在任一 promise reject 时整体 reject。Go 的 goroutine 更底层：`go func()` 只启动并发执行，`WaitGroup` 只负责等待全部结束。错误、结果、取消、共享内存安全，都要你自己显式设计。

### Go 核心心智

- `wg.Add(1)` 必须在启动 goroutine 之前发生，避免 goroutine 先结束导致计数错乱。
- `defer wg.Done()` 放在 goroutine 顶部，保证早返回也能释放计数。
- WaitGroup 不收集 error；用 mutex、channel 或专门的结果结构收敛。
- 多个 goroutine 写同一个 map/slice/struct 字段会 data race，必须加锁或单线程汇总。
- 每个可能阻塞的外部调用都接收并尊重 `context.Context`。

### 实践步骤

1. 定义 `TripSnapshot`，包含 weather、hotel、flight、activity 四类 enrichment 结果。
2. 定义四个 provider 小接口，例如 `WeatherProvider.GetWeather(ctx, tripID)`。
3. 实现 `RefreshTripSnapshot(ctx, tripID, providers) (TripSnapshot, []error)`。
4. 为每个 provider 启动一个 goroutine；在 goroutine 内调用 provider，并把结果写入局部变量或受 mutex 保护的结果结构。
5. 用 `sync.Mutex` 保护共享 `snapshot` 和 `errs`，或者让 goroutine 发送 typed result 到 channel 后统一汇总。
6. 写耗时测试：四个 fake provider 各 sleep 80-120ms，整体耗时应接近最慢 provider，而不是 4 个 sleep 相加。
7. 写 error test：一个 provider 失败时，函数仍等待其他 provider 完成，并返回部分 snapshot + errors。
8. 跑 race detector，确保共享写入没有竞态。

### 建议文件

- `internal/trip/snapshot.go`
- `internal/trip/enrichment.go`
- `internal/trip/enrichment_test.go`
- `internal/trip/fake_provider_test.go`

### 测试/验证命令

```bash
gofmt -w internal/trip
go test ./internal/trip -run TestRefreshTripSnapshot
go test -race ./internal/trip -run TestRefreshTripSnapshot
go test ./...
```

### 检索问题

- `wg.Add(1)` 为什么必须在 `go func()` 之前？
- WaitGroup 为什么不能替代 error handling？
- 怎样用测试证明代码真的并发执行，而不是顺序调用？

### 常见误区

- 在 goroutine 内部调用 `wg.Add(1)`，造成 `Wait()` 和 `Add()` 竞态。
- 多个 goroutine 直接 append 到同一个 `[]error`，普通测试偶尔通过，`-race` 才暴露问题。
- 以为 WaitGroup 会在某个 goroutine 报错时自动停止其他任务。
- fake provider 只返回静态值，不设置延迟，导致并发收益没有被测试证明。
- 忽略 context，让慢外部调用在上层取消后继续运行。

## Day 24：errgroup + context

### 学习目标

- 从手写 WaitGroup + error 收敛迁移到 `errgroup.WithContext`。
- 理解第一个错误如何取消派生 context，以及慢任务为什么必须主动观察 `ctx.Done()`。
- 使用 `SetLimit` 控制 fan-out 并发上限，避免无界 goroutine。

### Node.js 对照

这一天对应 Node.js 里带取消语义的 `Promise.all`、`AbortController` 和并发限制工具如 `p-limit`。区别是 Go 的 `errgroup.WithContext` 把“等待所有 goroutine”“返回第一个错误”“取消派生 context”放在一个结构里，但它仍然依赖每个 goroutine 自己尊重 context。

### Go 核心心智

- `errgroup.Group` 管理 goroutine 生命周期和第一个 error；`Wait()` 返回第一个非 nil error。
- `errgroup.WithContext(parent)` 返回的 ctx 会在任一 goroutine 返回 error 后取消。
- 取消不是抢占式杀死 goroutine；慢任务要在 select、I/O、sleep 或循环中观察 `ctx.Done()`。
- `SetLimit(n)` 是并发保护，不是业务重试或队列系统。
- 需要返回多个结果时，仍要设计安全的结果收敛方式。

### 实践步骤

1. 定义 `PlanTrip(ctx, request) (TripPlan, error)`，内部并发调用 destination、budget、transport、risk 四个 planner。
2. 用 `g, ctx := errgroup.WithContext(ctx)` 创建 group，并调用 `g.SetLimit(3)`。
3. 每个 `g.Go(func() error { ... })` 内部调用对应 planner，传入派生 ctx。
4. 对结果写入使用 mutex，或让每个 goroutine 只写独立字段并保证写入发生在 `g.Wait()` 之前完成且无并发冲突。
5. 设计关键错误：例如 risk planner 返回 `ErrUnsafeDestination` 时，其他慢 planner 应该观察 ctx 并尽快退出。
6. 写 cancellation test：一个 fake 立即返回错误，另一个 fake 阻塞等待 ctx done；断言阻塞 fake 被取消。
7. 写 SetLimit test：用 atomic counter 记录同时运行数量，断言最大并发不超过 3。
8. 写 success test：全部 planner 成功时返回完整 `TripPlan`。

### 建议文件

- `internal/trip/planner.go`
- `internal/trip/planner_test.go`
- `internal/trip/planner_fake_test.go`
- `go.mod`

### 测试/验证命令

```bash
go get golang.org/x/sync/errgroup
gofmt -w internal/trip
go test ./internal/trip -run TestPlanTrip
go test -race ./internal/trip -run TestPlanTrip
go test ./...
```

### 检索问题

- WaitGroup 和 errgroup 的职责差异是什么？
- `errgroup.WithContext` 为什么不能替你强制停止一个不看 context 的 goroutine？
- `SetLimit(3)` 保护的是什么资源？它不能解决什么问题？

### 常见误区

- 以为 `errgroup` 会返回所有错误；默认只返回第一个非 nil error。
- goroutine 内部忽略派生 ctx，导致错误发生后其他任务仍然慢慢跑完。
- 在 `g.Go` 循环里捕获循环变量不清晰；即使使用现代 Go，也建议显式传参让意图可读。
- 结果收敛时没有锁，`-race` 才发现并发写同一个 struct 或 map。
- 为了限制并发使用 sleep，而不是 `SetLimit` 或明确的 worker/queue 机制。
