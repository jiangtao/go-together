# Week 08：限流、请求合并与流式 I/O

对应天数：Day 44-48

## 本周目标

- 理解限流、singleflight、`io.Reader`、`io.Copy`、atomic、`sync.Map`。
- 能说明什么时候要限制并发、合并重复请求、流式处理文件。
- 能写一页并发控制说明。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| `p-limit` | rate limiter | 控制请求速率和突发量 |
| 请求合并 | singleflight | 防止重复加载和缓存击穿 |
| stream pipe | `io.Copy` / Reader / Writer | 流式处理避免一次性读入 |
| 原子计数 | `sync/atomic` | 共享状态要并发安全 |
| Map 并发访问 | mutex / `sync.Map` | 普通 map 不能随意并发读写 |

## 每日索引

- Day 44：rate limiter。
- Day 45：singleflight。
- Day 46：`io.Reader` 和文件流。
- Day 47：atomic 和 `sync.Map`。
- Day 48：并发综合小演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [rate package](https://pkg.go.dev/golang.org/x/time/rate)
- [singleflight package](https://pkg.go.dev/golang.org/x/sync/singleflight)
- [io package](https://pkg.go.dev/io)
- [Data Race Detector](https://go.dev/doc/articles/race_detector)

