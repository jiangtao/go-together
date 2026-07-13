# Day 26：race detector

English title: **Day 26: race detector**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
