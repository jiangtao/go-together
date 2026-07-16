# Day 32：sqlc-backed memory

English title: **Day 32: sqlc-backed memory**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 Agent memory 从内存 map 推进到可查询、可恢复、可验证的数据层。今天的重点是用 migration + sqlc + repository wrapper 持久化 `agent_runs` 和 `agent_steps`，并用事务保证 run 状态和 step 写入一致。

### Node.js 对照

在 Node.js 中，你可能会先用内存数组、Redis 或 ORM model 记录 run/step。Go 课程里要刻意练习 SQL-first：schema 和 query 是源头，sqlc 生成类型安全代码，应用自己的 repository wrapper 负责把 generated type 转成 domain type。

### Go 核心心智

- `agent_runs` 和 `agent_steps` 是不同生命周期：run 表达一次执行，step 表达执行中的模型输出、tool call、observation、final/error。
- SQL 约束是业务不变量的一部分，例如 run status 枚举、step sequence 唯一性、外键级联或限制。
- sqlc generated code 不写业务语义；业务边界放在 wrapper 或 service。
- 事务要覆盖“创建 run + 第一条 step”或“追加 step + 更新 run status”这类一致性操作。
- memory 不是聊天记录大杂烩，敏感输入、token、完整隐私文本要有最小化策略。

### 实践步骤

1. 写 migration：`agent_runs` 包含 `id`、`trip_id`、`status`、`started_at`、`finished_at`、`final_answer`、`error_message`；`agent_steps` 包含 `run_id`、`seq`、`kind`、`tool_name`、`input_json`、`output_json`、`error_message`、`created_at`。
2. 为 `agent_steps` 增加 `(run_id, seq)` 唯一约束，保证事件顺序可恢复。
3. 写 sqlc queries：`CreateAgentRun`、`GetAgentRun`、`UpdateAgentRunStatus`、`AppendAgentStep`、`ListAgentSteps`。
4. 运行 `sqlc generate`，观察 nullable 字段在 Go 里生成为什么类型。
5. 写 `MemoryStore` wrapper，隐藏 generated package 的 row type，向上返回课程内 `AgentRun` / `AgentStep`。
6. 实现事务方法：`StartRunWithStep(ctx, input)` 和 `FinishRunWithStep(ctx, input)`。
7. 写 repository tests：创建 run、追加 steps、按 seq 读取、事务失败 rollback、context cancel。

### 建议文件

- `db/migrations/00000x_create_agent_memory.up.sql`
- `db/migrations/00000x_create_agent_memory.down.sql`
- `internal/db/query/agent_memory.sql`
- `internal/memory/store.go`
- `internal/memory/tx.go`
- `internal/memory/store_test.go`

### 测试/验证命令

```bash
migrate up
sqlc generate
go test ./internal/memory
go test ./...
```

如果本地没有测试数据库，先把 migration 和 query 作为静态产物完成，并在测试说明中写明 DB 环境缺失；但 repository 行为最终要用真实 DB 或可重复的 test DB 验证。

### 检索问题

- Agent memory 为什么不能只放在内存 map 里？
- `agent_runs` 和 `agent_steps` 为什么不应该合成一张大表？
- sqlc generated type 什么时候可以留在 repository 内部，什么时候需要转成 domain type？
- 怎样证明“追加 step 失败时，run status 没有被错误更新”？

### 常见误区

- 只保存 final answer，不保存 tool call 和 observation，导致无法复盘 Agent 行为。
- 把完整 prompt、token、隐私输入无差别落库。
- 让 service 层到处依赖 sqlc generated row，破坏分层边界。
- 忽略 `commit` error，或者以为 `defer Rollback` 会替代显式错误处理。
- 用 created_at 排序代替 `seq`，让并发或时间精度问题影响 step 顺序。
