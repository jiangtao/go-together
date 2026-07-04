# Week 11：日志、Metrics、Trace 与告警

对应天数：Day 59-63

## 本周目标

- 理解结构化日志、metrics、trace、错误上报和告警噪音。
- 能为一个小功能设计日志、指标和 trace 点。
- 能避免在日志和告警里泄露敏感上下文。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| logging fields | structured logger | 字段要稳定、低敏、可检索 |
| Prometheus client | counter/gauge/latency | 指标类型和低基数标签 |
| OpenTelemetry trace | context 传递 trace | trace 跟调用链绑定 |
| Sentry 策略 | 错误上报策略 | 控制采样和噪音 |
| observability design | 日志 + 指标 + trace | 观测性是功能设计的一部分 |

## 每日索引

- Day 59：日志字段设计。
- Day 60：metrics 基础。
- Day 61：trace 基础。
- Day 62：错误上报和告警。
- Day 63：观测性设计小演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [log/slog package](https://pkg.go.dev/log/slog)
- [Profiling Go Programs](https://go.dev/blog/pprof)
- [Go Concurrency Patterns: Context](https://go.dev/blog/context)

