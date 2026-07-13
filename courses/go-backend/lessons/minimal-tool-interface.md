# Day 30：minimal Tool interface

English title: **Day 30: minimal Tool interface**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English focus: **Small Tool interface for Agent practice**

### 学习目标

- 能定义一个最小 Go `Tool` interface，并让 Agent loop 通过接口调用工具。
- 能实现 calculator tool 和 trip lookup tool，覆盖参数解析、context cancel、业务错误。
- 能解释 `Name()`、`Description()` 为什么也是 Agent tool 的业务 contract。

### Node.js 对照

Node.js / TypeScript 里常见 LangChain.js tool 形态是对象配置、schema、async function 和动态注册。Go 更适合先从小接口开始：调用方只需要知道工具名称、描述和 `Call(ctx, input)`。复杂 schema、JSON mode、provider adapter 可以留到后续日子；今天先把接口边界练稳。

本日迁移重点：从 “工具是一个动态 JS object” 转成 “工具是一个小而稳定的接口，Agent 依赖接口而不是具体实现”。

### Go 核心心智

- interface 通常由使用方定义；Agent loop 只定义自己需要的方法。
- `context.Context` 必须穿过 tool call，外部取消时工具要尽快返回。
- `Name()` 是稳定路由键；`Description()` 是给模型选择工具的语义说明。
- tool error 要分类：有些是可作为 observation 返回给模型的业务失败，有些是 run 级 fatal error。
- 参数可以先用 `json.RawMessage` 或简单 string，等 Day 31-34 再扩展 model/provider/schema。

### 实践步骤

1. 定义最小接口：

   ```go
   type Tool interface {
       Name() string
       Description() string
       Call(ctx context.Context, input string) (string, error)
   }
   ```

2. 实现 `CalculatorTool`：支持 `1+2`、`3*4` 这类极小表达式即可；不要写完整表达式引擎，重点是接口和测试。
3. 实现 `TripLookupTool`：依赖一个小 `TripStore` interface，根据 trip id 返回摘要；用 fake store 测 found/not found/error。
4. 定义 `Registry` 或 `map[string]Tool`，实现 `CallTool(ctx, name, input)`，找不到工具返回稳定错误。
5. 写 context cancel 测试：fake slow tool 在 `ctx.Done()` 后返回 `context.Canceled` 或 `context.DeadlineExceeded`。
6. 写 error 分类测试：参数错误可返回 observation 文案，store 连接错误应作为 fatal error 往上抛；先用简单错误类型或 sentinel error 表达。
7. 给每个 tool 写一段 `Description()` 测试，确保描述不是空字符串，并能说明输入格式。

### 建议文件

- `internal/agent/tool/tool.go`
- `internal/agent/tool/registry.go`
- `internal/agent/tool/calculator.go`
- `internal/agent/tool/trip_lookup.go`
- `internal/agent/tool/tool_test.go`
- `internal/agent/tool/calculator_test.go`
- `internal/agent/tool/trip_lookup_test.go`

### 测试/验证命令

```bash
gofmt -w internal/agent/tool
go test ./...
go test -race ./...
```

定向 tool 测试：

```bash
go test ./internal/agent/tool -run 'TestCalculatorTool|TestTripLookupTool|TestRegistry' -count=1 -v
```

### 检索问题

- `Description()` 为什么是 Agent tool 的业务接口的一部分，而不只是文档？
- Tool interface 应该由 provider adapter 定义，还是由 Agent loop 使用方定义？为什么？
- tool call 的 context cancel 应该由谁发起，tool 内部要做什么响应？

### 常见误区

- 一开始就设计复杂 schema/provider/plugin 系统，反而没练到 Go 小接口。
- `Call` 不接收 context，导致 shutdown 或用户取消时 tool 无法停止。
- `Description()` 写成空字符串或内部备注，模型无法据此选择工具。
- 把所有错误都格式化成字符串吞掉，上层无法区分可恢复 observation 和 fatal error。
