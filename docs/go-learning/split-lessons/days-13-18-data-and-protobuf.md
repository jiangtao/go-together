# Day 13-18：数据层与 Protobuf

English title: **Days 13-18: Data Layer and Protobuf**

本切片服务于 [MISSION](../../../MISSION.md)：把已有 Node.js + SQL 后端经验迁移到 Go 的生产级后端心智。课程仍然是学习主线，不是 Trip 产品路线；Trip 只是贯穿案例，用来证明你已经理解 sqlc、repository、transaction、DB verification、proto contract 和 code generation 这些边界。

## 本切片学习主线

这 6 天把前面已经完成的 HTTP、JSON、错误映射、migration，继续推进到两个关键边界：

- 数据边界：从手写 `pgx` 查询迁移到 SQL-first 的 `sqlc` 生成代码，再用 repository wrapper 把生成代码收束在应用内部。
- 协议边界：从 REST DTO 迁移到 contract-first 的 `.proto`，再生成 Go message、client、server interface。

每天都要写实际代码并运行验证命令。不要为了“做完整 Trip 系统”扩大范围；当天产物只需要证明当天概念。

## Day 13：sqlc generate

English title: **SQL-first Code Generation with sqlc**

### 学习目标

掌握 sqlc 的基本工作流：用 schema 和 query 作为源头，生成类型安全的 Go 查询代码。今天结束时，你应该能解释 `sqlc.yaml`、`schema.sql`、`query.sql`、生成 package 之间的关系，并能跑通 `CreateTrip`、`GetTrip`、`ListTripMembers` 的代码生成。

### Node.js 对照

在 Node.js 里，你可能习惯 Prisma、TypeORM、Knex 或手写 SQL：

- Prisma / TypeORM：模型或 decorator 往往是中心，SQL 由工具隐藏或间接生成。
- Knex：query builder 是中心，SQL 由链式 API 组合出来。
- sqlc：SQL 是中心，Go 类型和方法由 SQL 静态生成。

心智迁移重点：sqlc 不是 ORM。它不替你设计关系、不追踪 entity lifecycle、不做 lazy loading；它只把你明确写出的 SQL 转成可编译、可测试、可 review 的 Go API。

### Go 核心心智

sqlc 的核心价值是把数据库边界提前到编译期：

- query 名称就是生成方法名，所以 SQL 注释里的 `-- name:` 是应用 API 设计的一部分。
- SQL 参数和返回列决定 Go 参数类型、row struct、nullable 类型。
- 生成代码不写业务语义；它只表达“这条 SQL 能用什么参数，返回什么形状”。
- schema、queries、generated code 三者要同版本演进，不要手改 generated files。

### 实践步骤

1. 在 migration 的 schema 基础上整理 sqlc 可读取的 schema 文件。
2. 写最小 `sqlc.yaml`，明确 engine、schema、queries、gen go package 和输出目录。
3. 写 `CreateTrip` 查询，返回新建 trip 的基础字段。
4. 写 `GetTrip` 查询，按 id 返回单个 trip。
5. 写 `ListTripMembers` 查询，按 trip id 返回 owner/member 列表。
6. 运行 `sqlc generate`，观察生成的 `Queries`、参数 struct、row struct、nullable 字段类型。
7. 写一个只依赖生成代码可编译的最小测试，先不把业务 wrapper 混进来。

示例 SQL 命名风格：

```sql
-- name: CreateTrip :one
INSERT INTO trips (name, status)
VALUES ($1, $2)
RETURNING id, name, status, created_at, updated_at;

-- name: GetTrip :one
SELECT id, name, status, created_at, updated_at
FROM trips
WHERE id = $1;

-- name: ListTripMembers :many
SELECT id, trip_id, user_id, role, created_at
FROM trip_members
WHERE trip_id = $1
ORDER BY created_at ASC;
```

### 建议文件

- `db/schema.sql`：给 sqlc 使用的 schema 输入，可以先从 migration up SQL 复制并保持同步。
- `db/query/trips.sql`：Trip 相关 query。
- `sqlc.yaml`：sqlc 配置。
- `internal/db/`：生成代码输出目录。
- `internal/db/sqlc_compile_test.go`：只验证生成 package 能被 Go 测试编译。

