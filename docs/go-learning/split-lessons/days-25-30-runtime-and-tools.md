# Day 25-30：运行期治理与 Tool

English title: **Days 25-30: Runtime Operations and Tools**

本切片服务于主教程 Day 25-30。它不是 Trip/Agent 产品路线，而是用 Trip 贯穿案例和 Agent 扩展案例练习 Go 的运行期能力：channel 所有权、race detector、可观测性、优雅关闭、开源阅读方法，以及最小 Tool interface。

每一天都按同一节奏执行：先用 Node.js 心智找入口，再切换到 Go 的并发、context、接口和工具链心智；当天必须写出小练习，并用命令验证。

## Day 25：channel progress broadcaster

English focus: **Progress broadcaster with channel ownership**

### 学习目标

- 能用 channel 实现一个最小 progress broadcaster，把 Agent run 的进度事件发布给多个订阅者。
- 能解释 “谁发送，谁关闭 channel” 在 broadcaster 中为什么必须有明确所有权。
- 能处理慢消费者、订阅取消和 broadcaster 关闭，避免 goroutine 泄漏。

### Node.js 对照

Node.js 里你可能会用 `EventEmitter`、callback、SSE writer 或 RxJS subject 来广播进度。它们的常见心智是“emit 事件，谁监听谁处理”。Go 里 channel 不是 EventEmitter：channel 有发送方、接收方、关闭方和阻塞语义。如果把同一个 channel 暴露给外部随便 send/close，就很容易 panic、阻塞或泄漏。

本日迁移重点：从 “event bus 谁都能 emit” 转成 “broadcaster 拥有发送和关闭权，subscriber 只读并通过 context 退出”。

### Go 核心心智

- `chan T` 会阻塞；buffer 只能缓冲峰值，不能替代背压设计。
- channel 关闭表示“以后不会再发送”，不是“请停止接收方工作”的通用信号。
- 发送方负责关闭 channel；接收方不关闭别人还可能发送的 channel。
- 每个 subscriber 最好有自己的只读 channel，避免一个慢消费者拖住所有人。
- `context.Context` 用来表达订阅生命周期，broadcaster 内部负责在取消后移除 subscriber。

### 实践步骤

1. 定义 `ProgressEvent`，包含 `RunID`、`Step`、`Message`、`At`，可选加入 `Seq` 便于测试排序。
2. 定义 `Broadcaster`，内部持有 mutex、`map[int]chan ProgressEvent`、关闭标记和下一个 subscriber id。
3. 实现 `Subscribe(ctx context.Context) (<-chan ProgressEvent, func(), error)`：返回只读 channel 和取消函数；`ctx.Done()` 后自动移除订阅并关闭该 subscriber channel。
4. 实现 `Publish(event ProgressEvent) bool`：向当前 subscribers 广播；对每个 subscriber 使用 non-blocking send 或短 timeout，避免慢消费者卡死发布者。
5. 实现 `Close()`：由 broadcaster 统一关闭所有 subscriber channel，后续 `Publish` 返回 false 或稳定错误。
6. 写测试覆盖：多个 subscriber 都收到事件；取消一个 subscriber 后不会再收到；慢消费者不会阻塞快速消费者；`Close` 后所有 channel 都能退出。
7. 用 `go test -race` 验证 `Subscribe`、`Publish`、`Close` 并发调用没有 data race。

### 建议文件

- `internal/agent/progress/event.go`
- `internal/agent/progress/broadcaster.go`
- `internal/agent/progress/broadcaster_test.go`

如果你前面几天已经有 `internal/trip` 或 `internal/agent` 目录，优先沿用现有结构；不要为了这一天重排整个练习仓库。

### 测试/验证命令

```bash
gofmt -w internal/agent/progress
go test ./...
go test -race ./...
```

定向调试时可先跑：

```bash
go test -run TestBroadcaster ./internal/agent/progress -count=1 -v
go test -race ./internal/agent/progress -count=1
```

### 检索问题

