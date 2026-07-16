# Day 14：repository wrapper

English title: **Day 14: repository wrapper**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
