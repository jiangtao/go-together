# Day 17：proto contract

English title: **Day 17: proto contract**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

English title: **Contract-first Protobuf Design**

### 学习目标

从 REST DTO 心智迁移到 contract-first 的 `.proto` 设计。今天结束时，你应该能写出 `TripService.CreateTrip` 的 proto contract，理解 field number、message、service、`go_package` 的稳定性，并能做一次人工 proto review。

### Node.js 对照

在 Node.js REST API 中，contract 常散落在：

- OpenAPI spec。
- TypeScript DTO。
- runtime validator schema。
- controller 输入输出样例。

Protobuf 把 contract 放在 `.proto` 文件里：字段编号决定 wire compatibility，service 定义决定 RPC 形状，生成代码只是 contract 的语言投影。你不是先写 handler 再补类型，而是先稳定协议，再生成 Go 边界。

### Go 核心心智

proto contract 的关键不是“字段写全”，而是“兼容性可演进”：

- field number 是 wire contract，比字段名更敏感。
- 已删除字段要 reserved，不能随意复用编号。
- `go_package` 决定生成代码 import path，必须和 module/package 规划一致。
- proto message 不是 domain model；它是跨进程协议 DTO。
- request/response 要围绕 RPC 用例设计，不要直接暴露 DB row。

### 实践步骤

1. 创建 `proto/trip/v1/trip.proto`。
2. 声明 `syntax = "proto3";`、`package trip.v1;`。
3. 设置 `option go_package`，指向当前 Go module 下的生成包路径。
4. 定义 `TripService`，先只放 `rpc CreateTrip(CreateTripRequest) returns (CreateTripResponse);`。
5. 定义 `CreateTripRequest`，包含 name、owner_user_id、可选 members/tags 等最小字段。
6. 定义 `CreateTripResponse`，返回 trip message 或明确的 id/name/status。
7. 定义 `Trip` message，字段编号从稳定核心字段开始。
8. 人工 review：字段编号是否稳定、命名是否清楚、是否泄露 DB/internal 字段、是否为未来删除预留 reserved 策略。

示例骨架：

```proto
syntax = "proto3";

package trip.v1;

option go_package = "github.com/your/module/proto/trip/v1;tripv1";

service TripService {
  rpc CreateTrip(CreateTripRequest) returns (CreateTripResponse);
}

message CreateTripRequest {
  string name = 1;
  string owner_user_id = 2;
}

message CreateTripResponse {
  Trip trip = 1;
}

message Trip {
  string id = 1;
  string name = 2;
  string status = 3;
}
```

### 建议文件

- `proto/trip/v1/trip.proto`：proto contract。
- `docs/go-learning/proto-review-note.md`：仅在主会话允许新增学习笔记时再创建；本切片任务不要擅自新增。
- `internal/trip/service.go`：后续 gRPC handler 将调用的 use case 边界，今天只作为 contract review 参照。

### 测试/验证命令

今天的核心验证是 proto review。若本机已安装 protoc 和插件，也可以先跑格式/生成预检：

```bash
protoc --version
protoc --go_out=. --go-grpc_out=. proto/trip/v1/trip.proto
```

如果还没有安装插件，不要跳过 review，先用文本检查：

```bash
grep -nE 'syntax|package|go_package|service|rpc|message|= [0-9]+' proto/trip/v1/trip.proto
```

### 检索问题

- 为什么 proto 字段编号比字段名更敏感？
- `go_package` 和 proto `package` 分别解决什么问题？
- 为什么 proto message 不应该直接等同于 domain struct 或 DB row？
- 什么时候应该新增字段，什么时候应该 reserved 旧字段？

### 常见误区

- 随意重排或复用 field number，破坏 wire compatibility。
- 让 proto 暴露数据库内部字段，比如自增主键策略、审计列细节。
- 把 REST DTO 原样搬进 proto，没有重新思考 RPC 语义。
- `go_package` 写错，导致生成代码 import path 混乱。
- 为未来想象加入大量字段，增加 contract 负担。
