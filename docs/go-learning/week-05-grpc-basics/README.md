# Week 05：gRPC/protobuf 基础

对应天数：Day 29-33

## 本周目标

- 理解 proto message、service、rpc、field number。
- 理解 `.proto` 和生成 Go 代码的关系。
- 能解释 gRPC server 注册、client metadata 和错误状态码。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| OpenAPI/GraphQL schema | `.proto` | proto 是跨语言契约 |
| TS generated client type | `.pb.go` | 生成代码只读不手改 |
| RPC route 注册 | RegisterServer | 服务实现要注册到 server |
| HTTP headers | gRPC metadata | metadata 通过 context 传递 |
| HTTP status | `codes` / `status.Error` | RPC 错误有自己的状态模型 |

## 每日索引

- Day 29：读 proto 基础。
- Day 30：proto 到 Go 代码。
- Day 31：gRPC server 注册。
- Day 32：gRPC client 和 metadata。
- Day 33：gRPC 错误和状态码。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [gRPC Go 文档](https://grpc.io/docs/languages/go/)
- [Protocol Buffers 文档](https://protobuf.dev/)
- [grpc package](https://pkg.go.dev/google.golang.org/grpc)