- “谁发送，谁关闭 channel” 在 broadcaster 中具体由哪个类型承担？
- 为什么 subscriber 应该拿到 `<-chan ProgressEvent`，而不是 `chan ProgressEvent`？
- 慢消费者有哪三种处理策略：阻塞、drop、隔离？本练习选哪一种，代价是什么？

### 常见误区

- 让 subscriber 自己 close channel，导致 publisher 后续 send panic。
- 在持有 mutex 时执行可能阻塞的 channel send，把整个 broadcaster 锁死。
- 只测试单 subscriber，不测试取消、关闭和慢消费者。
- 认为 buffer 足够大就不会阻塞；真实系统中 buffer 只是延迟问题暴露。

## Day 26：race detector

English focus: **Make and fix one data race**

### 学习目标

- 能主动制造一个小 data race，并读懂 `go test -race` 的 read/write stack。
- 能比较 mutex、channel owner、局部结果合并三种修复方式。
- 能把 race detector 纳入 Go 并发练习的日常验证，而不是上线前偶尔跑一次。

### Node.js 对照

Node.js 主线程 JavaScript 通常不会让你在同一进程里随手写共享内存 race；更多问题来自异步时序、重复回调、缓存污染或 worker/thread 边界。Go 的 goroutine 默认共享同一地址空间，多个 goroutine 同时读写同一个变量就是现实风险。

本日迁移重点：从 “event loop 避免了大多数共享内存并发” 转成 “goroutine 很轻，但共享变量必须有所有权或同步规则”。

### Go 核心心智

- data race 是两个 goroutine 访问同一内存，其中至少一个写，并且没有同步。
- race detector 是运行时检测：只有被测试执行到的路径才可能被发现。
- race 报告的核心是两组 stack：一个读、一个写，外加 goroutine 创建位置。
- 修复不等于“让测试偶尔通过”；修复要让状态所有权变清楚。
- 优先选择局部结果合并或 channel owner；确实需要共享可变状态时再用 `sync.Mutex`。

### 实践步骤

1. 定义一个故意有问题的 `TripRunState`：包含 `Steps []string`、`Status string` 或 `Progress map[string]int`。
2. 写一个测试并发调用 `state.AddStep(...)`，先不要加锁，让 `go test -race` 报错。
3. 在测试注释或课程笔记中摘录你读到的关键信息：哪个 goroutine 在读、哪个 goroutine 在写、变量大概在哪里。
4. 选择一种修复方式：
   - 局部结果合并：每个 goroutine 返回自己的结果，主 goroutine 汇总。
   - mutex：`TripRunState` 内部用 `sync.Mutex` 保护共享字段。
   - channel owner：单独 goroutine 拥有 state，其他 goroutine 发送命令。
5. 保留一个正常测试证明业务结果正确，再跑 `go test -race` 证明并发访问干净。
6. 加一个小复盘段落，说明你为什么选这个修复方式，而不是另外两种。

### 建议文件

- `internal/agent/run/state.go`
- `internal/agent/run/state_test.go`
- `docs/go-learning/race-demo-note.md` 可作为个人学习笔记，但本次切片任务不要创建；练习时若需要记录，优先写在测试注释或当天学习日志中。

### 测试/验证命令

```bash
gofmt -w internal/agent/run
go test ./...
go test -race ./...
```

定向观察 race 报告：

```bash
go test -race ./internal/agent/run -run TestTripRunStateRace -count=1 -v
```

如果你保留“故意失败”的测试，请用 build tag 或注释说明，避免它污染后续全量验证。

### 检索问题

- race detector 报告里的 “Read at” 和 “Previous write at” 分别告诉你什么？
- 为什么 `append` 到同一个 slice 是典型 race 场景？
- `sync.Mutex` 解决了 data race 后，是否自动解决了业务时序 bug？

### 常见误区

- 只看 race 报告第一行，不追 read/write stack。
- 用 `time.Sleep` 试图“避开” race，而不是建立同步关系。
- 给每个字段随手加锁，却没有定义谁拥有状态、锁保护哪些不变量。
- 以为 `go test` 通过就等于没有 race；必须跑 `go test -race`，且测试要覆盖并发路径。

