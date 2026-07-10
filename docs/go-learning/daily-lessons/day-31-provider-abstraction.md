# Day 31：provider abstraction

English title: **Day 31: provider abstraction**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把真实 LLM provider 隔离到可替换接口后面，让 Agent loop 可以在没有网络、没有 API key、没有真实模型波动的情况下被测试。今天的重点不是“接入某个模型 SDK”，而是学会在 Go 里把外部 provider 变成小接口和边界适配器。

### Node.js 对照

在 Node.js / TypeScript 中，你可能会定义 `LLMClient` interface，用 Jest mock 或 fake `fetch` 控制模型响应。Go 的对应做法是：由使用方定义小接口，用 struct 实现 fake model，用显式 `error` 表达 provider 失败。Go 不需要类继承，也不鼓励让核心逻辑依赖庞大的 SDK client。

### Go 核心心智

- interface 应由 Agent loop 所在包定义，只包含 loop 真正需要的方法。
- provider adapter 是边界层，负责把 OpenAI、Anthropic、Ollama 等 SDK 形状转换成课程内的 `ModelRequest` / `ModelResponse`。
- fake model 是一等测试工具，不是临时 hack。它要能脚本化返回 final answer、tool call、model error 和 context cancel。
- 所有 provider 调用都接收 `context.Context`，测试里可以用 deadline 证明 loop 会退出。
- 模型消息、tool call、observation 要有课程内稳定结构，避免 provider SDK 类型扩散到 service、memory、HTTP/gRPC 层。

### 实践步骤

1. 定义 `Model` 小接口，例如 `Complete(ctx context.Context, req ModelRequest) (ModelResponse, error)`。
2. 定义课程内 DTO：`ModelRequest`、`ModelMessage`、`ModelResponse`、`ToolCall`、`ToolSpec`。
3. 实现 `ScriptedModel`，按预设脚本逐次返回响应；当脚本耗尽时返回清晰错误。
4. 让 `AgentRunner` 依赖 `Model` 和 `ToolRegistry`，不要依赖真实 provider client。
5. 实现最小 loop：发送用户输入 -> 模型返回 final answer 或 tool call -> tool observation 追加进 messages -> 再问模型 -> 得到 final answer。
6. 写表驱动测试覆盖三条路径：直接 final、一次 tool call 后 final、model error。
7. 写 context 测试：fake model 阻塞时，`ctx` cancel 后 loop 返回 `context.Canceled` 或 `context.DeadlineExceeded`。

### 建议文件

- `internal/agent/model.go`
- `internal/agent/messages.go`
- `internal/agent/runner.go`
- `internal/agent/fake_model_test.go`
- `internal/agent/runner_test.go`

### 测试/验证命令

```bash
gofmt -w internal/agent
go test ./internal/agent
go test ./...
```

如果当前 scratch project 还没有 `internal/agent`，先创建最小包，再跑 `go test ./...` 确认 package 边界没有破坏。

### 检索问题

- 为什么 Agent 核心测试首先需要 fake model，而不是直接调用真实 LLM？
- Go 里“由使用方定义 interface”和 TypeScript 里“导出一个共享 client interface”的差异是什么？
- `ModelResponse` 为什么不应该直接暴露某个 provider SDK 的 response type？
- context cancel 应该在 provider adapter、Agent loop、tool call 哪些位置被观察？

### 常见误区

- 把 provider SDK client 直接塞进 `AgentRunner`，导致测试必须访问网络。
- 为未来 provider 设计过大的 interface，比如一次性放入 embeddings、chat、stream、image、retry、billing。
- fake model 只返回字符串，无法表达 tool call、错误、阻塞和取消。
- 在 loop 里用 `context.Background()` 覆盖调用方传入的 `ctx`。
- 把 provider 的错误原样泄漏到 HTTP/gRPC response，而没有在边界层分类。
