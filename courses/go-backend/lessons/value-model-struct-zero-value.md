# Day 02：value model / struct / zero value

English title: **Day 02: value model / struct / zero value**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

### 学习目标

- 能用 `struct` 定义 `Trip`、`Member`、`TripStatus` 等领域值。
- 能解释 zero value 与 JavaScript `undefined` / `null` 的差异。
- 能根据是否修改接收者选择 value receiver 或 pointer receiver。
- 能写构造函数表达必要业务约束，但不过度初始化所有字段。

### Node.js 对照

- TypeScript interface 多数时候描述对象形状；Go struct 是具体内存布局和字段集合。
- JavaScript object 默认按引用传递；Go struct 赋值默认复制值，除非显式使用指针、slice、map 等引用语义类型。
- Node.js 常用 `undefined` 表示缺失；Go 每个类型都有 zero value，例如 `string` 是 `""`，`int` 是 `0`，`bool` 是 `false`。
- TypeScript method 常隐式修改对象；Go receiver 明确暴露方法是复制值还是修改原对象。

### Go 核心心智

- zero value 是 Go 的设计中心之一：变量声明后立刻可用，但业务语义必须由你解释清楚。
- `struct` 的字段不应该为了“看起来完整”而填假值；只有必要约束放进构造函数。
- value receiver 适合不修改状态的小值方法；pointer receiver 适合修改状态、避免复制大结构或保持方法集合一致。
- slice、map 字段本身带引用语义：即使外层 struct 被复制，内部数据仍可能共享。

### 实践步骤

1. 定义 `type TripStatus string`，提供 `TripStatusDraft`、`TripStatusActive`、`TripStatusArchived`。
2. 定义 `Member`，至少包含 `ID string`、`Name string`、`Role string`。
3. 定义 `Trip`，至少包含 `ID string`、`Name string`、`Status TripStatus`、`Members []Member`。
4. 实现 `NewTrip(id, name string) (Trip, error)`，只校验 `id` 和 `name` 不能为空，并给出明确初始状态。
5. 实现 `IsActive() bool`，使用 value receiver，测试它不会修改 `Trip`。
6. 实现 `Rename(name string) error`，使用 pointer receiver，测试成功改名和空名字失败。
7. 实现 `AddMember(member Member) error`，先只做最小校验，再追加到 `Members`。
8. 写一个测试专门比较 value receiver 和 pointer receiver：调用后原值是否变化必须一眼可见。

### 建议文件

- `internal/trip/domain.go`
- `internal/trip/domain_test.go`
- `internal/trip/validation.go`，如果校验逻辑开始变多再拆出

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'TestTrip|TestMember' -v
```

### 检索问题

- Go 的 zero value 为什么既方便，又会让领域建模变得更需要主动说明？
- value receiver 和 pointer receiver 的选择会如何影响调用方观察到的状态？
- `nil` slice 和空 slice 在 `len`、`append`、JSON 输出上可能有什么差异？
- 构造函数应该保证哪些不变量？哪些字段可以留给后续方法自然填充？

### 常见误区

- 把 zero value 当成 bug。很多 Go 类型的 zero value 是可用状态，但领域语义必须写清楚。
- 对所有方法都使用 pointer receiver。小值、只读方法可以用 value receiver；同一个类型的方法集合也要保持一致。
- 复制 struct 后忽略内部 slice/map 共享问题。外层复制不等于深拷贝。
- 在构造函数里塞满默认值，掩盖了真实业务状态。
