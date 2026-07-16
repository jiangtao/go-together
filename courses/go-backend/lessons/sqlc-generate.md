# Day 13：sqlc generate

English title: **Day 13: sqlc generate**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
