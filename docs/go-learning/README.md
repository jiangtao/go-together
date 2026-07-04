# Go 后端学习目录

这是一份按目录拆开的 Go 后端学习笔记框架，适合有 Node.js/TypeScript 后端经验的人使用。这里不放公司、内部仓库、内部服务、内部域名、真实路径或真实接口名；涉及真实工作时统一写成“目标业务系统”“真实业务仓库”“业务接口”“业务学习”。

## 使用方式

每天学习时按这个顺序写：

1. Node.js 里我以前怎么做。
2. Go 里这个能力怎么表达。
3. Go 和 Node.js 的本质差异是什么。
4. 业务学习里我应该去看哪一类代码。
5. 我今天写了什么 demo、测试或复盘。

## 目录

| 周次 | 目录 | 学习主题 |
|---|---|---|
| Week 01 | [week-01-go-fundamentals](week-01-go-fundamentals/README.md) | Go 基础、类型、错误、package |
| Week 02 | [week-02-http-service](week-02-http-service/README.md) | HTTP 服务、路由、参数、DTO |
| Week 03 | [week-03-data-and-testing](week-03-data-and-testing/README.md) | 缓存、SQL、测试隔离 |
| Week 04 | [week-04-business-practice](week-04-business-practice/README.md) | 低风险业务改动演练 |
| Week 05 | [week-05-grpc-basics](week-05-grpc-basics/README.md) | protobuf、gRPC 基础 |
| Week 06 | [week-06-grpc-business](week-06-grpc-business/README.md) | gRPC 业务链路、流式处理、兼容性 |
| Week 07 | [week-07-concurrency](week-07-concurrency/README.md) | goroutine、channel、context、并发测试 |
| Week 08 | [week-08-flow-control](week-08-flow-control/README.md) | 限流、singleflight、流式 I/O、并发安全 |
| Week 09 | [week-09-data-layer](week-09-data-layer/README.md) | Redis key、缓存序列化、事务、错误分类 |
| Week 10 | [week-10-di-testability](week-10-di-testability/README.md) | 配置、依赖注入、可测试性 |
| Week 11 | [week-11-observability](week-11-observability/README.md) | 日志、metrics、trace、告警 |
| Week 12 | [week-12-capstone](week-12-capstone/README.md) | 独立小功能演练与最终复盘 |

## 每周复盘问题

1. 这周我能解释哪个 Node.js -> Go 的差异。
2. 这周我写了哪些 Go demo 或测试。
3. 这周我能读懂哪类业务代码。
4. 这周最容易混淆的错误处理或并发场景是什么。
5. 下周最需要补的基础是什么。

## 总参考资料

- [Go 官方学习入口](https://go.dev/learn/)
- [A Tour of Go](https://go.dev/tour/)
- [Effective Go](https://go.dev/doc/effective_go)
- [Go by Example](https://gobyexample.com/)
- [Learn Go with Tests](https://quii.gitbook.io/learn-go-with-tests/)
- [The Go Programming Language](https://www.gopl.io/)
- [gRPC Go 文档](https://grpc.io/docs/languages/go/)
- [Protocol Buffers 文档](https://protobuf.dev/)

