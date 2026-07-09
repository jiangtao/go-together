# Day 7-12：HTTP 与 Migration

English title: **Days 7-12: HTTP and Migrations**

对应主线：[36 天 Go 教程](../node-to-go-36-day-course.md)；使命背景：[Mission](../../../MISSION.md)。

本切片服务于 Go 学习主线，不是 Trip 产品路线。Trip 只作为贯穿案例，用来把 Node.js 后端开发者已经熟悉的 HTTP、JSON、错误处理、测试、数据库访问和 schema 变更心智迁移到 Go。每天都要写少量可运行代码，代码的目标是证明概念掌握，而不是扩展业务范围。

## 学习方式

每一天按同一节奏推进：先从 Node.js 的已知经验定位问题，再切换到 Go 的核心心智，最后用一个很薄的 Trip 练习切片验证。建议每次只打开当天涉及的文件，先写测试或最小验证，再补实现。

统一约定：

- HTTP 层只做协议工作：解析 request、调用 service、写 response。
- service/domain 层不 import `net/http`，也不关心状态码。
- handler 测试优先使用 fake service；DB 相关测试放到 repository 层。
- migration 是可审查的 SQL 变更记录，不是“启动时自动补表”的便利脚本。
- 路径只是建议，可以按实际练习仓库调整，但要保持边界清楚。

## Day 7：HTTP Routing

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

## Day 8：JSON DTO

### 学习目标

把 Node.js 自动 body parser、class-validator、DTO class 的心智迁移到 Go 显式 `encoding/json` decode、struct tag 和 DTO/domain 转换。当天结束时，你应该能写出 `POST /trips` 的 request DTO、response DTO、转换函数和 JSON handler tests。

当天最小能力：

- 定义 `CreateTripRequest`。
- 定义 `TripResponse`。
- 使用 `json.Decoder` 解码 request body。
- 明确 unknown field 策略。
- 把 DTO 转成 domain/service input，再把 domain 转成 response DTO。

### Node.js 对照

Node.js 里经常这样做：

```ts
app.use(express.json())

class CreateTripDto {
  @IsString()
  name: string
}
```

Go 没有默认帮你做 body parser，也不会自动执行 class decorator。HTTP body 是 stream，decode 是显式动作；struct tag 是 JSON 边界协议；校验和转换是你要主动写出来的代码。

### Go 核心心智

DTO 是协议边界，不是 domain。`json:"name"` 这种 tag 表示外部 JSON contract；domain struct 应该表达业务语义。`omitempty` 不是“少输出一点更干净”，它会改变调用方观察到的语义：空 slice 是 `[]` 还是字段缺失，`0` 是有效值还是未提供，都要主动决定。

关键判断：

- request DTO 面向外部输入，可以使用 pointer 字段区分“未提供”和“提供了零值”。
- response DTO 面向外部输出，字段应该稳定、清晰。
- unknown field 是兼容性策略：开放会更宽松，禁止会更早暴露客户端拼写错误。
- decode 后要检查是否存在 trailing JSON，避免 `{"name":"A"}{"name":"B"}` 被悄悄接受。

### 实践步骤

1. 定义 `CreateTripRequest`，包含 `Name`、可选 `Members`、可选 `Tags`。
2. 定义 `TripResponse`，只暴露 HTTP response 需要的字段。
3. 在 create handler 中使用 `json.NewDecoder(r.Body)`。
4. 调用 `decoder.DisallowUnknownFields()`，先选择严格策略，并写测试证明未知字段会失败。
5. 对 body 大小加一个学习用限制，例如 `http.MaxBytesReader`，避免无限读取。
6. 解码 DTO 后调用 `toCreateTripInput()`，在转换里做 name trim、空值校验、members/tags 规范化。
7. service 返回 domain `Trip` 后，用 `fromTrip()` 转成 `TripResponse`。
8. 写 JSON handler tests：合法 body、malformed JSON、unknown field、缺少 name、中英文 name、空 members/tags。

### 建议文件