## Day 27：observability

English focus: **Structured logs, minimal metrics, trace thinking**

### 学习目标

- 能给 Agent run / Trip planning 的关键路径加入结构化日志。
- 能区分 logs、metrics、trace 分别回答什么问题。
- 能为 progress broadcaster 和 tool call 设计最小可观测字段，并避免记录敏感信息。

### Node.js 对照

Node.js 后端常见组合是 `pino`/`winston` 日志、Prometheus metrics、OpenTelemetry trace。Go 的标准库已经有 `log/slog`，适合先练结构化日志；metrics 和 trace 本日不强行引入完整平台，而是先设计命名、字段和边界。

本日迁移重点：从 “console.log 调试某次请求” 转成 “结构化事件能解释单次失败，指标能解释整体趋势，trace 能解释跨边界耗时”。

### Go 核心心智

- `slog.Logger` 应该作为依赖注入到 service/agent，而不是在深层代码里创建全局 logger。
- 日志字段要稳定：`run_id`、`trip_id`、`step`、`tool`、`duration_ms`、`error_kind` 比自由文本更可查询。
- logs 回答“这一次发生了什么”；metrics 回答“一段时间内发生了多少、多久、失败率多少”；trace 回答“时间花在哪些跨边界调用上”。
- context 可以携带 request/run 级关联信息，但不要把大量业务对象塞进 context。
- token、authorization header、用户隐私和完整 prompt 默认不能进入日志。

### 实践步骤

1. 为 Agent run 或 progress broadcaster 注入 `*slog.Logger`，没有传入时使用 `slog.New(slog.NewTextHandler(io.Discard, nil))` 或测试 logger。
2. 在 run start、tool call start/end、progress dropped、run finish/error 四类事件上打结构化日志。
3. 写一个 buffer-backed JSON logger 测试，断言日志中包含 `run_id`、`step`、`tool`、`level`，且不包含 token 或敏感字段。
4. 设计最小 metrics 表，不一定接入 Prometheus：`agent_runs_total`、`agent_run_duration_ms`、`tool_calls_total`、`progress_dropped_total`。
5. 设计 trace 草图：一个 `AgentRun` root span，下面挂 `ToolCall`、`TripLookup`、`ProgressPublish` 子 span，记录关键属性。
6. 给一条故障场景写排障问题：例如 “用户说进度卡住了”，用 logs/metrics/trace 分别怎么查。

### 建议文件

- `internal/agent/observability/logging.go`
- `internal/agent/observability/logging_test.go`
- `internal/agent/observability/metrics.md` 或练习笔记中的 “metrics design” 小节
- `internal/agent/observability/trace.md` 或练习笔记中的 “trace sketch” 小节

如果当前练习仓库还不适合放 `.md`，可以先把 metrics/trace 设计写进测试文件注释；重点是形成命名和字段习惯。

### 测试/验证命令

```bash
gofmt -w internal/agent/observability
go test ./...
```

定向日志测试：

```bash
go test ./internal/agent/observability -run TestStructuredLogs -count=1 -v
```

如果本日改动接入了前两天的 broadcaster 或 run state，也补跑：

```bash
go test -race ./...
```

### 检索问题

- logs、metrics、trace 各自最适合回答哪类问题？
- 为什么 `run_id` / `request_id` 这类关联字段比自然语言日志更重要？
- “progress dropped” 应该是 debug log、warn log，还是 metric？为什么？

### 常见误区

- 把日志当 printf，只记录一句中文/英文文本，没有稳定字段。
- 记录完整请求体、token、prompt 或个人信息，给排障制造安全风险。
- 在每个函数内部新建 logger，导致上下文字段丢失。
- 过早搭建复杂观测平台，却没有先定义要回答的问题和字段。

## Day 28：graceful shutdown

English focus: **Predictable shutdown for HTTP, gRPC, DB, goroutines**

### 学习目标