### 测试/验证命令

```bash
sqlc generate
go test ./...
```

如果本机还没有 sqlc：

```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
sqlc version
```

### 检索问题

- sqlc 和 ORM 最大的心智差异是什么？
- 为什么 `-- name: CreateTrip :one` 里的名字和 cardinality 都属于 API 设计？
- nullable SQL column 到 Go 类型时，为什么不能只凭“业务上应该有值”来忽略 null？
- 生成代码应该被业务层直接到处调用，还是被包在应用自己的边界后面？

### 常见误区

- 把 sqlc 当 ORM 使用，期待它自动处理 relation、cascade、entity state。
- 在 generated code 里手动补业务逻辑，下一次生成会被覆盖。
- query 命名随手写，导致生成 API 难读、难测、难维护。
- schema 和 migration 分叉，最后测试通过但真实 DB 结构不一致。
- 忽视 nullable 字段，导致扫描类型和业务语义错位。

## Day 14：repository wrapper

English title: **Repository Wrapper around Generated Queries**

### 学习目标

把 sqlc 生成的 `*db.Queries` 包进应用自己的 repository boundary，避免 generated types 扩散到 handler、service、domain。今天结束时，你应该能实现 `Store` wrapper，完成 generated row 到 domain model 的转换，并用 service test 证明上层只依赖小接口。

### Node.js 对照

Node.js 里常见的数据访问方式有：

- service 直接调用 Prisma client。
- repository 包一层 ORM client。
- DAO 返回 raw row，再由 service 组装业务对象。

Go 里的 wrapper 更强调“边界收束”：sqlc 生成代码已经足够类型安全，但它仍然是 DB 技术细节。service 最好依赖自己需要的小接口，而不是依赖完整 generated package。

### Go 核心心智

repository wrapper 不是把 ORM 模式照搬到 Go，而是做三件事：

- 隔离 generated type，避免 handler/service 到处 import `internal/db`。
- 转换 DB row 到 domain struct，并稳定错误类别，比如把 no rows 映射成 `ErrTripNotFound`。
- 给事务和测试留下统一入口，让 service 依赖小接口。

wrapper 不应该承载复杂 use case 编排。跨多个 repository、需要事务一致性的动作，应该进入明确的 service/use case/store 方法，而不是散落在多个 handler 里。

### 实践步骤

1. 定义 `Store`，内部持有 `*db.Queries`，必要时也持有 `*pgxpool.Pool` 供后续事务使用。
2. 定义构造函数 `NewStore(pool *pgxpool.Pool) *Store`。
3. 实现 `GetTrip(ctx, id)`，调用 generated `GetTrip`，把 row 转成 domain `Trip`。
4. 实现 `CreateTrip(ctx, input)`，调用 generated `CreateTrip`，返回 domain `Trip`。
5. 编写 `toDomainTrip` / `fromCreateTripInput` 这类小转换函数。
6. 在 service 层定义最小接口，例如只包含 `GetTrip` 和 `CreateTrip`。
7. 用 fake repository 测 service，证明 service 不需要真实 DB 或 sqlc generated types。

示例结构：

```go
type Store struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{
		pool: pool,
		q:    db.New(pool),
	}
}
```

### 建议文件

- `internal/trip/store.go`：repository wrapper 主体。
- `internal/trip/store_mapping.go`：generated row 到 domain 的转换。
- `internal/trip/service.go`：service 依赖的小接口。
- `internal/trip/service_test.go`：使用 fake store 的 service tests。
- `internal/db/`：继续保留 sqlc generated package，不在业务层外扩散。

### 测试/验证命令

```bash
gofmt -w internal/trip
go test ./...
```

如果已有测试 DB，也可以只跑数据层相关测试：

```bash
go test ./internal/trip -run 'TestStore|TestService'
```

### 检索问题

