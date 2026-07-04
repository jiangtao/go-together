# Week 04：低风险业务改动演练

对应天数：Day 22-28

## 本周目标

- 用脱敏方式拆一个小需求。
- 从 route/handler 追到 service/repository/external adapter。
- 练习测试先行、最小实现、review 自查和交付说明。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| 从需求文档拆任务 | 输入、输出、改动点、测试点 | Go 改动也先拆边界 |
| route -> controller -> service | route -> handler -> service -> repo | 类型和错误分支更显式 |
| failing Jest test | failing Go test | 先锁行为，再最小实现 |
| PR 自查 | gofmt、命名、错误、测试 | Go review 很看重小而清楚 |
| MR/PR 描述 | 验证命令、风险、回滚 | 交付需要可复核 |

## 每日索引

- Day 22：读一个真实或模拟需求。
- Day 23：追踪一个接口。
- Day 24：设计一个低风险小改动。
- Day 25：测试先行。
- Day 26：实现低风险小改动。
- Day 27：代码清理和 review 准备。
- Day 28：短期交付演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [Effective Go](https://go.dev/doc/effective_go)
- [Learn Go with Tests](https://quii.gitbook.io/learn-go-with-tests/)

