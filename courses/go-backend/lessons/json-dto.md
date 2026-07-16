# Day 08：JSON DTO

English title: **Day 08: JSON DTO**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

把 Node.js 自动 body parser、class-validator、DTO class 的心智迁移到 Go 显式 `encoding/json` decode、struct tag 和 DTO/domain 转换。当天结束时，你应该能写出 `POST /trips` 的 request DTO、response DTO、转换函数和 JSON handler tests。

当天最小能力：

- 定义 `CreateTripRequest`。
- 定义 `TripResponse`。
- 使用 `json.Decoder` 解码 request body。
- 明确 unknown field 策略。
- 把 DTO 转成 domain/service input，再把 domain 转成 response DTO。

### Node.js 对照

Node.js 里经常这样做：

```ts
app.use(express.json())

class CreateTripDto {
  @IsString()
  name: string
}
```

Go 没有默认帮你做 body parser，也不会自动执行 class decorator。HTTP body 是 stream，decode 是显式动作；struct tag 是 JSON 边界协议；校验和转换是你要主动写出来的代码。

### Go 核心心智

DTO 是协议边界，不是 domain。`json:"name"` 这种 tag 表示外部 JSON contract；domain struct 应该表达业务语义。`omitempty` 不是“少输出一点更干净”，它会改变调用方观察到的语义：空 slice 是 `[]` 还是字段缺失，`0` 是有效值还是未提供，都要主动决定。

关键判断：

- request DTO 面向外部输入，可以使用 pointer 字段区分“未提供”和“提供了零值”。
- response DTO 面向外部输出，字段应该稳定、清晰。
- unknown field 是兼容性策略：开放会更宽松，禁止会更早暴露客户端拼写错误。
- decode 后要检查是否存在 trailing JSON，避免 `{"name":"A"}{"name":"B"}` 被悄悄接受。

### 实践步骤

1. 定义 `CreateTripRequest`，包含 `Name`、可选 `Members`、可选 `Tags`。
2. 定义 `TripResponse`，只暴露 HTTP response 需要的字段。
3. 在 create handler 中使用 `json.NewDecoder(r.Body)`。
4. 调用 `decoder.DisallowUnknownFields()`，先选择严格策略，并写测试证明未知字段会失败。
5. 对 body 大小加一个学习用限制，例如 `http.MaxBytesReader`，避免无限读取。
6. 解码 DTO 后调用 `toCreateTripInput()`，在转换里做 name trim、空值校验、members/tags 规范化。
7. service 返回 domain `Trip` 后，用 `fromTrip()` 转成 `TripResponse`。
8. 写 JSON handler tests：合法 body、malformed JSON、unknown field、缺少 name、中英文 name、空 members/tags。

### 建议文件

- `internal/triphttp/dto.go`：request/response DTO。
- `internal/triphttp/json.go`：`decodeJSON`、`writeJSON` 等边界 helper。
- `internal/triphttp/handlers.go`：`POST /trips` handler。
- `internal/triphttp/dto_test.go`：DTO 转换测试。
- `internal/triphttp/handlers_test.go`：JSON request/response 测试。

### 测试/验证命令

```sh
gofmt -w ./internal/triphttp
go test ./internal/triphttp -run 'Test(CreateTrip|Decode|DTO)'
go test ./...
```

可选手动验证：

```sh
curl -i -X POST http://localhost:8080/trips \
  -H 'content-type: application/json' \
  -d '{"name":"上海 Go 周末","members":[{"name":"jt"}],"tags":["go","backend"]}'
```

### 检索问题

- `json.Decoder` 和 `json.Unmarshal` 在处理 HTTP request body 时有什么差异？
- `DisallowUnknownFields` 解决了什么问题，又可能带来什么 API 演进成本？
- `omitempty` 对 `nil slice`、空 slice、零值数字、空字符串分别有什么影响？

### 常见误区

- 直接把 domain struct 暴露为 HTTP JSON，导致内部字段和外部 contract 绑死。
- 把所有字段都设成 `omitempty`，让客户端无法区分“空值”和“字段不存在”。
- 只测试成功 JSON，不测试 malformed JSON 和 unknown field。
- decode 完第一段 JSON 后不检查尾部内容。
- 在 DTO tag 中随手改字段名，却没有意识到这是外部协议变更。