- 哪些逻辑应该在 repository wrapper，哪些应该在 service？
- 为什么 service 依赖小接口比依赖 `*db.Queries` 更适合测试？
- generated row、domain model、HTTP DTO 三者为什么不应该合成一个 struct？
- no rows 应该在 generated 层、wrapper 层还是 handler 层变成业务错误？

### 常见误区

- 为了“少写转换代码”，让 generated type 一路传到 handler。
- 在 repository wrapper 里塞入大量业务流程，导致 service 变成空壳。
- wrapper 返回底层 `pgx.ErrNoRows`，让 HTTP/gRPC 层被迫理解 DB driver。
- fake store 和真实 store 方法签名不一致，测试没有约束真实边界。
- 过早抽象成泛型 repository，反而遮住具体 SQL 的学习价值。

## Day 15：transaction boundary

English title: **Transaction Boundary as a Use Case Boundary**

### 学习目标

把事务理解成 use case 的一致性边界，而不是某条 SQL 的附属细节。今天结束时，你应该能实现 `CreateTripWithOwner(ctx, input)`：在一个事务里创建 trip，再创建 owner member；任一步失败都 rollback；commit error 不被忽略。

### Node.js 对照

Node.js 里常见写法可能是：

- Prisma `$transaction(async tx => { ... })`
- TypeORM `manager.transaction(...)`
- Knex `trx`

这些 API 往往把 begin、commit、rollback 包装成 callback。Go 里你通常更显式地看到事务生命周期：`Begin`、`defer Rollback`、`Commit`。显式不是繁琐，而是让取消、错误包装、commit failure 都在代码里可见。

### Go 核心心智

事务边界要回答三个问题：

- 哪些写入必须一起成功或一起失败？
- 谁负责开启事务，谁负责 commit/rollback？
- 事务内使用的是 tx-bound queries，还是不小心又用回 pool-bound queries？

sqlc 通常会生成 `WithTx(tx)` 方法，让同一组 queries 绑定到事务上。`defer tx.Rollback(ctx)` 是安全网；如果已经 commit，rollback 会返回已完成事务的错误，通常可以忽略。但 `Commit` 自己的错误不能忽略。

### 实践步骤

1. 为 `trip_members` 补 `CreateTripMember` query，生成代码。
2. 在 `Store` 上实现 `CreateTripWithOwner(ctx, input)`。
3. 方法开始时 `Begin(ctx)`，得到 `tx`。
4. 用 `qtx := s.q.WithTx(tx)` 保证事务内 SQL 都走同一个 tx。
5. 先创建 trip，再创建 owner member。
6. 任一步失败时返回包装后的错误，并依赖 `defer Rollback` 清理。
7. 所有步骤成功后调用 `Commit(ctx)`；commit 失败也要返回错误。
8. 写测试制造第二步失败，验证 trip 没有残留。

示例控制流：

```go
tx, err := s.pool.Begin(ctx)
if err != nil {
	return Trip{}, fmt.Errorf("begin create trip with owner: %w", err)
}
defer tx.Rollback(ctx)

qtx := s.q.WithTx(tx)

trip, err := qtx.CreateTrip(ctx, db.CreateTripParams{/* ... */})
if err != nil {
	return Trip{}, fmt.Errorf("create trip: %w", err)
}

if _, err := qtx.CreateTripMember(ctx, db.CreateTripMemberParams{/* ... */}); err != nil {
	return Trip{}, fmt.Errorf("create owner member: %w", err)
}

if err := tx.Commit(ctx); err != nil {
	return Trip{}, fmt.Errorf("commit create trip with owner: %w", err)
}
```

### 建议文件

- `db/query/trips.sql`：新增 `CreateTripMember` 或相关 member query。
- `internal/trip/store.go`：新增 transaction 方法。
- `internal/trip/store_transaction_test.go`：覆盖 success、owner insert failure、commit/begin error 可观察路径。
- `internal/trip/errors.go`：必要时整理稳定错误类别。

### 测试/验证命令

```bash
sqlc generate
gofmt -w internal/trip internal/db
go test ./...
```

如果测试依赖真实 PostgreSQL：

