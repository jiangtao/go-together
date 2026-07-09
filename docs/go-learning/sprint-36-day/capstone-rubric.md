# Agent Service Capstone 评分标准

English title: **Agent Service Capstone Rubric**

主教程：[../node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

总分 100。目标不是做大项目，而是证明你能把 Go 后端主干能力连成一个可测试、可解释、可关闭的 Agent service slice。

## 评分表

| 维度 | 分值 | 达标标准 |
|---|---:|---|
| Go 核心心智 | 10 | module/package 清晰，错误处理显式，context 不在内部偷换成 `Background()`，interface 小而由使用方定义 |
| HTTP/gRPC API | 12 | 有 HTTP 或 gRPC 入口，DTO/proto 与 domain 分离，错误码映射清楚，handler/server 有测试 |
| 数据层 | 14 | migration 可回滚，sqlc 生成代码可复现，repository wrapper 不泄漏过多 generated type，事务失败可验证 |
| 并发与流式 | 14 | goroutine/errgroup/channel 使用合理，能取消，慢消费者不拖死服务，`go test -race` 通过 |
| Agent 抽象 | 14 | Tool interface 清晰，fake Model 可测试，tool call 和 observation 边界明确，不依赖真实 LLM 跑核心测试 |
| Memory 与 progress | 10 | `agent_runs` / `agent_steps` 可持久化，progress stream/SSE/gRPC 可订阅，可处理 cancel |
| 测试与验证 | 12 | 覆盖成功、错误、取消、rollback、race、shutdown；验证命令记录清楚 |
| 观测性与 shutdown | 8 | 结构化日志字段稳定，metrics/trace 字段有设计，shutdown 能停止接收新请求并收敛后台任务 |
| 开源阅读复刻 | 6 | 有四遍阅读笔记，并复刻 100-300 行开源项目小模式 |

## 不达标信号

- 只能跑 happy path，没有错误和取消测试。
- Agent 测试必须访问真实外部 LLM。
- 数据库事务失败后无法证明 rollback。
- `go test -race ./...` 未跑或失败。
- 日志包含 token、手机号、身份证、完整用户隐私输入。
- shutdown 直接 `os.Exit`，没有等待正在运行的任务。

## 最终提交物

- 代码或 scratch project。
- 测试输出记录。
- 四遍开源阅读笔记。
- `36 天 Go 学习复盘`。
- `下一阶段 30 天计划`。