- 能用 root context 管住 HTTP/gRPC/Agent 后台 goroutine 的生命周期。
- 能解释 `Shutdown`、`Close`、`GracefulStop`、`Stop` 的差异。
- 能写测试证明 shutdown 时不再接收新工作，并等待已有工作收敛或超时。

### Node.js 对照

Node.js 里常见做法是监听 `SIGTERM`，调用 `server.close()`，停止接收新连接，再等待正在处理的请求完成，最后关闭 DB pool。Go 的 `http.Server.Shutdown(ctx)` 内置了类似语义；gRPC 侧有 `GracefulStop()`。但 Go 程序还常有自己启动的 goroutine，如果它们不观察 context，进程关闭路径仍然不可控。

本日迁移重点：从 “关 HTTP server” 转成 “root context 取消后，所有后台工作都能被等待、超时和记录”。

### Go 核心心智

- `signal.NotifyContext` 把 OS signal 转成 context cancellation。
- `http.Server.Shutdown(ctx)` 停止接收新请求，并等待 active requests；`Close()` 更像立即关闭连接。
- gRPC `GracefulStop()` 等待已有 RPC 完成；`Stop()` 是更强硬的停止。
- DB pool 关闭通常不接收 context，所以要安排在请求入口停止之后、进程退出之前。
- 后台 goroutine 需要 `Wait()` 或 `errgroup` 收敛，不能只靠主函数结束。

### 实践步骤

1. 创建 `App` 或 `Runtime` 类型，持有 root context、cancel、HTTP server、可选 gRPC server、DB pool fake、background `errgroup`。
2. 实现 `/healthz`：运行中返回 200；shutdown 开始后返回 503 或停止接收新请求。
3. 启动一个模拟 Agent planning goroutine：循环发布 progress，并在 `ctx.Done()` 后退出。
4. 实现 `Run(ctx)` 和 `Shutdown(ctx)`：收到 signal 或外部 cancel 后，先标记 draining，再停止 HTTP/gRPC 接收新工作，再 cancel root context，等待后台 goroutine，最后关闭 DB pool。
5. 写 `httptest` 或真实本地 listener 测试：请求处理中触发 shutdown，验证已有请求能完成；shutdown 后新请求失败或 healthz 不再 ready。
6. 写一个 timeout 测试：模拟后台任务不退出，`Shutdown` 在 deadline 后返回错误并记录日志。
7. 用 race detector 跑全量，确认 shutdown 与 progress/run goroutine 并发时没有 race。

### 建议文件

- `cmd/trip/main.go` 或当前练习入口
- `internal/runtime/app.go`
- `internal/runtime/app_test.go`
- `internal/runtime/health.go`
- `internal/runtime/shutdown_test.go`

保持练习小：HTTP、gRPC、DB 可以用 fake 或最小实现串出关闭顺序，不需要搭一个完整服务。

### 测试/验证命令

```bash
gofmt -w cmd internal/runtime
go test ./...
go test -race ./...
```

定向 shutdown 测试：

```bash
go test ./internal/runtime -run 'TestGracefulShutdown|TestShutdownTimeout' -count=1 -v
```

手动验证时可运行服务后发送 `SIGTERM`：

```bash
go run ./cmd/trip
```

另一个终端中执行：

```bash
pkill -TERM trip
```

### 检索问题

- `http.Server.Shutdown` 和 `http.Server.Close` 的区别是什么？
- 为什么 shutdown 要先停止入口，再取消后台工作，最后关 DB pool？
- 如果某个 goroutine 不监听 `ctx.Done()`，优雅关闭会在哪里卡住？

### 常见误区

- 只处理 HTTP server，不处理自己启动的 goroutine。
- 在 signal handler 里直接 `os.Exit(0)`，跳过 defer、日志 flush 和资源关闭。
- shutdown 没有 timeout，导致进程在部署或测试中无限等待。
- health check 在 draining 时仍返回 ready，让负载均衡继续打流量。

## Day 29：open-source reading pass

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

## Day 30：minimal Tool interface

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