```bash
DATABASE_URL='postgres://postgres:postgres@localhost:5432/go_together_test?sslmode=disable' go test ./internal/trip -run TestStoreCreateTripWithOwner
```

### 检索问题

- 事务边界为什么通常属于 use case/service/store 方法，而不是单条 SQL？
- `defer Rollback` 为什么是安全网，不是失败逻辑的全部？
- 为什么事务内必须使用 `WithTx(tx)` 绑定后的 queries？
- commit error 发生时，调用方还能假设数据已经成功写入吗？

### 常见误区

- Begin 了事务，却在事务内继续调用 pool-bound `s.q`，导致部分 SQL 不在 tx 里。
- 只在显式错误分支 rollback，遗漏 panic、早返回或新增分支。
- 忽略 commit error，把“执行到最后一行”当成“事务已成功”。
- 把过大的流程塞进一个事务，导致锁时间和失败面扩大。
- 测试只覆盖成功路径，没有证明失败时没有半成品数据。

## Day 16：DB verification

English title: **Proving Database Failure Behavior**

### 学习目标

把 DB 层从“代码能写”推进到“失败行为能证明”。今天结束时，你应该有可重复的测试 DB helper，并覆盖 rollback、unique conflict、context cancel、no rows mapping 等关键失败路径。

### Node.js 对照

Node.js 项目里常见 DB 测试会依赖 Jest setup、testcontainers、事务包裹测试或 truncate helper。Go 也需要同样的可重复性，但 Go 测试更强调：

- 每个测试显式接收 `context.Context`。
- helper 返回 cleanup，调用方 `defer cleanup()`。
- 测试数据尽量局部、可并行时才并行。
- driver error 在 repository 边界转换成稳定业务错误。

### Go 核心心智

DB verification 不是为了测数据库本身，而是证明你的应用边界在失败时保持正确：

- rollback 后没有半成品数据。
- unique constraint 被识别并转换成可处理的错误类别。
- context cancel/deadline 能中断 DB 调用并向上传递。
- no rows 不等于 unknown internal error。
- 测试 helper 让每次运行从干净状态开始。

### 实践步骤

1. 整理 `testDB(t)` helper：读取 `DATABASE_URL`，连接 pool，跑 migration 或确认 schema 已存在。
2. 为每个测试提供 `cleanup`，可选择 truncate tables 或每测一个唯一 namespace。
3. 补 `CreateTripWithOwner` 成功测试，断言 trip 和 owner 都存在。
4. 补 owner 插入失败测试，断言 trip 不存在或 member 不存在，证明 rollback。
5. 补 unique conflict 测试，观察 pgx/pgconn error，并在 wrapper 层映射为稳定错误。
6. 补 no rows mapping 测试，证明底层 no rows 最终变成 `ErrTripNotFound`。
7. 补 context cancel/deadline 测试，至少证明取消后的错误不会被误报为 not found。
8. 写短小阶段复盘，记录哪些失败路径已经被验证，哪些需要后续阶段再补。

### 建议文件

- `internal/trip/store_test.go`：真实 DB repository tests。
- `internal/trip/testdb_test.go`：测试 DB helper。
- `internal/trip/store_transaction_test.go`：rollback/failure tests。
- `internal/trip/errors.go`：DB error 到业务错误的映射。
- `docs/go-learning/phase-03-review.md`：仅当主会话允许新增复盘文件时再创建；本切片任务不要擅自新增。

### 测试/验证命令

```bash
go test ./internal/trip -count=1
go test ./...
```

带真实测试 DB：

```bash
DATABASE_URL='postgres://postgres:postgres@localhost:5432/go_together_test?sslmode=disable' go test ./internal/trip -count=1
```

如果暂时没有本地 PostgreSQL，至少运行：

```bash
go test ./... -run TestService
```

并在学习记录里明确：真实 DB failure verification 尚未完成，不能假装通过。

### 检索问题

- 怎样证明 transaction failure 没有留下半成品数据？
- no rows、unique conflict、context deadline 三类错误为什么不能都映射成 500？
- DB test helper 应该隐藏哪些重复细节，又不应该隐藏哪些行为？
- 什么时候应该用真实 DB 测试，什么时候 fake repository 更合适？

