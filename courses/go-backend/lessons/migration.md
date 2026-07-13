# Day 12：Migration

English title: **Day 12: Migration**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
