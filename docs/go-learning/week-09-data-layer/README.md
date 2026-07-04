# Week 09：数据层、缓存与错误分类

对应天数：Day 49-53

## 本周目标

- 理解 Redis key 设计、缓存序列化、SQL transaction、数据层错误分类。
- 能给 repository 补成功、miss、坏数据、下游错误四类测试。
- 能把底层错误映射成业务错误。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| key naming | key 生成函数 | key 设计要集中管理 |
| JSON schema 演进 | struct tag + zero value | 兼容老数据要测试 |
| ORM transaction | `Begin` / `Commit` / `Rollback` | 事务边界显式 |
| DB error -> service error | error classification | 底层错误要转业务语义 |
| repo branch coverage | table-driven tests | 分支覆盖要数据化 |

## 每日索引

- Day 49：Redis key 设计。
- Day 50：缓存序列化。
- Day 51：SQL transaction。
- Day 52：数据层错误分类。
- Day 53：repo 层小演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Accessing relational databases](https://go.dev/doc/database/)
- [database/sql package](https://pkg.go.dev/database/sql)
- [encoding/json package](https://pkg.go.dev/encoding/json)
- [Learn Go with Tests](https://quii.gitbook.io/learn-go-with-tests/)