- `internal/triphttp/dto.go`：request/response DTO。
- `internal/triphttp/json.go`：`decodeJSON`、`writeJSON` 等边界 helper。
- `internal/triphttp/handlers.go`：`POST /trips` handler。
- `internal/triphttp/dto_test.go`：DTO 转换测试。
- `internal/triphttp/handlers_test.go`：JSON request/response 测试。

### 测试/验证命令

```sh
gofmt -w ./internal/triphttp
go test ./internal/triphttp -run 'Test(CreateTrip|Decode|DTO)'
go test ./...
```

可选手动验证：

```sh
curl -i -X POST http://localhost:8080/trips \
  -H 'content-type: application/json' \
  -d '{"name":"上海 Go 周末","members":[{"name":"jt"}],"tags":["go","backend"]}'
```

### 检索问题

- `json.Decoder` 和 `json.Unmarshal` 在处理 HTTP request body 时有什么差异？
- `DisallowUnknownFields` 解决了什么问题，又可能带来什么 API 演进成本？
- `omitempty` 对 `nil slice`、空 slice、零值数字、空字符串分别有什么影响？

### 常见误区

- 直接把 domain struct 暴露为 HTTP JSON，导致内部字段和外部 contract 绑死。
- 把所有字段都设成 `omitempty`，让客户端无法区分“空值”和“字段不存在”。
- 只测试成功 JSON，不测试 malformed JSON 和 unknown field。
- decode 完第一段 JSON 后不检查尾部内容。
- 在 DTO tag 中随手改字段名，却没有意识到这是外部协议变更。

## Day 9：HTTP Error Mapping

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

## Day 10：Middleware + Handler Tests

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

## Day 11：pgx First Contact

### 学习目标

把 Prisma/TypeORM client 或 Node PostgreSQL pool 的心智迁移到 Go 的 `pgxpool`、显式 query、`Scan` 和 context-aware DB 调用。当天结束时，你应该能创建 `pgxpool.Pool`，实现一个 `GetTrip(ctx, id)` repository 方法，并正确处理 `pgx.ErrNoRows`。

当天最小能力：

- 用 `DATABASE_URL` 创建 `*pgxpool.Pool`。
- 显式关闭 pool。
- 写 `GetTrip(ctx, id)` 查询。
- 把 row scan 到 domain struct 或 repository row type。
- 把 `pgx.ErrNoRows` 映射成 domain `ErrTripNotFound`。

### Node.js 对照

Node.js ORM 里你可能写：

```ts
const trip = await prisma.trip.findUnique({ where: { id } })
if (!trip) throw new NotFoundException()
```

Go + pgx 更接近显式 SQL：

```go
row := pool.QueryRow(ctx, `select id, name from trips where id = $1`, id)
err := row.Scan(&trip.ID, &trip.Name)
```

这里没有自动 model hydration，也没有隐藏 query。SQL、scan 顺序、nullability、context、错误处理都在你面前。

### Go 核心心智

DB pool 是进程级资源，要在入口装配并在 shutdown 时关闭。每次 DB 调用都接收 `context.Context`，让 request timeout/cancel 能传到数据库。`Scan` 是类型边界：SQL column 顺序和 Go 变量必须对齐；nullable column 要用合适类型表达。

关键判断：

- repository 负责 SQL 和 DB error 适配，不负责 HTTP status。
- `pgx.ErrNoRows` 是 DB 边界错误，向上最好转换成 domain 稳定错误类别。
- 早期 handler tests 继续用 fake service；pgx 测试单独放 repository 层。
- 如果没有测试数据库，可以先写转换和 no rows mapping 的单元测试，再补 integration test。

### 实践步骤