### 常见误区

- 只跑 service fake tests，就认为数据库事务也被验证了。
- 测试依赖本地残留数据，换一台机器就失败。
- 为了让测试通过，吞掉 driver error 或把所有错误都包成 internal。
- 在 context cancel 后继续执行后续写入。
- 把“没有报错”当成 rollback 证明，却没有查询数据库确认残留状态。

## Day 17：proto contract

English title: **Contract-first Protobuf Design**

### 学习目标

从 REST DTO 心智迁移到 contract-first 的 `.proto` 设计。今天结束时，你应该能写出 `TripService.CreateTrip` 的 proto contract，理解 field number、message、service、`go_package` 的稳定性，并能做一次人工 proto review。

### Node.js 对照

在 Node.js REST API 中，contract 常散落在：

- OpenAPI spec。
- TypeScript DTO。
- runtime validator schema。
- controller 输入输出样例。

Protobuf 把 contract 放在 `.proto` 文件里：字段编号决定 wire compatibility，service 定义决定 RPC 形状，生成代码只是 contract 的语言投影。你不是先写 handler 再补类型，而是先稳定协议，再生成 Go 边界。

### Go 核心心智

proto contract 的关键不是“字段写全”，而是“兼容性可演进”：

- field number 是 wire contract，比字段名更敏感。
- 已删除字段要 reserved，不能随意复用编号。
- `go_package` 决定生成代码 import path，必须和 module/package 规划一致。
- proto message 不是 domain model；它是跨进程协议 DTO。
- request/response 要围绕 RPC 用例设计，不要直接暴露 DB row。

### 实践步骤

1. 创建 `proto/trip/v1/trip.proto`。
2. 声明 `syntax = "proto3";`、`package trip.v1;`。
3. 设置 `option go_package`，指向当前 Go module 下的生成包路径。
4. 定义 `TripService`，先只放 `rpc CreateTrip(CreateTripRequest) returns (CreateTripResponse);`。
5. 定义 `CreateTripRequest`，包含 name、owner_user_id、可选 members/tags 等最小字段。
6. 定义 `CreateTripResponse`，返回 trip message 或明确的 id/name/status。
7. 定义 `Trip` message，字段编号从稳定核心字段开始。
8. 人工 review：字段编号是否稳定、命名是否清楚、是否泄露 DB/internal 字段、是否为未来删除预留 reserved 策略。

示例骨架：

```proto
syntax = "proto3";

package trip.v1;

option go_package = "github.com/your/module/proto/trip/v1;tripv1";

service TripService {
  rpc CreateTrip(CreateTripRequest) returns (CreateTripResponse);
}

message CreateTripRequest {
  string name = 1;
  string owner_user_id = 2;
}

message CreateTripResponse {
  Trip trip = 1;
}

message Trip {
  string id = 1;
  string name = 2;
  string status = 3;
}
```

### 建议文件

- `proto/trip/v1/trip.proto`：proto contract。
- `docs/go-learning/proto-review-note.md`：仅在主会话允许新增学习笔记时再创建；本切片任务不要擅自新增。
- `internal/trip/service.go`：后续 gRPC handler 将调用的 use case 边界，今天只作为 contract review 参照。

### 测试/验证命令

今天的核心验证是 proto review。若本机已安装 protoc 和插件，也可以先跑格式/生成预检：

```bash
protoc --version
protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto
```

如果还没有安装插件，不要跳过 review，先用文本检查：

```bash
grep -nE 'syntax|package|go_package|service|rpc|message|= [0-9]+' proto/trip/v1/trip.proto
```

### 检索问题

- 为什么 proto 字段编号比字段名更敏感？
- `go_package` 和 proto `package` 分别解决什么问题？
- 为什么 proto message 不应该直接等同于 domain struct 或 DB row？
- 什么时候应该新增字段，什么时候应该 reserved 旧字段？

### 常见误区

