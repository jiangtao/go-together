# Go 学习目录

English title: **Go Learning Directory**

这是一套面向 Node.js/TypeScript 后端开发者的 Go 学习材料。当前只保留最新 36 天主线作为唯一教程正文：它把旧的长期框架和短课正文整理成一条更深入、更可执行的 30-40 天推进计划。

## 推荐入口

| 路线 | 文件 | 适用场景 |
|---|---|---|
| 课程结构 | [course.json](course.json) | 37 个 Lesson 的稳定身份、Track、Stage、Day 节奏与评测契约 |
| 课程正文 | [lessons/](lessons/) | 先读 Day 0 搞清楚为什么学 Go；之后每次只打开当前 Lesson |
| 评测政策 | [evaluation/policy.md](evaluation/policy.md) | 四态、0–4 诊断、三次机会、工程证据与零答案泄露 |

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
| Phase 06 | Day 29-36 | Agent、开源阅读与最终切片 |

## 复盘问题

1. 这阶段我能解释哪个 Node.js -> Go 的差异？
2. 这阶段我写了哪些 Go demo、测试或验证脚本？
3. 这阶段我能读懂哪类开源 Go 代码？
4. 最容易混淆的错误处理、context 或并发场景是什么？
5. 下一阶段最需要补的基础是什么？

## 总参考资料

完整资源索引见仓库根目录 [RESOURCES.md](../../RESOURCES.md)。主教程优先引用官方 Go、gRPC、Protobuf、database/sql、testing、context、race detector、log/slog 文档；开源项目作为阅读和复刻材料。