1. 添加 pgx 依赖：`github.com/jackc/pgx/v5/pgxpool`。
2. 在入口读取 `DATABASE_URL`，使用 `pgxpool.New(ctx, dsn)` 创建 pool。
3. `defer pool.Close()` 或在 graceful shutdown 中关闭。
4. 定义 `PostgresTripStore struct { pool *pgxpool.Pool }`。
5. 实现 `GetTrip(ctx context.Context, id string) (trip.Trip, error)`。
6. SQL 只查当天需要字段，例如 `id, name, status, created_at`。
7. `row.Scan(...)` 返回 `pgx.ErrNoRows` 时转换为 `trip.ErrTripNotFound`。
8. 给其他 DB error 补上下文：`fmt.Errorf("get trip %s: %w", id, err)`。
9. 写 repository test：如果有 `TEST_DATABASE_URL` 就跑真实 DB；没有则跳过 integration test，并保留 mapping 单元测试。

### 建议文件

- `internal/tripstore/postgres.go`：pgx store 实现。
- `internal/tripstore/postgres_test.go`：repository integration test。
- `internal/tripstore/testdb_test.go`：可选，测试 DB helper。
- `cmd/trip-api/main.go`：pool 装配。
- `internal/trip/service.go`：service 依赖 store 小接口，不依赖 pgx。

### 测试/验证命令

```sh
go get github.com/jackc/pgx/v5/pgxpool
gofmt -w ./cmd ./internal
go test ./internal/tripstore -run TestPostgresTripStore
go test ./...
```

有测试数据库时：

```sh
TEST_DATABASE_URL='postgres://postgres:postgres@localhost:5432/go_together_test?sslmode=disable' \
  go test ./internal/tripstore -run TestPostgresTripStore -count=1
```

手动探测连接时：

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/go_together?sslmode=disable' \
  go run ./cmd/trip-api
```

### 检索问题

- `pgxpool.Pool` 和单个连接 `pgx.Conn` 的使用场景有什么差异？
- 为什么 `QueryRow().Scan()` 把“不存在”作为 error 返回？
- nullable SQL column 在 Go 里有哪些表达方式？
- repository 为什么应该把 `pgx.ErrNoRows` 转换成 domain error？

### 常见误区

- 每个 request 创建一个新 pool，导致连接资源失控。
- 忘记 `pool.Close()`，让测试或进程退出不干净。
- `Scan` 字段顺序和 SQL select 顺序不一致。
- 把 `pgx.ErrNoRows` 直接泄露到 HTTP 层。
- 在 handler 测试里连真实数据库，模糊了测试边界。
- 忽略 context，让请求取消后 DB query 仍继续跑。

## Day 12：Migration

### 学习目标

把 ORM migration 或“应用启动时自动同步 schema”的心智迁移到可审查、可回滚的 SQL migration。当天结束时，你应该能写 `000001_create_trips.up.sql` 和 `000001_create_trips.down.sql`，包含 `trips`、`trip_members`、owner/member 关系和必要索引，并能执行 up/down 验证。

当天最小能力：

- 编写第一组 up/down SQL migration。
- 在 schema 中表达主键、外键、唯一约束、check 约束和索引。
- 能解释每个约束对应的业务不变量。
- 能用 migration 工具或 `psql` 在本地验证 up/down。

### Node.js 对照

Node.js ORM 常见体验是：

```sh
npx prisma migrate dev
```

工具会帮你生成一部分 SQL，但也容易让人忽略实际 DDL。Go 学习阶段建议先直面 SQL 文件：你写什么，数据库就变成什么。migration 不是“让代码能跑起来”的附属物，而是生产变更记录。

### Go 核心心智

Go 服务通常不会把 schema 变更藏在应用启动流程里。migration 是独立、可审查、可重复执行的交付物。`up` 描述如何前进，`down` 描述如何回滚最近一步。约束不是数据库细节，而是业务不变量落地的位置。

本练习可以用 PostgreSQL，第一版 schema 建议保持小而明确：

- `trips` 保存行程主信息。
- `trip_members` 保存成员以及 `owner` / `member` 角色。
- 每个 trip 至少在应用层创建一个 owner；数据库层用 partial unique index 保证每个 trip 最多一个 owner。
- `trip_members.trip_id` 外键引用 `trips.id`，删除 trip 时级联删除成员。

### 实践步骤

1. 创建 migration 目录，例如 `migrations/`。
2. 写 `000001_create_trips.up.sql`。
3. 写 `000001_create_trips.down.sql`，按依赖反向删除对象。
4. 在 up migration 中创建 `trips` 表。
5. 在 up migration 中创建 `trip_members` 表，包含 `role` check 约束。
6. 添加 `trip_members(trip_id)` 普通索引，服务按 trip 查询成员。
7. 添加 partial unique index，保证每个 trip 最多一个 owner。
8. 本地执行 up，使用 `psql` 或 migration 工具查看表结构。
9. 本地执行 down，再确认表被移除。
10. 重新执行 up，确保 migration 可以从空库重复应用。

示例 DDL 方向：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE TABLE trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_members_role_check CHECK (role IN ('owner', 'member'))
);

CREATE INDEX trip_members_trip_id_idx ON trip_members(trip_id);
CREATE UNIQUE INDEX trip_members_one_owner_per_trip_idx
  ON trip_members(trip_id)
  WHERE role = 'owner';
CREATE UNIQUE INDEX trip_members_unique_email_per_trip_idx
  ON trip_members(trip_id, lower(member_email));
```

