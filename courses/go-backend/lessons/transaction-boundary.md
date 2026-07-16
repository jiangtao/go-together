# Day 15：transaction boundary

English title: **Day 15: transaction boundary**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
