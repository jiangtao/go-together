# Day 27：observability

English title: **Day 27: observability**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Structured logs, minimal metrics, trace thinking**

### 学习目标

- 能给 Agent run / Trip planning 的关键路径加入结构化日志。
- 能区分 logs、metrics、trace 分别回答什么问题。
- 能为 progress broadcaster 和 tool call 设计最小可观测字段，并避免记录敏感信息。

### Node.js 对照

Node.js 后端常见组合是 `pino`/`winston` 日志、Prometheus metrics、OpenTelemetry trace。Go 的标准库已经有 `log/slog`，适合先练结构化日志；metrics 和 trace 本日不强行引入完整平台，而是先设计命名、字段和边界。

本日迁移重点：从 “console.log 调试某次请求” 转成 “结构化事件能解释单次失败，指标能解释整体趋势，trace 能解释跨边界耗时”。

### Go 核心心智

- `slog.Logger` 应该作为依赖注入到 service/agent，而不是在深层代码里创建全局 logger。
- 日志字段要稳定：`run_id`、`trip_id`、`step`、`tool`、`duration_ms`、`error_kind` 比自由文本更可查询。
- logs 回答“这一次发生了什么”；metrics 回答“一段时间内发生了多少、多久、失败率多少”；trace 回答“时间花在哪些跨边界调用上”。
- context 可以携带 request/run 级关联信息，但不要把大量业务对象塞进 context。
- token、authorization header、用户隐私和完整 prompt 默认不能进入日志。

### 实践步骤

1. 为 Agent run 或 progress broadcaster 注入 `*slog.Logger`，没有传入时使用 `slog.New(slog.NewTextHandler(io.Discard, nil))` 或测试 logger。
2. 在 run start、tool call start/end、progress dropped、run finish/error 四类事件上打结构化日志。
3. 写一个 buffer-backed JSON logger 测试，断言日志中包含 `run_id`、`step`、`tool`、`level`，且不包含 token 或敏感字段。
4. 设计最小 metrics 表，不一定接入 Prometheus：`agent_runs_total`、`agent_run_duration_ms`、`tool_calls_total`、`progress_dropped_total`。
5. 设计 trace 草图：一个 `AgentRun` root span，下面挂 `ToolCall`、`TripLookup`、`ProgressPublish` 子 span，记录关键属性。
6. 给一条故障场景写排障问题：例如 “用户说进度卡住了”，用 logs/metrics/trace 分别怎么查。

### 建议文件

- `internal/agent/observability/logging.go`
- `internal/agent/observability/logging_test.go`
- `internal/agent/observability/metrics.md` 或练习笔记中的 “metrics design” 小节
- `internal/agent/observability/trace.md` 或练习笔记中的 “trace sketch” 小节

如果当前练习仓库还不适合放 `.md`，可以先把 metrics/trace 设计写进测试文件注释；重点是形成命名和字段习惯。

### 测试/验证命令

```bash
gofmt -w internal/agent/observability
go test ./...
```

定向日志测试：

```bash
go test ./internal/agent/observability -run TestStructuredLogs -count=1 -v
```

如果本日改动接入了前两天的 broadcaster 或 run state，也补跑：

```bash
go test -race ./...
```

### 检索问题

- logs、metrics、trace 各自最适合回答哪类问题？
- 为什么 `run_id` / `request_id` 这类关联字段比自然语言日志更重要？
- “progress dropped” 应该是 debug log、warn log，还是 metric？为什么？

### 常见误区

- 把日志当 printf，只记录一句中文/英文文本，没有稳定字段。
- 记录完整请求体、token、prompt 或个人信息，给排障制造安全风险。
- 在每个函数内部新建 logger，导致上下文字段丢失。
- 过早搭建复杂观测平台，却没有先定义要回答的问题和字段。
