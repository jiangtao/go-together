# Day 11：pgx First Contact

English title: **Day 11: pgx First Contact**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
