# Day 29：WeKnora 请求链路阅读

English title: **Day 29: Reading a WeKnora Request Path**

返回：[课程目录](../README.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Four-pass reading of real Go projects**

### 学习目标

- 能用四遍阅读法追踪 WeKnora 的一次问答请求，至少深入一段 Go 业务逻辑。
- 能从开源项目中提取一个 100-300 行可复刻小模式。
- 能给出 context、错误与测试等三类源码证据，区分页面现象、源码判断和运行验证。

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

1. 面向前端应用与 Node.js 后端背景，优先选择 [WeKnora](https://github.com/Tencent/WeKnora) 的一次问答请求：页面操作 → 请求参数 → Go 路由 → 业务处理 → 流式返回。只追这一条链，记录所读版本或 commit SHA。能独立解释此链路后，再用 [Eino](https://github.com/cloudwego/eino) 深入 Agent 机制。后端基础仍可按问题选 `chi`、`pgx`、`sqlc` 或 `grpc-go`。
2. 第一遍 shape：记录 `go.mod` module 名、入口目录、核心包、测试文件分布、是否使用 `internal/`。
3. 第二遍 request/path：挑一条路径，例如 HTTP request、DB query、gRPC call、tool call、model call，画出 5-8 个函数/类型节点。
4. 第三遍 production concerns：找 3 个证据，分别对应 context/cancel、error handling、logging/metrics/testing/shutdown 中任意三类。
5. 第四遍 mini-rebuild idea：写一个 100-300 行练习计划，例如 “复刻一个 middleware 链”、 “复刻一个 option pattern”、 “复刻一个 Tool 调用接口”。
6. 用自己的话写 5 条迁移规则：这个项目给 Node.js 开发者学习 Go 的启发是什么。

### Agent 阅读范围

| 项目 | 本日阅读边界 | 可复刻的小模式 |
|---|---|---|
| WeKnora：应用入口 | 从页面发送请求定位 Go 路由、参数校验和 service，再追到流式返回 | 请求校验或错误到响应的映射 |
| WeKnora：一个深入问题 | 选择取消回答、参数未生效或引用展示中的一个现象，追到 Go 后端与邻近测试 | context 取消传播或流式终态处理 |
| Eino：后续进阶 | 独立追通应用链路后，再读 ChatModelAgent、Runner 与一次工具调用 | 工具注册校验或执行事件收集 |

用 `rg` 搜索示例中实际出现的符号，沿调用定位实现与邻近测试。笔记中的 5-8 个节点要附源码路径或固定 SHA 链接；上表是阅读方向，不是已经核实的具体调用图。

本日最小产物是一条至少包含 Go 业务逻辑的调用图和三类源码证据；不要只停在页面组件。取消、参数和引用是调查方向，不是已经确认存在的 bug。未运行时区分源码判断与运行证据。

以上顺序承接 2026-09-15 针对前端应用与 Node.js 背景的最终调研建议。开始时重查业务代码更新，超过 3 个自然月则重新选型；Issue 时间仅作参考，机器人更新不等于维护者回应。当天以源码阅读为主，完整本地链路在进阶计划中验证。

### 建议文件

- 笔记写入本 Lesson 的个人笔记，由课程学习入口定位。
- 如动手复刻，代码放在本 Lesson 的练习目录；评测记录仍由评测流程生成。
- 推荐笔记结构：`Shape`、`Path`、`Production concerns`、`Mini-rebuild`、`Node.js -> Go takeaways`。

### 测试/验证命令

本日以阅读和复刻设计为主，提交路径图、三类工程证据与小模式计划即可进行阅读验收。未创建 Go 模块时不要运行测试，也不要把未运行写成通过。

如果完成了 mini-rebuild 小代码，在当天 `exercise/` 的 Go 模块根目录运行：

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
