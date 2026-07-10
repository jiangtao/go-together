# Node.js 开发者 36 天 Go 工业级后端教程

English title: **36-Day Production Go Curriculum for Node.js Backend Developers**

这是当前唯一保留的 Go 学习主教程。旧的长期目录、短课正文、速查表和重复 phase 文件都已经合并进本文并删除；后续学习、复盘和新增材料都以本文为准。

本教程保留原 30-40 天节奏，采用 Day 00 前言 + 36 天主线：先用 Day 00 搞清楚 Go 和 Node.js 的取舍、为什么学 Go、最终要获得什么能力；再进入每天 2 小时的正式训练。周末只补课、修测试和复盘，不新增主题。目标不是从零教编程，而是把已有 Node.js + SQL 后端经验迁移到 Go：能写、能测、能读开源项目，最终完成一个小型 Trip/Agent 后端切片。

## 学习者画像

你已经会：

- Node.js / TypeScript 后端开发。
- HTTP API、middleware、DTO、错误处理。
- SQL 建模、事务、数据访问层。
- 一般工程实践：测试、日志、配置、review、部署。

你主要需要补：

- Go module、package、可见性、工具链。
- Go 的 zero value、struct、array、slice、map、string/byte/rune、显式错误、小接口、context。
- Go 原生 HTTP、JSON、测试、database/sql/pgx/sqlc。
- goroutine、channel、errgroup、race detector。
- gRPC/protobuf 在 Go 中的生成代码和服务边界。
- 用 Go 写 Agent 后端：Tool interface、Model abstraction、memory、streaming progress、shutdown。
- 读 Go 开源项目并复刻小切片。

## 总验收目标

36 天后，你应该能完成并解释这个切片：

```text
HTTP/gRPC API
  -> service
  -> sqlc repository
  -> transaction
  -> Agent tool loop
  -> streaming progress
  -> tests
  -> structured logs
  -> race check
  -> graceful shutdown
```

统一练习领域：

```text
Trip
Owner
Member
TripService
TripRepository
AgentRun
AgentStep
ProgressEvent
```

## 每日节奏

| 时间 | 动作 | 要求 |
|---:|---|---|
| 15 min | 复习昨天 | 不看笔记回答昨天的 retrieval prompt |
| 25 min | 读本文、官方资料、开源片段 | 只读当天需要的内容 |
| 70 min | 写代码 | 当天必须有可运行产物 |
| 10 min | 跑验证命令并记录 | 失败也要记录，不跳过 |

周末额外 2 小时只做三件事：

1. 修本周未跑通的代码。
2. 补测试和验证命令。
3. 写阶段复盘。

## 保留文件

| 文件 | 用法 |
|---|---|
| `docs/go-learning/node-to-go-36-day-course.md` | 唯一教程正文 |
| `docs/go-learning/daily-lessons/README.md` | Day 00 前言 + 一天一个文件的实践深化材料 |
| `docs/go-learning/sprint-36-day/capstone-rubric.md` | Day 36 最终评分 |
| `RESOURCES.md` | 官方资料、开源项目和社区资源索引 |

## 官方资料

