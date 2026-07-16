# Day 16：DB verification

English title: **Day 16: DB verification**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
