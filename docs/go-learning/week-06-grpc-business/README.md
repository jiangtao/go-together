# Week 06：gRPC 业务链路与兼容性

对应天数：Day 34-38

## 本周目标

- 能从 proto 方法追到 Go 实现。
- 理解流式响应、代码生成入口和 proto 兼容性。
- 能写一页脱敏 RPC 接口链路说明。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| 从 API schema 追实现 | proto -> generated code -> implementation | 链路更依赖生成代码 |
| Node stream | `io.Reader` / streaming RPC | 大响应要控制内存 |
| npm codegen script | Makefile/protoc | 生成入口要清楚 |
| schema upgrade | proto 兼容性 | 字段编号和语义不能随便改 |
| API 调用链文档 | RPC 调用链说明 | 文档要写协议到实现 |

## 每日索引

- Day 34：追踪一个 gRPC 方法。
- Day 35：流式响应概念。
- Day 36：代码生成入口。
- Day 37：proto 兼容性。
- Day 38：gRPC/protobuf 小演练。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Protocol Buffers Language Guide](https://protobuf.dev/programming-guides/proto3/)
- [gRPC Go Quick start](https://grpc.io/docs/languages/go/quickstart/)
- [io package](https://pkg.go.dev/io)

