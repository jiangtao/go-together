# Week 10：配置、依赖注入与可测试性

对应天数：Day 54-58

## 本周目标

- 理解服务启动顺序、配置加载、依赖初始化、依赖注入和全局状态的测试成本。
- 能把一个难测函数拆成可测设计。
- 能说明 fake、stub、mock、patch 的取舍。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| app bootstrap | config -> deps -> server | 启动顺序影响可用性 |
| provider/DI container | constructor / provider set | Go 更偏显式依赖 |
| global config 难测 | 构造函数注入 | 减少全局状态 |
| Jest mock function | fake interface | 长期优先小接口 |
| 可测试性方案 | 拆依赖、纯函数、接口边界 | 测试能力来自设计 |

## 每日索引

- Day 54：配置中心和启动顺序。
- Day 55：依赖注入和 Wire 思路。
- Day 56：全局状态和测试困难。
- Day 57：mock 策略。
- Day 58：可测试性改造小演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Google Wire](https://github.com/google/wire)
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [testing package](https://pkg.go.dev/testing)

