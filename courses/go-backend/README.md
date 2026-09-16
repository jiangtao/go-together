# Go 学习目录

English title: **Go Learning Directory**

这是一套面向 Node.js/TypeScript 后端开发者的 Go 学习材料。当前只保留最新 36 天主线作为唯一教程正文：它把旧的长期框架和短课正文整理成一条更深入、更可执行的 30-40 天推进计划。

## 推荐入口

| 路线 | 文件 | 适用场景 |
|---|---|---|
| 课程结构 | [course.json](course.json) | 37 个 Lesson 的稳定身份、Track、Stage、Day 节奏与评测契约 |
| 课程正文 | [lessons/](lessons/) | 先读 Day 0 搞清楚为什么学 Go；之后每次只打开当前 Lesson |
| 评测政策 | [evaluation/policy.md](evaluation/policy.md) | 四态、0–4 诊断、三次机会、工程证据与零答案泄露 |
| Agent 进阶计划 | [Go Agent 学习与贡献计划](../../docs/go-agent-learning-plan.md) | 从 WeKnora 应用链路进入 Go 后端，再用 Eino 深入 Agent 机制 |
| Agent 实战课程 | [30 课目录](../go-agent-application/README.md) | 与基础课衔接的完整 Markdown、课次身份与线路图 |

## 学习方法

每天学习时按这个顺序写：

1. Node.js 里我以前怎么做。
2. Go 里这个能力怎么表达。
3. Go 和 Node.js 的本质差异是什么。
4. 我应该读哪一个开源项目片段。
5. 我今天写了什么代码、测试、proto、migration、阅读笔记或复盘。
6. 我跑过什么验证命令。

每天必须有产物；只看材料不算完成。

主教程负责学习路线，每日实践文件负责当天怎么动手。正式 Day 1 前先读 Day 00，搞清楚 Go 和 Node.js 的取舍、学习动机和最终目标。进入 Day 1 后，学习时一天只打开一个每日文件；不要把多个天数混在一起，也不要把 Trip/Agent 当作产品项目计划。

## 每日闭卷评测

每天完成课程和练习后，在 `learning-records/go-backend/lessons/<lessonId>/notes.md` 写下回答与当天要求的验证证据，再显式调用 `$evaluate-go-day dayN`。兼容路由只从本 Course 的显式 Day 映射解析稳定 `lessonId`；评测器只读取该 Lesson，每次只问一道问题，评分只作诊断参考，所有必修能力项达标才算通过。

评测结果写入同一稳定身份目录的 `evaluation.md`，练习位于 `exercise/` 子目录。未达标时只指出能力缺口、依据位置和需要重读的当天小节，不提供答案、提示或跨 Day 扩展；同一能力项最多三次机会，之后回到当天课程重新学习。

## 36 天课程阶段

| Phase | Day | 主题 |
|---|---:|---|
| Phase 01 | Day 1-6 | Go 核心心智模型与数据结构 |
| Phase 02 | Day 7-10 | HTTP、JSON 与测试 |
| Phase 03 | Day 11-16 | 数据库、sqlc 与事务边界 |
| Phase 04 | Day 17-20 | gRPC、Protobuf 与 Unary 服务 |
| Phase 05 | Day 21-28 | Streaming、并发与运行期治理 |
| Phase 06 | Day 29-36 | Go 综合练习与 Agent 入门 |

## 基础课中的 Agent 是否重复

保留 Agent 场景作为 Go 综合练习，不再把它定位成一门完整 Agent 框架课。Day 29 练源码阅读；Day 30-35 用小工具、脚本模型、持久化与流式返回串起接口、context、错误、测试和资源生命周期；Day 36 总结工程基础。练习到最小可测切片为止，不扩展为生产级 Agent 框架。

实战课新增的是 WeKnora 真实应用、检索与异步机制、贡献闭环，以及 Eino 的执行和上下文边界。已有 Trip 查询、模型脚本、错误/取消用例与事件定义应复用，只补真实项目或框架适配带来的新增验证。复用产物不等于自动通过另一课，也不要求为了重复练习重写业务代码。

## Agent 方向如何继续

针对前端应用开发、有一定 Node.js 后端基础的学习者，路线采用：**WeKnora 学完整应用和首次贡献 → Eino 深入 Agent 机制 → 有实际接入需求时再学 MCP**。从上传、问答、流式展示等熟悉的用户操作出发，每个任务至少追到一段 Go 业务逻辑，并提供关键行为验证。

Day 29 优先追踪 WeKnora 的一条问答请求。Day 30-36 的 Trip 小接口、fake model 和测试继续作为拆解机制的练习材料。进入 WeKnora 前先具备 Go HTTP、JSON、error、context 和基本测试能力，数据库与并发知识按遇到的问题补齐；完整基础课的评测仍按既有规则推进。

进阶内容已形成独立的 `go-agent-application` 课程，共 3 条主干、5 个阶段、30 个 Lesson，在网站课程选择器中显示“Go Agent 应用实战”。它与当前 37 个基础 Lesson 分别记录进度；主干用于知识分块，阶段用于递进与里程碑总结。

## 复盘问题

1. 这阶段我能解释哪个 Node.js -> Go 的差异？
2. 这阶段我写了哪些 Go demo、测试或验证脚本？
3. 这阶段我能读懂哪类开源 Go 代码？
4. 最容易混淆的错误处理、context 或并发场景是什么？
5. 下一阶段最需要补的基础是什么？

## 总参考资料

完整资源索引见仓库根目录 [RESOURCES.md](../../RESOURCES.md)。主教程优先引用官方 Go、gRPC、Protobuf、database/sql、testing、context、race detector、log/slog 文档；开源项目作为阅读和复刻材料。
