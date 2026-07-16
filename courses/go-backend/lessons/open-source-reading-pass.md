# Day 29：open-source reading pass

English title: **Day 29: open-source reading pass**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Four-pass reading of real Go projects**

### 学习目标

- 能用四遍阅读法读一个真实 Go 开源项目，而不是随机点文件。
- 能从开源项目中提取一个 100-300 行可复刻小模式。
- 能把阅读重点放在 Go 工业实践：目录结构、接口边界、context、错误、并发、测试、可观测性。

### Node.js 对照

Node.js 项目阅读时，你可能会从 `package.json`、入口文件、路由注册、依赖注入容器开始。Go 项目阅读类似，但入口通常是 `go.mod`、`cmd/`、`internal/`、包名和接口边界。Go 不鼓励先追大型框架魔法；读懂包之间的静态依赖和小接口，通常比找“主框架”更有效。

本日迁移重点：从 “看懂一个产品怎么跑” 转成 “抽取一个 Go 模式并复刻，服务自己的学习主线”。

### Go 核心心智

- 第一遍看 shape：module、cmd、internal、pkg、主要包、测试布局。
- 第二遍追 path：选一条请求、命令或 tool call，从入口追到核心逻辑。
- 第三遍看 production concerns：context、错误包装、并发同步、shutdown、logging、tests。
- 第四遍 mini-rebuild：只复刻一个小模式，不照抄整个项目。
- 阅读开源是学习材料，不是把课程变成对某个项目的产品复刻。

### 实践步骤

1. 从以下项目中任选一个：`chi`、`pgx`、`sqlc`、`grpc-go`、`langchaingo`、`PocketBase`、`Ollama`。优先选与你当天问题最相关的项目。
2. 第一遍 shape：记录 `go.mod` module 名、入口目录、核心包、测试文件分布、是否使用 `internal/`。
3. 第二遍 request/path：挑一条路径，例如 HTTP request、DB query、gRPC call、tool call、model call，画出 5-8 个函数/类型节点。
4. 第三遍 production concerns：找 3 个证据，分别对应 context/cancel、error handling、logging/metrics/testing/shutdown 中任意三类。
5. 第四遍 mini-rebuild idea：写一个 100-300 行练习计划，例如 “复刻一个 middleware 链”、 “复刻一个 option pattern”、 “复刻一个 Tool 调用接口”。
6. 用自己的话写 5 条迁移规则：这个项目给 Node.js 开发者学习 Go 的启发是什么。

### 建议文件

- `docs/go-learning/open-source-reading-note.md` 可作为个人阅读笔记，但本次 Agent 05 不创建该文件。
- 如果在练习仓库内执行，可临时写在当天学习日志或 issue 评论中。
- 推荐笔记结构：`Shape`、`Path`、`Production concerns`、`Mini-rebuild`、`Node.js -> Go takeaways`。

### 测试/验证命令

本日以阅读和复刻设计为主，验证不是跑目标开源项目全量测试，而是确认你能输出可执行理解：

```bash
go test ./...
```

如果你完成了 mini-rebuild 小代码，再跑：

```bash
gofmt -w .
go test ./...
go test -race ./...
```

阅读验收问题：

```text
不用看笔记，口头说出：这个项目的入口在哪里？一条核心路径经过哪些包？你准备复刻哪 100-300 行模式？
```

### 检索问题

- 为什么第一遍阅读不应该钻实现细节？
- `cmd/`、`internal/`、包名和测试文件分别给你哪些项目信号？
- 什么样的开源片段适合 mini-rebuild，什么样的片段不适合？

### 常见误区

- 一上来读最复杂的核心算法，忽略项目 shape 和边界。
- 把阅读目标变成“看完整个项目”，导致没有可执行产物。
- 只看 README，不追一条真实代码路径。
- 复刻太大，超过 300 行后学习焦点从 Go 模式变成搬运项目。
