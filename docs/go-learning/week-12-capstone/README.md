# Week 12：独立小功能演练与最终复盘

对应天数：Day 64-68

## 本周目标

- 选择一个脱敏的小功能范围。
- 写设计和测试计划。
- 完成核心逻辑、接入调用链、交付说明和最终复盘。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| scope 控制 | 限制改动层数和风险面 | 小功能也要有边界 |
| 测试计划 | 正常、异常、边界、兼容、观测性 | 先列行为再写实现 |
| service 核心逻辑 | 先写纯逻辑 | 降低 handler/repo 干扰 |
| controller/service/repo 接入 | handler/service/repo/external | 每层类型和错误分支都要检查 |
| PR/MR 交付 | 测试命令、风险、回滚 | 交付必须能复核 |

## 每日索引

- Day 64：选题和范围控制。
- Day 65：设计和测试计划。
- Day 66：实现核心逻辑。
- Day 67：接入 handler/repo/external。
- Day 68：交付说明和最终复盘。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [Learn Go with Tests](https://quii.gitbook.io/learn-go-with-tests/)