down migration 方向：

```sql
DROP TABLE IF EXISTS trip_members;
DROP TABLE IF EXISTS trips;
```

不要在 down 里随手 `DROP EXTENSION pgcrypto`，因为扩展可能被同一个数据库里的其他 schema 对象使用。

### 建议文件

- `migrations/000001_create_trips.up.sql`：创建 schema。
- `migrations/000001_create_trips.down.sql`：回滚 schema。
- `docs/go-learning/notes/day-12-schema-note.md`：可选学习笔记，记录每个约束的理由；如果当前任务限制只写课程文档，就只在当天练习环境中创建。
- `internal/tripstore/postgres_test.go`：后续结合 Day 11 查询验证 schema。

### 测试/验证命令

使用 golang-migrate 风格命令：

```sh
migrate -path migrations \
  -database "$DATABASE_URL" \
  up

psql "$DATABASE_URL" -c '\d trips'
psql "$DATABASE_URL" -c '\d trip_members'

migrate -path migrations \
  -database "$DATABASE_URL" \
  down 1
```

如果暂时没有 migration CLI，可以用 `psql` 做本地学习验证：

```sh
psql "$DATABASE_URL" -f migrations/000001_create_trips.up.sql
psql "$DATABASE_URL" -c '\d trips'
psql "$DATABASE_URL" -f migrations/000001_create_trips.down.sql
```

结合 Go 测试：

```sh
TEST_DATABASE_URL="$DATABASE_URL" go test ./internal/tripstore -count=1
```

### 检索问题

- 为什么 migration 不能只靠“能跑起来”，还必须能回滚？
- 外键、唯一索引、check 约束分别适合表达哪类不变量？
- partial unique index 如何表达“每个 trip 最多一个 owner”？
- 为什么应用启动时自动修改 schema 在生产环境里风险很高？

### 常见误区

- 只写 up 不写 down，导致无法演练回滚。
- 把所有字段都做成 nullable，然后把完整性全交给应用层。
- 忘记为外键查询列建索引，后续查询成员时性能不可预测。
- down migration 删除顺序错误，先删被引用表导致失败。
- 在同一 migration 里混入太多无关变更，review 和回滚都困难。
- 把 migration 当成 Go 代码生成的副产品，而不是需要审查的数据库 contract。

## Day 7-12 阶段验收

完成这 6 天后，应能从白板解释这条链路：

HTTP route -> JSON DTO -> handler -> service -> error mapping -> middleware -> pgx repository -> migration schema

最小验证组合：

```sh
gofmt -w ./cmd ./internal
go test ./...
TEST_DATABASE_URL="$DATABASE_URL" go test ./internal/tripstore -count=1
migrate -path migrations -database "$DATABASE_URL" up
migrate -path migrations -database "$DATABASE_URL" down 1
```

如果某条命令暂时无法运行，要记录具体原因，例如：还没有 PostgreSQL、还没有 migration CLI、还没有实现 `cmd/trip-api`。不要用“以后再说”替代验证结论。
