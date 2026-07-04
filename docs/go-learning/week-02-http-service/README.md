# Week 02：HTTP 服务、路由与 DTO

对应天数：Day 8-14

## 本周目标

- 能写一个最小 HTTP 服务。
- 能理解路由、参数绑定、DTO/domain 转换、错误映射、中间件和日志字段。
- 能用公开代称描述一个“小型业务接口”。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| Express/Koa router | Go router / handler | Go handler 更显式，框架不是核心 |
| `req.body` | request struct + JSON bind | 参数错误要显式处理 |
| Controller DTO | DTO/domain converter | 外部协议模型和内部业务模型分开 |
| Error middleware | error wrapping + mapping | 内部错误转外部错误 |
| request id middleware | middleware chain | 中间件顺序会影响行为 |

## 每日索引

- Day 8：HTTP 服务和路由。
- Day 9：JSON bind 和参数校验。
- Day 10：DTO/domain 转换。
- Day 11：错误包装和错误映射。
- Day 12：middleware 和 trace id。
- Day 13：日志和上下文。
- Day 14：第二周业务小练习。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [net/http package](https://pkg.go.dev/net/http)
- [encoding/json package](https://pkg.go.dev/encoding/json)
- [Go 官方 Web 应用示例](https://go.dev/doc/articles/wiki/)
- [Let's Go](https://lets-go.alexedwards.net/)

