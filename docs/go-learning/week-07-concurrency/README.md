# Week 07：并发基础与 Context Cancel

对应天数：Day 39-43

## 本周目标

- 理解 goroutine、channel、select、WaitGroup、errgroup、Mutex、Cond。
- 能写支持 context cancel 的等待逻辑。
- 能写带超时保护的并发测试。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| `Promise.all` | goroutine + wait | 并发要控制生命周期 |
| `Promise.allSettled` | WaitGroup / errgroup | 等待和错误收敛要设计 |
| queue + semaphore | Mutex / Cond / channel | 资源等待和唤醒要正确 |
| request abort | `ctx.Done()` | 等待资源时也要能取消 |
| async test timeout | channel + `time.After` | 并发测试要防卡死 |

## 每日索引

- Day 39：goroutine 和 channel。
- Day 40：WaitGroup 和 errgroup。
- Day 41：Mutex、Cond、并发资源限制。
- Day 42：context cancel 唤醒等待。
- Day 43：并发测试。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Go Concurrency Patterns: Context](https://go.dev/blog/context)
- [Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines)
- [sync package](https://pkg.go.dev/sync)
- [golang.org/x/sync/errgroup](https://pkg.go.dev/golang.org/x/sync/errgroup)

