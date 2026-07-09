# 36 天 Go 教程 Sub-Agent 分工计划

English title: **36-Day Go Course Sub-Agent Work Plan**

本文是执行协作用的工作计划，不是学习进度记录。主教程仍以 [node-to-go-36-day-course.md](node-to-go-36-day-course.md) 为准；6 个 sub-agent 只负责把各自 6 天的课程实践深化成可执行切片，最后由主会话统一 review、audit、汇总修订。

## 分工原则

- 每个 agent 只写自己负责的一个切片文件，避免并行改同一文件。
- 每一天必须保持“学习优先”，练习切片只服务于概念掌握，不做成产品项目。
- 每一天必须包含：学习目标、Node.js 对照、Go 核心心智、实践步骤、文件建议、测试/验证、检索问题、常见误区。
- 数据结构属于基础章节，保持在 Day 3-4，不后移。
- 不新增任务管理式进度表或 checklist 文件。

## Agent 分配

| Agent | Days | 主题 | 写入文件 |
|---|---:|---|---|
| Agent 01 | 1-6 | 基础心智、数据结构、错误、接口、context | `split-lessons/days-01-06-foundations.md` |
| Agent 02 | 7-12 | HTTP、JSON、错误映射、middleware、测试、migration | `split-lessons/days-07-12-http-and-migrations.md` |
| Agent 03 | 13-18 | sqlc、repository、transaction、DB 验证、proto、codegen | `split-lessons/days-13-18-data-and-protobuf.md` |
| Agent 04 | 19-24 | gRPC、streaming、interceptor、goroutine、errgroup | `split-lessons/days-19-24-grpc-and-concurrency.md` |
| Agent 05 | 25-30 | broadcaster、race、observability、shutdown、开源阅读、Tool | `split-lessons/days-25-30-runtime-and-tools.md` |
| Agent 06 | 31-36 | Model、memory、progress、integration、hardening、final review | `split-lessons/days-31-36-agent-capstone.md` |

## Review Gate

最终汇总前必须检查：

- 36 天数量完整，没有跳号。
- 所有切片都回到 Node.js -> Go 对照。
- 每天都有具体实践和验证命令。
- 没有把 Trip/Agent 写成产品路线。
- 没有新增任务管理式进度表。
- 主教程入口和切片入口本地链接可用。
