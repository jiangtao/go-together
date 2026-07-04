# Week 01：Go 基础与 Node.js 心智迁移

对应天数：Day 1-7

## 本周目标

- 建立 `go.mod`、package、函数、struct、slice、map、error、context 的基础认识。
- 用 Node.js/TypeScript 经验理解 Go 的基本表达。
- 能写最小 Go 函数、测试和一页启动链路笔记。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| `package.json` | `go.mod` | Go module 是编译和依赖边界 |
| `npm test` | `go test ./...` | 测试是 Go 工具链内置能力 |
| TS `type/interface` | `struct` / `interface` | Go 类型影响导出、编译和测试 |
| `try/catch` | `if err != nil` | 错误是显式返回值 |
| `AbortController` | `context.Context` | 取消和超时沿调用链传递 |

## 每日索引

- Day 1：Go 环境、module、运行、测试。
- Day 2：变量、slice、map、struct。
- Day 3：函数、多返回值、error。
- Day 4：package、import、internal。
- Day 5：context、defer、HTTP client。
- Day 6：单元测试和 table-driven tests。
- Day 7：第一周复盘和小型服务启动链路。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Go Getting Started](https://go.dev/doc/tutorial/getting-started)
- [A Tour of Go](https://go.dev/tour/)
- [Go by Example](https://gobyexample.com/)
- [Learn Go with Tests](https://quii.gitbook.io/learn-go-with-tests/)

