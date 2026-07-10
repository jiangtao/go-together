# Day 18：code generation

English title: **Day 18: code generation**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English title: **Generating Go Code from Protobuf**

### 学习目标

理解 `.proto` 如何生成 Go message struct、client、server interface。今天结束时，你应该能安装或确认 `protoc-gen-go`、`protoc-gen-go-grpc`，生成 `.pb.go` 与 `_grpc.pb.go`，并能指出哪些代码可以读、哪些代码不能手改。

### Node.js 对照

Node.js 里 gRPC/protobuf 可能使用动态加载 `.proto`，也可能生成 TypeScript 类型。Go 社区更常见的是生成静态 Go 代码：

- `.pb.go`：message、enum、字段访问方法、序列化相关 glue。
- `_grpc.pb.go`：client interface、server interface、registration glue。

心智迁移重点：生成代码是 contract 的编译产物。你读它来理解边界，但业务逻辑写在自己的 server/service 里。

### Go 核心心智

code generation 不是一次性脚本，而是工程约定：

- 生成命令要可重复，写进 Makefile、README note 或脚本。
- 生成目录要稳定，避免 import path 随机器变化。
- generated files 不手改；修改 `.proto` 后重新生成。
- 生成出的 server interface 决定 Day 19 unary server 要实现哪些方法。
- `go test ./...` 要能编译 generated package，证明 module/import 配置正确。

### 实践步骤

1. 确认 `protoc` 已安装：`protoc --version`。
2. 安装 Go 插件：`protoc-gen-go` 和 `protoc-gen-go-grpc`。
3. 确认 `$GOBIN` 或 `$GOPATH/bin` 在 `PATH` 中。
4. 运行生成命令，生成 `.pb.go` 和 `_grpc.pb.go`。
5. 打开生成文件，只观察 message struct、`TripServiceClient`、`TripServiceServer`、`RegisterTripServiceServer`。
6. 把生成命令记录到 `Makefile` 或 README note，确保之后任何人能重复生成。
7. 跑 `go test ./...`，验证生成代码 import path 和依赖正确。

推荐命令：

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
```

### 建议文件

- `proto/trip/v1/trip.pb.go`：message 生成代码。
- `proto/trip/v1/trip_grpc.pb.go`：gRPC client/server 生成代码。
- `Makefile`：记录 `proto` 或 `generate` 目标；本切片任务不要求你现在新增。
- `README.md` 或课程笔记：记录生成命令；本切片任务不要求你现在新增。

### 测试/验证命令

```bash
protoc --version
protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto
go test ./...
```

推荐使用 source-relative，避免生成路径意外漂移：

```bash
protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
go test ./...
```

### 检索问题

- `.pb.go` 和 `_grpc.pb.go` 分别负责什么？
- 为什么 generated code 不应该手改？
- `paths=source_relative` 会怎样影响生成文件位置？
- Day 19 实现 unary server 时，应该实现哪个生成 interface？

### 常见误区

- 只生成 `.pb.go`，忘记生成 `_grpc.pb.go`，导致没有 server/client interface。
- 手改 generated file 修 bug，下一次生成全部丢失。
- 生成命令只存在 shell history，后续无法复现。
- `go_package`、生成路径、module path 不一致，造成 import 混乱。
- 生成成功后不跑 `go test ./...`，直到后续实现 server 才发现编译问题。

## Day 13-18 阶段验收

完成本切片后，你应该能不看笔记回答：

- sqlc 为什么是 SQL-first，而不是 ORM？
- repository wrapper 的边界是什么，为什么不让 generated type 扩散？
- 事务失败时，如何用测试证明没有半成品数据？
- no rows、unique conflict、context cancel 分别应该怎样进入业务错误体系？
- proto field number、`package`、`go_package` 各自影响什么？
- `.pb.go` 和 `_grpc.pb.go` 如何为 Day 19 的 unary server 铺路？

阶段最小验证：

```bash
sqlc generate
protoc \
  --go_out=. \
  --go_opt=paths=source_relative \
  --go-grpc_out=. \
  --go-grpc_opt=paths=source_relative \
  proto/trip/v1/trip.proto
go test ./...
```