- 随意重排或复用 field number，破坏 wire compatibility。
- 让 proto 暴露数据库内部字段，比如自增主键策略、审计列细节。
- 把 REST DTO 原样搬进 proto，没有重新思考 RPC 语义。
- `go_package` 写错，导致生成代码 import path 混乱。
- 为未来想象加入大量字段，增加 contract 负担。

## Day 18：code generation

English title: **Generating Go Code from Protobuf**

### 学习目标

理解 `.proto` 如何生成 Go message struct、client、server interface。今天结束时，你应该能安装或确认 `protoc-gen-go`、`protoc-gen-go-grpc`，生成 `.pb.go` 与 `_grpc.pb.go`，并能指出哪些代码可以读、哪些代码不能手改。

### Node.js 对照

Node.js 里 gRPC/protobuf 可能使用动态加载 `.proto`，也可能生成 TypeScript 类型。Go 社区更常见的是生成静态 Go 代码：

- `.pb.go`：message、enum、字段访问方法、序列化相关 glue。
- `_grpc.pb.go`：client interface、server interface、registration glue。

心智迁移重点：生成代码是 contract 的编译产物。你读它来理解边界，但业务逻辑写在自己的 server/service 里。

### Go 核心心智

code generation 不是一次性脚本，而是工程约定：

- 生成命令要可重复，写进 Makefile、README note 或脚本。
- 生成目录要稳定，避免 import path 随机器变化。
- generated files 不手改；修改 `.proto` 后重新生成。
- 生成出的 server interface 决定 Day 19 unary server 要实现哪些方法。
- `go test ./...` 要能编译 generated package，证明 module/import 配置正确。

### 实践步骤

1. 确认 `protoc` 已安装：`protoc --version`。
2. 安装 Go 插件：`protoc-gen-go` 和 `protoc-gen-go-grpc`。
3. 确认 `$GOBIN` 或 `$GOPATH/bin` 在 `PATH` 中。
4. 运行生成命令，生成 `.pb.go` 和 `_grpc.pb.go`。
5. 打开生成文件，只观察 message struct、`TripServiceClient`、`TripServiceServer`、`RegisterTripServiceServer`。
6. 把生成命令记录到 `Makefile` 或 README note，确保之后任何人能重复生成。
7. 跑 `go test ./...`，验证生成代码 import path 和依赖正确。

推荐命令：

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
```

### 建议文件

- `proto/trip/v1/trip.pb.go`：message 生成代码。
- `proto/trip/v1/trip_grpc.pb.go`：gRPC client/server 生成代码。
- `Makefile`：记录 `proto` 或 `generate` 目标；本切片任务不要求你现在新增。
- `README.md` 或课程笔记：记录生成命令；本切片任务不要求你现在新增。

### 测试/验证命令

```bash
protoc --version
protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto
go test ./...
```

推荐使用 source-relative，避免生成路径意外漂移：

```bash
protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
go test ./...
```

### 检索问题

- `.pb.go` 和 `_grpc.pb.go` 分别负责什么？
- 为什么 generated code 不应该手改？
- `paths=source_relative` 会怎样影响生成文件位置？
- Day 19 实现 unary server 时，应该实现哪个生成 interface？

### 常见误区

- 只生成 `.pb.go`，忘记生成 `_grpc.pb.go`，导致没有 server/client interface。
- 手改 generated file 修 bug，下一次生成全部丢失。
- 生成命令只存在 shell history，后续无法复现。
- `go_package`、生成路径、module path 不一致，造成 import 混乱。
- 生成成功后不跑 `go test ./...`，直到后续实现 server 才发现编译问题。

## Day 13-18 阶段验收

完成本切片后，你应该能不看笔记回答：

- sqlc 为什么是 SQL-first，而不是 ORM？
- repository wrapper 的边界是什么，为什么不让 generated type 扩散？
- 事务失败时，如何用测试证明没有半成品数据？
- no rows、unique conflict、context cancel 分别应该怎样进入业务错误体系？
- proto field number、`package`、`go_package` 各自影响什么？
- `.pb.go` 和 `_grpc.pb.go` 如何为 Day 19 的 unary server 铺路？

阶段最小验证：

```bash
sqlc generate
protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
go test ./...
```
