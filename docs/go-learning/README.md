# Go 学习目录

English title: **Go Learning Directory**

这是一套面向 Node.js/TypeScript 后端开发者的 Go 学习材料。当前只保留最新 36 天合并版作为唯一教程正文：它把旧的长期框架和短课正文合并成一条更深入、更可执行的 30-40 天推进计划。

## 推荐入口

| 路线 | 文件 | 适用场景 |
|---|---|---|
| 36 天合并版主教程 | [node-to-go-36-day-course.md](node-to-go-36-day-course.md) | 首选路线：每天 2 小时；每一天都有方向、深入点、具体步骤、产物、验证和检索练习 |
| 36 天拆分实践切片 | [split-lessons/README.md](split-lessons/README.md) | 配套深化：按 6 个切片展开每天的具体实践步骤 |
| 最终评分标准 | [sprint-36-day/capstone-rubric.md](sprint-36-day/capstone-rubric.md) | Day 36 自评和 capstone 验收 |

## 学习方法

每天学习时按这个顺序写：

1. Node.js 里我以前怎么做。
2. Go 里这个能力怎么表达。
3. Go 和 Node.js 的本质差异是什么。
4. 我应该读哪一个开源项目片段。
5. 我今天写了什么代码、测试、proto、migration、阅读笔记或复盘。
6. 我跑过什么验证命令。

每天必须有产物；只看材料不算完成。

主教程负责学习路线，拆分实践切片负责每天怎么动手。不要把切片当作产品项目计划；Trip/Agent 只提供稳定案例名，目的是证明概念掌握。

## 36 天合并版阶段

| Phase | Day | 主题 |
|---|---:|---|
| Phase 01 | Day 1-6 | Go 核心心智模型与数据结构 |
| Phase 02 | Day 7-10 | HTTP、JSON 与测试 |
| Phase 03 | Day 11-16 | 数据库、sqlc 与事务边界 |
| Phase 04 | Day 17-20 | gRPC、Protobuf 与 Unary 服务 |
| Phase 05 | Day 21-28 | Streaming、并发与运行期治理 |
| Phase 06 | Day 29-36 | Agent、开源阅读与最终切片 |

## 复盘问题

1. 这阶段我能解释哪个 Node.js -> Go 的差异？
2. 这阶段我写了哪些 Go demo、测试或验证脚本？
3. 这阶段我能读懂哪类开源 Go 代码？
4. 最容易混淆的错误处理、context 或并发场景是什么？
5. 下一阶段最需要补的基础是什么？

## 总参考资料

完整资源索引见仓库根目录 [RESOURCES.md](../../RESOURCES.md)。主教程优先引用官方 Go、gRPC、Protobuf、database/sql、testing、context、race detector、log/slog 文档；开源项目作为阅读和复刻材料。