| 主题 | Primary source |
|---|---|
| Go 入门和模块 | [Go Modules Reference](https://go.dev/ref/mod), [Tutorial: Get started with Go](https://go.dev/doc/tutorial/getting-started) |
| Go 风格 | [Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) |
| 错误 | [Go 1.13 Errors](https://go.dev/blog/go1.13-errors) |
| 测试 | [testing](https://pkg.go.dev/testing), [httptest](https://pkg.go.dev/net/http/httptest), [TableDrivenTests](https://go.dev/wiki/TableDrivenTests) |
| HTTP / JSON | [net/http](https://pkg.go.dev/net/http), [encoding/json](https://pkg.go.dev/encoding/json) |
| 数据库 | [Accessing relational databases](https://go.dev/doc/database/), [database/sql](https://pkg.go.dev/database/sql), [pgxpool](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool), [sqlc PostgreSQL tutorial](https://docs.sqlc.dev/en/latest/tutorials/getting-started-postgresql.html) |
| gRPC / Protobuf | [gRPC Go Quickstart](https://grpc.io/docs/languages/go/quickstart/), [gRPC Go Basics](https://grpc.io/docs/languages/go/basics/), [Protocol Buffers Go Generated Code Guide](https://protobuf.dev/reference/go/go-generated/) |
| Context / 并发 | [context](https://pkg.go.dev/context), [Pipelines and cancellation](https://go.dev/blog/pipelines), [sync](https://pkg.go.dev/sync), [errgroup](https://pkg.go.dev/golang.org/x/sync/errgroup), [Data Race Detector](https://go.dev/doc/articles/race_detector) |
| 日志与关闭 | [log/slog](https://pkg.go.dev/log/slog), [http.Server.Shutdown](https://pkg.go.dev/net/http#Server.Shutdown), [signal.NotifyContext](https://pkg.go.dev/os/signal#NotifyContext), [gRPC graceful stop](https://grpc.io/docs/guides/server-graceful-stop/) |

## 36 天全局路线

| Phase | Day | 主题 | 主产物 |
|---|---:|---|---|
| 01 | 1 | module/package/toolchain | `cmd/trip` + `internal/trip` |
| 01 | 2 | value model / struct / zero value | `Trip` / `Member` domain + receiver tests |
| 01 | 3 | data structures I: array / slice | itinerary list + capacity/copy tests |
| 01 | 4 | data structures II: map / set / string / rune | member index + tag set + rune-safe helpers |
| 01 | 5 | error handling | sentinel error + wrapping tests |
| 01 | 6 | small interface + context timeout | `TripStore` + timeout-aware fake tests |
| 02 | 7 | HTTP routing | `GET /healthz`, `GET /trips/{id}` |
| 02 | 8 | JSON DTO | `POST /trips` request/response DTO |
| 02 | 9 | HTTP error mapping | domain error -> HTTP status |
| 02 | 10 | middleware + handler tests | middleware + `httptest` table-driven tests |
| 03 | 11 | pgx first contact | `pgxpool` + query |
| 03 | 12 | migration | `000001_create_trips` up/down |
| 03 | 13 | sqlc generate | schema/query/sqlc config |
| 03 | 14 | repository wrapper | `Store` wrapping generated queries |
| 03 | 15 | transaction boundary | `CreateTripWithOwner` transaction |
| 03 | 16 | DB verification | rollback/failure tests |
| 04 | 17 | proto contract | `TripService.CreateTrip` proto |
| 04 | 18 | code generation | `.pb.go` / `_grpc.pb.go` |
| 04 | 19 | unary server | gRPC `CreateTrip` handler |
| 04 | 20 | client + test | client/in-process test |
| 05 | 21 | server streaming | `WatchTrip` stream |
| 05 | 22 | interceptor + metadata | logging/auth interceptor |
| 05 | 23 | goroutine + WaitGroup | concurrent enrichment |
| 05 | 24 | errgroup + context | fan-out cancellation |
| 05 | 25 | channel broadcaster | progress broadcaster |
| 05 | 26 | race detector | make and fix one race |
| 05 | 27 | observability | logs + minimal metrics/trace design |
| 05 | 28 | graceful shutdown | HTTP/gRPC/DB shutdown |
| 06 | 29 | open-source reading | four-pass project reading note |
| 06 | 30 | minimal Tool interface | calculator + trip lookup tools |
| 06 | 31 | provider abstraction | fake `Model` interface |
| 06 | 32 | sqlc-backed memory | `agent_runs` / `agent_steps` |
| 06 | 33 | streaming progress | SSE or gRPC progress stream |
| 06 | 34 | integration slice | start run -> tool -> memory -> progress |
| 06 | 35 | hardening | tests + race + shutdown |
| 06 | 36 | final review | retrospective + next 30 days |

## 每日目录：36 张执行卡

这一节是每天真正执行时看的目录。每一天都按同一个格式推进：方向、深入点、具体步骤、产物、验证、检索。不要只读完当天文字；当天没有产物，就不算完成。

### Day 1：module / package / toolchain

方向：从 Node.js 的 `package.json` 心智迁移到 Go 的 `go.mod`、package、可执行入口和内部包边界。

深入点：`module` 是依赖和 import 根路径；`package` 是编译和可见性单元；`cmd/` 放可执行入口；`internal/` 是 Go 编译器强制的导入边界。

具体步骤：初始化 scratch module；创建 `cmd/trip/main.go`；创建 `internal/trip/trip.go`；从 main 调用 trip 包函数；运行一次、测试一次、再改名一个导出/非导出函数观察编译错误。

产物：`go.mod`、`cmd/trip/main.go`、`internal/trip/trip.go`、一个最小 `trip_test.go`。

验证：`go run ./cmd/trip`；`go test ./...`。

检索：不看笔记解释 `module`、`package`、`cmd/`、`internal/` 各自解决什么问题。

### Day 2：value model / struct / zero value

方向：从 TypeScript object/interface 迁移到 Go 的值模型、struct、zero value 和 receiver。

深入点：zero value 不是 `undefined`；struct 是具体内存布局；value receiver 适合不修改状态的方法；pointer receiver 适合修改状态或避免复制；nil 和空值要在业务语义上分清。

具体步骤：定义 `Trip`、`Member`、`TripStatus`；实现 `Trip.IsActive()`、`Trip.Rename(name string)`、`Trip.AddMember(member Member)`；用测试观察 value receiver 和 pointer receiver 的差异；写一个构造函数 `NewTrip`，只负责必要校验，不把所有字段都初始化成“看起来安全”的假值。

产物：domain 类型、receiver 方法、构造函数、receiver tests。

验证：`gofmt -w .`；`go test ./...`。

检索：Go 的 zero value 为什么既是便利，也是建模时必须主动解释的语义？

### Day 3：data structures I: array / slice / capacity / copy

方向：把 JS Array 心智拆开，分别理解 Go array、slice、length、capacity、append 和底层数组共享。

深入点：array 是固定长度值；slice 是对底层数组的视图；`append` 可能复用原数组，也可能分配新数组；子切片会共享底层数据；需要保留输入不变时用 `copy`。

具体步骤：为 Trip itinerary 定义 `Stop` 和 `[]Stop`；实现 `AddStop`、`InsertStop`、`RemoveStop`、`CloneStops`；写测试观察 `len`、`cap`、子切片修改影响原切片、`append` 后是否共享底层数组；补一个“只读返回”测试，证明外部不能意外修改内部 itinerary。

产物：slice-based itinerary helpers、capacity/copy tests、slice aliasing note。

验证：`gofmt -w .`；`go test ./...`。

检索：为什么 Go 里把 slice 暴露给调用方，常常等于把内部可变状态也暴露出去了？

### Day 4：data structures II: map / set / index / string / rune

方向：从 JS Object/Map/Set/string 迁移到 Go map、set 模拟、索引表，以及 string、byte、rune 的边界。

深入点：map 查询有 comma-ok；nil map 可以读但不能写；set 通常用 `map[T]struct{}`；索引表用 map 换取查找效率；Go string 是只读字节序列，按用户可见字符处理时不能只按 byte。

具体步骤：实现 `MemberIndex map[string]Member`；实现 `TagSet map[string]struct{}`；写 `HasMember`、`AddTag`、`RemoveTag`；实现 `FirstRune` 或 `RuneCount`，用中文、emoji、ASCII 测试 byte 长度和 rune 数量差异；用表驱动测试覆盖 missing key、zero value、nil map write guard。

产物：member index、tag set、rune-safe helper、map/string tests。

验证：`gofmt -w .`；`go test ./...`。

检索：为什么 Go 的 `len(string)` 不等于“用户看到的字符数”？

### Day 5：error handling

方向：从 `throw/catch` 迁移到显式 `return value, error`。

深入点：sentinel error 表示可分类错误；`fmt.Errorf("%w")` 保留错误链；`errors.Is` 判断类别；错误消息应该向上补上下文；错误分类会影响 HTTP/gRPC/DB 边界。

具体步骤：定义 `ErrTripNotFound`、`ErrInvalidTrip`；实现 `FindTrip`；对 invalid id 返回带上下文的普通 error；在 service 层包装 store error；写测试证明包装后仍能 `errors.Is`；写一条测试证明错误文字可以变，但错误类别必须稳定。

产物：错误定义、业务函数、错误包装测试、错误分类说明。

验证：`go test ./...`。

检索：什么时候错误需要稳定类别？什么时候只需要上下文？

### Day 6：small interface + context timeout

方向：把 Go 的小接口和 `context.Context` 放在同一天学习，因为它们共同决定 service 边界如何可测、可取消。

深入点：Go interface 通常由使用方定义；接口越小越容易 fake；context 是协作式取消；不要在业务函数内部偷换 `context.Background()`；`defer cancel()` 用来释放 timer 和父子关联资源。

具体步骤：定义 `TripStore`；实现 `Service.GetTrip(ctx, id)`；写 fake store 覆盖 found、not found、invalid id；实现 `SlowStore`，在 `GetTrip` 内用 `select` 等待 `time.After` 或 `ctx.Done()`；写 50ms timeout vs 200ms delay 测试；再写 parent cancel 测试。

产物：`TripStore`、`Service`、fake store tests、timeout-aware store、deadline/cancel tests。

验证：`go test ./...`。

检索：为什么一个接收 `context.Context` 的小接口，比直接依赖完整 `*sql.DB` 更适合早期学习和测试？

### Day 7：HTTP routing

方向：从 Express/Fastify route 迁移到 `net/http` 的 `Handler` / `HandlerFunc`。

深入点：Go handler 是普通函数或接口；router 只是把请求分发到 handler；业务逻辑不放在 handler 里；handler 只负责协议解析、调用 service、写 response。

具体步骤：实现 `GET /healthz`；实现 `GET /trips/{id}`；handler 解析 id 后调用 `TripService`；先用标准库路由，必要时再观察 chi 的 middleware/route group 风格；写最小 handler test，不启动真实端口。

产物：HTTP server、health handler、get trip handler、最小 `httptest`。

验证：`go test ./...`；`curl -i localhost:8080/healthz`。

检索：`http.Handler` 和 `http.HandlerFunc` 为什么可以互相配合？

### Day 8：JSON DTO

方向：从自动 body parser / class-validator 迁移到显式 JSON decode 和 DTO 转换。

深入点：HTTP DTO 不等于 domain；struct tag 是边界协议；`omitempty` 会影响输出语义；unknown field 是否允许要主动决策；DTO 转 domain 时要复用前面学过的 map/slice/string 校验。

具体步骤：定义 `CreateTripRequest`、`TripResponse`；使用 `json.Decoder`；写 `toDomain` / `fromDomain`；增加 `DisallowUnknownFields` 并写测试观察差异；覆盖 tags、members、name 中英文字符的输入。

产物：request DTO、response DTO、转换函数、JSON handler tests。

验证：`go test ./...`。

检索：为什么 Go 里显式 DTO 转换反而能降低长期维护成本？

### Day 9：HTTP error mapping

方向：从 exception filter 迁移到明确的 domain error -> HTTP response 映射。

深入点：domain 层不应该知道 HTTP status；HTTP 层用 `errors.Is` / `errors.As` 做边界转换；500 响应不暴露内部错误细节；context deadline/cancel 要和业务错误区分。

具体步骤：实现 `WriteError`；映射 not found、validation、deadline、unknown；统一 JSON error body；测试被 wrapping 的错误仍映射正确；测试 HTTP response 不泄露内部 DB 或 panic 细节。

产物：error mapper、错误响应结构、映射测试。

验证：`go test ./...`。

检索：为什么错误分类应该稳定，而错误文字可以随上下文变化？

### Day 10：middleware + handler tests

方向：从 Express middleware 和 Jest/Supertest 迁移到 `func(http.Handler) http.Handler` 与标准库 `httptest`。

深入点：middleware 是函数组合；顺序会影响 request id、日志和 panic recovery；handler test 不需要真实端口；table-driven tests 让成功/失败路径并排可见；fake service 比真实 DB 更适合 handler 层。

具体步骤：实现 request id middleware；实现 access log middleware；实现 panic recovery；用 `httptest.NewRequest` 和 `ResponseRecorder` 覆盖 healthz、get trip success、not found、bad id、create trip JSON error；断言 status、body、header 和关键日志字段。

产物：middleware、handler table tests、日志字段规范。

验证：`go test ./...`。

检索：middleware test、handler test、service test 的边界分别是什么？

### Day 11：pgx first contact

方向：从 Prisma/TypeORM client 迁移到显式 pool、query、scan。

深入点：pool 生命周期要显式关闭；每个 DB 调用都接收 context；`Scan` 是类型边界；`no rows` 是 error。

具体步骤：创建 `pgxpool.Pool`；实现 `GetTrip(ctx, id)`；扫描到 domain struct；处理 no rows；写 fake 或测试 DB 版本的 repository test。

产物：DB 初始化、查询函数、no rows 处理。

验证：`go test ./...`。

检索：为什么 `QueryRow().Scan()` 把“不存在”作为 error 返回？

### Day 12：migration

方向：从 ORM migration 迁移到可审查的 up/down SQL 文件。

深入点：migration 是生产变更记录；up/down 都要 review；索引、外键、唯一约束属于业务约束的一部分。

具体步骤：写 `000001_create_trips.up.sql` 和 `.down.sql`；包含 `trips`、`trip_members`、owner/member 关系和必要索引；跑 up/down。

产物：migration 文件、schema 说明。

验证：`migrate up`；`migrate down`。

检索：为什么 migration 不能只靠“能跑起来”，还必须能回滚？

### Day 13：sqlc generate

方向：从 ORM query builder 迁移到 SQL-first code generation。

深入点：SQL 是源头；Go 类型由 SQL 生成；生成代码不写业务语义；query 命名就是 API 设计。

具体步骤：写 `schema.sql`、`query.sql`、`sqlc.yaml`；生成 `CreateTrip`、`GetTrip`、`ListTripMembers`；观察生成类型和 nullable 字段。

产物：sqlc config、queries、generated code。

验证：`sqlc generate`；`go test ./...`。

检索：sqlc 和 ORM 最大的心智差异是什么？

### Day 14：repository wrapper

方向：把 generated queries 包进应用自己的数据边界。

深入点：wrapper 负责适配，不负责复杂业务；service 依赖小接口；不要让 generated type 扩散到所有层。

具体步骤：定义 `Store{q *db.Queries}`；实现 `GetTrip`、`CreateTrip`；转换 generated row 到 domain；写 fake Store 测 service。

产物：Store wrapper、转换函数、service tests。

验证：`go test ./...`。

检索：哪些逻辑应该在 repository wrapper，哪些应该在 service？

### Day 15：transaction boundary

方向：把事务当作 use case 边界，而不是单条 SQL 的细节。

深入点：事务需要明确 begin、rollback、commit；`defer Rollback` 是安全网；commit error 不能忽略。

具体步骤：实现 `CreateTripWithOwner(ctx, input)`；在一个事务里创建 trip 和 owner member；任一步失败 rollback；commit 后不再 rollback。

产物：transaction 方法、rollback tests。

验证：`go test ./...`。

检索：事务边界为什么通常属于 use case/service/store 方法？

### Day 16：DB verification

方向：把 DB 层从“能写”推进到“能证明失败行为正确”。

深入点：测试要覆盖 rollback、unique conflict、context cancel、no rows；DB helper 要让测试可重复。

具体步骤：整理 test DB helper；补 transaction failure test；补 no rows mapping test；写 `phase-03-review.md`。

产物：DB 测试 helper、失败路径测试、阶段复盘。

验证：`go test ./...`。

检索：怎样证明 transaction failure 没有留下半成品数据？

### Day 17：proto contract

方向：从 REST DTO 迁移到 contract-first 的 `.proto`。

深入点：字段编号是 wire contract；字段名可改但编号不能乱复用；`go_package` 决定生成代码 import path。

具体步骤：写 `TripService.CreateTrip`；定义 request/response message；设计字段编号；预留未来字段但不滥用。

产物：`proto/trip/v1/trip.proto`。

验证：proto review。

检索：为什么 proto 字段编号比字段名更敏感？

### Day 18：code generation

方向：理解 `.proto` 如何变成 Go service interface 和 message struct。

深入点：`.pb.go` 是消息类型；`_grpc.pb.go` 是 service/client glue；生成代码不手改。

具体步骤：安装 protoc 插件；生成 Go 文件；查看 generated server interface；把生成命令写入 Makefile 或 README note。

产物：generated code、生成命令记录。

验证：`protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto`；`go test ./...`。

检索：`.pb.go` 和 `_grpc.pb.go` 分别负责什么？

### Day 19：unary server

方向：把 service use case 暴露为 unary RPC。

深入点：gRPC handler 实现 generated interface；domain error 映射为 status code；request/response 与 domain 分离。

具体步骤：实现 `CreateTrip` server；调用 service；映射 invalid/not found/internal；写 server tests。

产物：gRPC server、status mapping tests。

验证：`go test ./...`。

检索：HTTP status 和 gRPC codes 如何对应？为什么不要机械一一映射？

### Day 20：client + test

方向：用 client 侧测试验证 RPC contract 真的可用。

深入点：RPC 测试要覆盖 server 行为和 client 观察到的 code/message；in-process 或本地 listener 都可以。

具体步骤：写 client 调用；启动测试 server；覆盖 success、invalid argument、deadline；断言 response 和 status code。

产物：gRPC client、RPC integration tests。

验证：`go test ./...`。

检索：为什么 gRPC handler 测试需要同时关注 server 和 client 侧行为？

### Day 21：server streaming + context

方向：把 Node.js SSE/Readable stream 心智迁移到 typed server streaming。

深入点：stream 也是 RPC；发送循环必须观察 context；客户端 cancel 后服务端要退出。

具体步骤：定义 `WatchTrip` stream；服务端定时发送 `TripEvent`；客户端读取直到 EOF/cancel；写 cancel test。

产物：streaming RPC、cancel test。

验证：`go test ./...`。

检索：server streaming 和 SSE 最大差异是什么？

### Day 22：interceptor + metadata

方向：把 HTTP middleware 心智迁移到 gRPC interceptor 和 metadata。

深入点：metadata 类似 header 但有 RPC 语义；interceptor 要处理 method、status code、duration、auth。

具体步骤：实现 unary logging interceptor；实现 metadata auth skeleton；认证失败返回 `Unauthenticated`；日志不记录 token 明文。

产物：interceptor、metadata auth tests。

验证：`go test ./...`。

检索：HTTP middleware 和 gRPC interceptor 的相同点、不同点分别是什么？

### Day 23：goroutine + WaitGroup

方向：从 `Promise.all` 迁移到 goroutine + WaitGroup。

深入点：WaitGroup 只等待，不收集 error；共享变量要避免 data race；每个外部调用都接收 context。

具体步骤：实现 `RefreshTripSnapshot`；并发 fake weather/hotel/flight/activity；收集结果；记录错误；证明耗时接近最慢分支。

产物：concurrent enrichment、耗时测试、race clean 测试。

验证：`go test ./...`；`go test -race ./...`。

检索：`wg.Add(1)` 为什么必须在 `go func()` 之前？

### Day 24：errgroup + context

方向：从 `Promise.all` 的失败行为迁移到 `errgroup.WithContext` 的错误收敛。

深入点：第一个错误会取消派生 context；慢任务必须主动观察 `ctx.Done()`；`SetLimit` 是并发保护。

具体步骤：实现 `PlanTrip`；并发 destination/budget/transport/risk agent；设置并发上限 3；关键错误取消其他任务。

产物：fan-out cancellation、并发上限测试。

验证：`go test ./...`；`go test -race ./...`。

检索：WaitGroup 和 errgroup 的职责差异是什么？

### Day 25：channel progress broadcaster

方向：从 EventEmitter 迁移到有所有权规则的 channel broadcaster。

深入点：谁发送谁关闭；慢消费者不能拖死发布者；订阅者生命周期由 context 管。

具体步骤：实现 `Subscribe`、`Publish`、`CloseTrip`；每个 subscriber 有 buffer；慢消费者 drop 或隔离；ctx cancel 后关闭订阅。

产物：progress broadcaster、slow consumer tests。

验证：`go test ./...`；`go test -race ./...`。

检索：“谁发送，谁关闭 channel” 在 broadcaster 中如何落地？

### Day 26：race detector

方向：把 Node.js 中较少遇到的共享内存风险变成 Go 里可检测、可修复的问题。

深入点：race detector 是运行时检测；报告里的 read/write stack 是定位入口；修复方式包括 mutex、channel owner、局部结果合并。

具体步骤：制造 `TripRunState` data race；跑 `go test -race`；保留失败说明；修复为局部结果合并或 mutex；再次跑 race。

产物：race demo note、修复实现。

验证：`go test -race ./...`。

检索：race detector 报告里的 read/write goroutine 栈应该怎么读？

### Day 27：observability

方向：把并发链路变得可解释。

深入点：logs 解释单次事件；metrics 解释总体趋势；trace 解释跨边界耗时；敏感信息不能入日志。

具体步骤：注入 `*slog.Logger`；定义日志字段；用 buffer 测 JSON 日志；设计 `agent_runs_total`、`agent_run_duration_ms`、`progress_dropped_total`；画 span 草图。

产物：structured logs、metrics/trace design、日志测试。

验证：`go test ./...`。

检索：logs、metrics、trace 分别回答什么问题？

### Day 28：graceful shutdown

方向：让 HTTP/gRPC/Agent 进程在 SIGTERM 下可预测退出。

深入点：`Shutdown` 停止接收新请求并等待已有请求；后台 goroutine 要通过 root context 收敛；shutdown timeout 必须可观测。

具体步骤：创建 `signal.NotifyContext`；实现 `/healthz`；触发 planning goroutine；shutdown 时 cancel root context；等待 service `Wait()`。

产物：shutdown path、health check、shutdown tests。

验证：`go test ./...`；`go test -race ./...`。

检索：`Shutdown` 和 `Close` 的区别是什么？

### Day 29：open-source reading pass

方向：从“随便看源码”变成四遍阅读法。

深入点：第一遍看 shape；第二遍追 request path；第三遍看生产性关注点；第四遍复刻 100-300 行。

具体步骤：任选 chi、pgx、sqlc、grpc-go、langchaingo、PocketBase、Ollama；写 shape/request path/production concerns/mini-rebuild idea。

产物：four-pass reading note。

验证：能指出一个可复刻的小模式。

检索：为什么第一遍不应该钻实现细节？

### Day 30：minimal Tool interface

方向：从 LangChain.js tool 迁移到 Go 小接口。

深入点：`Name` 和 `Description` 是给模型看的 contract；`Call` 必须接收 context；tool error 要区分 observation 和 fatal。

具体步骤：定义 `Tool`；实现 calculator tool；实现 trip lookup tool；写 ctx cancel 测试。

产物：Tool interface、两个 tools、tool tests。

验证：`go test ./...`。

检索：`Description()` 为什么是 Agent tool 的业务接口的一部分？

### Day 31：provider abstraction

方向：把真实 LLM provider 隔离到可替换接口后面。

深入点：核心 Agent loop 不依赖真实网络；fake model 用 scripted responses 控制推理路径；provider adapter 是边界层。

具体步骤：定义 `Model`；实现 fake model；让 Agent loop 使用 fake model；覆盖 finish、tool call、model error。

产物：Model interface、fake model、Agent loop tests。

验证：`go test ./...`。

检索：为什么 Agent 测试首先需要 fake model？

### Day 32：sqlc-backed memory

方向：把 Agent memory 从内存 map 变成可查询、可恢复的数据层。

深入点：run 和 step 是不同生命周期；tool call/observation 要持久化；事务保证状态一致。

具体步骤：设计 `agent_runs`、`agent_steps`；生成 queries；实现 repository wrapper；保存每轮 step。

产物：memory schema、queries、repository tests。

验证：`sqlc generate`；`go test ./...`。

检索：Agent memory 为什么不能只放内存 map？

### Day 33：streaming progress

方向：把 Agent 执行过程暴露给客户端，而不是只返回最终答案。

深入点：progress event 要稳定；客户端 cancel 要退出；慢消费者要隔离；事件不包含敏感输入。

具体步骤：实现 SSE 或 gRPC `WatchAgentRun`；复用 broadcaster；发布 started/tool_called/observation/final/error。

产物：progress stream、cancel tests、slow consumer tests。

验证：`go test ./...`。

检索：Agent progress event 应该包含哪些稳定字段？

### Day 34：integration slice

方向：把 HTTP/gRPC、service、memory、tool、progress 串成一条可测链路。

深入点：集成测试只用 fake model/tool；验证边界连接，不依赖真实外部服务。

具体步骤：实现 `POST /agent-runs`；创建 run；调用 fake model；调用 tool；持久化 step；发布 progress；返回 final answer。

产物：end-to-end slice、integration tests。

验证：`go test ./...`。

检索：这个链路里哪些边界最适合用 interface？哪些不需要抽象？

### Day 35：hardening

方向：把 capstone 从 happy path 推到可维护。

深入点：错误、取消、race、shutdown 是生产能力的一部分；日志字段和测试结果要能支撑排障。

具体步骤：补 tool error、model error、memory error、context cancel、shutdown during run；全量 race；补日志字段。

产物：hardening tests、race clean、日志字段表。

验证：`gofmt -w .`；`go test ./...`；`go test -race ./...`。

检索：如果线上 Agent run 卡住，你会先看日志、数据库、还是 goroutine dump？

### Day 36：final review

方向：把 36 天学习转成可复用的工程判断。

深入点：复盘不是流水账，而是抽取 Node.js -> Go 的心智变化、可独立完成的切片和下一阶段风险。

产物：

```markdown
# 36 天 Go 学习复盘

## 我从 Node.js 迁移到 Go 的 5 个关键心智变化
## 我能独立写出的 Go 后端切片
## 我还不稳定的主题
## 我读懂的开源项目模式
## 下一阶段 30 天计划
```

最终验收：全量 `go test ./...` 通过；全量 `go test -race ./...` 通过；能白板解释 HTTP/gRPC -> service -> repository -> transaction -> Agent -> progress -> shutdown；使用评分表完成自评。

## 每日完成定义

当天完成必须同时满足：

- 有代码、测试、proto、migration、阅读笔记或复盘产物。
- 跑过当天验证命令。
- 写下至少一个 retrieval prompt 的答案。
- 能用 Node.js -> Go 对照解释当天主题。

不满足这些条件，只能算“看过”，不能算“学会”。

## 下一阶段 30 天建议

完成 36 天后，不要继续横向加新框架。建议进入第二轮 30 天：

1. 选一个开源项目做更深阅读：PocketBase、Ollama、langchaingo、grpc-go 四选一。
2. 每周复刻一个小切片：路由/middleware、DB transaction、streaming、Agent tool loop。
3. 每周至少一次 `go test -race ./...`。
4. 学会 pprof、benchmark、profiling。
5. 把 final slice 改造成可部署 demo，但仍然不要使用真实业务项目。

## 教程维护 TODO（不计入 36 天学习主线）

这一节是课程维护待办，不是学习者的打卡表。在不改变“30-40 天、以 Node.js 经验迁移到 Go、以学习而非产品开发为中心”的前提下，按优先级补齐课程的可执行性和岗位转入准备度。

- [ ] **P1：补 Day 0.5 运行环境基线。** 在 Day 00 与 Day 01 之间补一份短前置：固定 Go、PostgreSQL、sqlc、protoc、migration CLI 的版本和安装检查；提供练习仓库目录约定、`.env.example`、本地 PostgreSQL 启动方式，以及 `make verify` 或等价的一键验证命令。完成标准：学习者在 Day 11 前能独立跑通数据库、migration、sqlc、proto 生成和 `go test ./...`，不把环境缺失留到 Day 36 再标记“待补”。

- [ ] **P1：让每个每日文件自包含资料入口。** 为 Day 01-36 增加“必读资料”小节：至少给出一份官方或项目一手资料、当天应阅读的具体主题，以及它和实践步骤的关系。完成标准：学习者只打开当天文件时，也能立即知道读什么、做什么、以什么结果判断完成；全局 `RESOURCES.md` 继续作为扩展索引。

- [ ] **P1：为 Day 36 增加独立验收清单。** 在保留现有自评 rubric 的基础上，补充不依赖学习者主观判断的黑盒验收：HTTP/gRPC 成功与错误路径、migration up/down、sqlc/proto 可复现、取消、slow consumer、race、shutdown 和敏感信息检查。完成标准：每项都有输入、预期输出或命令、失败条件和证据位置；它验证学习切片，不把课程变成产品项目。

- [ ] **P2：补一次既有 Go 仓库的维护型练习。** 在 Day 29 或第二阶段增加模拟 issue：从一个真实开源 Go 项目的固定小范围定位调用链、写最小复现或回归测试、提出 100-300 行以内的补丁或 code review 说明。完成标准：学习者能说明改动所在的 package 边界、测试理由和 Go 风格判断，而不要求向外部仓库提交 PR。

- [ ] **P1：把“可交付运行”设为下一阶段必修，并校准课程承诺。** 后续 30 天明确覆盖容器化、配置与密钥注入、CI、`go vet`/静态检查、pprof/benchmark、部署、健康检查和回滚演练。完成标准：36 天的定位是“可进入真实 Go 后端仓库并承担小到中等切片”，完成下一阶段后才宣称具备独立交付、部署和维护一个小型 Go 服务的准备度。
