# Day 1-6：基础心智与数据结构

English title: **Days 1-6: Foundations and Data Structures**

本切片服务于 36 天 Go 学习主线的第一阶段：让已有 Node.js / TypeScript 后端经验的学习者，先建立 Go 的工程边界、值模型、数据结构、错误处理、小接口和 context 心智。Trip 是贯穿案例，只用于让练习命名稳定，不是产品项目。

建议把 Day 1-6 都写在一个临时 Go module 里，持续演进同一组 `Trip`、`Member`、`Stop`、`TripStore` 类型。每天结束时必须有可运行代码和验证命令输出；如果命令失败，要先定位失败原因，再进入下一天。

## Day 1：module / package / toolchain

### 学习目标

- 能解释 `go.mod`、module path、package name、import path 的关系。
- 能用 `cmd/` 放可执行入口，用 `internal/` 放不希望被外部导入的学习代码。
- 能用 `go run`、`go test`、`gofmt` 完成最小开发循环。
- 能区分 Go 的导出规则和 TypeScript 的 `export` 心智。

### Node.js 对照

- Node.js 的 `package.json` 描述包名、脚本和依赖；Go 的 `go.mod` 描述 module 根路径和依赖版本。
- Node.js 运行入口常来自 `npm scripts` 或 `node dist/index.js`；Go 常把可执行程序入口放在 `cmd/<name>/main.go`，由 `package main` 和 `func main()` 决定。
- TypeScript 用 `export` / `private` / 文件路径组织可见性；Go 用首字母大小写控制 package 外可见性，用 `internal/` 让编译器强制边界。
- Node.js 可以在运行期发现很多模块错误；Go 会在编译期检查 import、未使用变量、未使用包和可见性。

### Go 核心心智

- `module` 是依赖管理和 import 根路径，不等于一个 package。
- `package` 是编译单元，同一目录下的 `.go` 文件必须声明同一个 package。
- `package main` 生成可执行文件；普通 package 供其他 package 导入。
- `internal/` 不是约定，而是 Go toolchain 执行的导入限制。
- Go 不鼓励先搭复杂框架；第一天只需要让一个小包被 `main` 调用，并能被测试覆盖。

### 实践步骤

1. 新建一个临时练习目录，例如 `trip-foundations/`，运行 `go mod init example.com/trip-foundations`。
2. 创建 `cmd/trip/main.go`，声明 `package main`，在 `main()` 中调用 `internal/trip` 包。
3. 创建 `internal/trip/trip.go`，先实现一个导出函数 `Describe() string`，返回类似 `trip learning starts` 的字符串。
4. 为 `Describe` 写最小测试，确认 `go test ./...` 能发现并执行 `internal/trip` 的测试。
5. 把 `Describe` 临时改成 `describe`，观察 `cmd/trip/main.go` 的编译错误，再改回导出函数。
6. 增加一个未使用变量或未使用 import，观察 Go 编译器如何把这类问题当成错误处理。
7. 运行 `gofmt -w .`，理解格式化不是团队偏好，而是 Go 生态默认协作方式。

### 建议文件

- `go.mod`
- `cmd/trip/main.go`
- `internal/trip/trip.go`
- `internal/trip/trip_test.go`

### 测试/验证命令

```sh
go version
go mod tidy
gofmt -w .
go run ./cmd/trip
go test ./...
```

### 检索问题

- 不看笔记解释：`module`、`package`、`cmd/`、`internal/` 分别解决什么问题？
- 为什么 `cmd/trip/main.go` 里的 package 必须是 `main`？
- Go 为什么把未使用 import 和未使用变量视为编译错误？
- 首字母大小写如何影响 package API？

### 常见误区

- 把 module 当成 package。一个 module 通常包含多个 package，import 的最小单位是 package。
- 在第一天就搭 HTTP、数据库或框架。此处目标是工具链和边界心智，不是做服务。
- 用 Node.js 的文件级导出心智理解 Go。Go 的可见性发生在 package 边界。
- 以为 `internal/` 只是目录习惯。它是编译器会检查的真实边界。

## Day 2：value model / struct / zero value

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

## Day 3：data structures I: array / slice / capacity / copy

### 学习目标

- 能区分 Go array 和 slice，而不是把它们都理解成 JS Array。
- 能解释 `len`、`cap`、底层数组、子切片共享和 `append` 重新分配。
- 能用 `copy` 做防御性复制，避免外部调用方修改内部 itinerary。
- 能为 `AddStop`、`InsertStop`、`RemoveStop`、`CloneStops` 写覆盖边界的测试。

### Node.js 对照

- JavaScript `Array` 是动态对象，`push`、`splice`、`slice` 都隐藏了大量运行期行为。
- Go array 是固定长度值，`[3]Stop` 和 `[4]Stop` 是不同类型。
- Go slice 是三元描述符：指向底层数组的指针、长度、容量；它不是数组本身。
- JavaScript 的 `slice()` 常被用来浅拷贝数组；Go 需要显式 `make` + `copy`，或使用合适的 append/copy 写法。

### Go 核心心智

- array 用在固定长度、值语义明确的场景；业务列表通常使用 slice。
- slice 传参会复制 slice header，但底层数组仍可能共享。
- `append` 如果容量足够，可能直接写入原底层数组；容量不足时才分配新数组。
- 子切片保留对原底层数组的引用，可能导致数据被意外修改，也可能延长大数组生命周期。
- 对外返回内部 slice 时，要么返回副本，要么明确声明调用方可以修改它。

### 实践步骤

1. 定义 `Stop`，至少包含 `City string`、`Day int`。
2. 在 `Trip` 上增加 `stops []Stop` 或 `Stops []Stop`。如果想练封装，优先使用未导出字段 `stops`。
3. 实现 `AddStop(stop Stop) error`：校验城市非空、天数为正，再 append。
4. 实现 `InsertStop(index int, stop Stop) error`：覆盖插入开头、中间、末尾和越界。
5. 实现 `RemoveStop(index int) (Stop, error)`：返回被删除的 stop，并保持剩余顺序。
6. 实现 `CloneStops() []Stop`：用 `make([]Stop, len(t.stops))` 和 `copy` 返回副本。
7. 写 `len/cap` 观察测试：先用 `make([]Stop, 0, 2)`，连续 append 三次，记录容量变化。
8. 写子切片共享测试：从 `stops[:1]` 修改元素，证明原 slice 的同一元素也会变化。
9. 写防御性复制测试：调用 `CloneStops()` 后修改返回值，原 `Trip` 内部 stops 不应变化。
10. 写一个 array 小测试：声明 `[2]Stop`，赋值给另一个变量后修改副本，证明 array 赋值是值复制。

### 建议文件

- `internal/trip/itinerary.go`
- `internal/trip/itinerary_test.go`
- `internal/trip/slice_capacity_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'Test.*Stop|TestSlice|TestArray' -v
```

### 检索问题

- 为什么 Go 里把 slice 暴露给调用方，常常等于把内部可变状态也暴露出去？
- `len` 和 `cap` 分别描述 slice 的哪一部分？
- `append` 什么时候会影响原 slice？什么时候会得到新的底层数组？
- `copy(dst, src)` 的返回值是什么意思？当 `dst` 比 `src` 短时会发生什么？

### 常见误区

- 把 slice 当成“自动深拷贝数组”。slice 复制通常只是复制 header。
- 以为 `append` 永远不影响旧 slice。容量足够时，它可能复用同一个底层数组。
- 对子切片长期持有引用，导致大底层数组无法释放。
- 删除元素后忘记顺序要求。有些写法快但会打乱顺序，不适合 itinerary。
- 返回内部 slice 后又希望外部不能改。需要 `copy`，不能靠约定。

## Day 4：data structures II: map / set / index / string / rune

### 学习目标

- 能用 map 做 `MemberIndex`，理解 key 查询、zero value 和 comma-ok。
- 能用 `map[string]struct{}` 模拟 set，表达 tag 去重。
- 能解释 nil map 可读不可写，并为写入路径做初始化或 guard。
- 能区分 string、byte、rune，写出 rune-safe 的文本辅助函数。
- 能用表驱动测试覆盖 map、set、index、中文、emoji、ASCII 场景。

### Node.js 对照

- JavaScript `Map` / `Set` 是内置集合类型；Go 只有 map，set 通常用 map 模拟。
- JavaScript object 访问缺失 key 得到 `undefined`；Go map 访问缺失 key 得到 value 类型的 zero value，所以要用 comma-ok 区分。
- JavaScript string API 通常按 UTF-16 code unit 工作；Go string 是只读 byte 序列，`len(s)` 返回字节数。
- TypeScript 可以用对象索引提升查找效率；Go 里同样常用 map 建索引，但要明确何时重建、何时同步。

### Go 核心心智

- `value, ok := m[key]` 是 map 查询的基本动作；只看 value 会混淆“缺失”和“存在但值为 zero value”。
- nil map 可以安全读取，返回 zero value；但写入 nil map 会 panic。
- `map[T]struct{}` 适合 set，因为空 struct 不携带额外数据；如果需要可读性，也可以用 `map[T]bool`，但要知道差异。
- map 是引用语义类型，传参或赋值不会复制所有键值。
- string 不可变；按 byte 迭代会拆开多字节字符，按 `range` 迭代得到 rune。

### 实践步骤

1. 定义 `type MemberIndex map[string]Member`，实现 `NewMemberIndex(members []Member) MemberIndex`。
2. 实现 `HasMember(id string) bool`，必须使用 comma-ok，不要只比较 `Member{}`。
3. 实现 `FindMember(id string) (Member, bool)`，让调用方显式处理缺失。
4. 定义 `type TagSet map[string]struct{}`，实现 `NewTagSet(tags ...string) TagSet`，自动去重并跳过空 tag。
5. 实现 `AddTag(tag string) error`、`RemoveTag(tag string)`、`HasTag(tag string) bool`。如果 receiver 可能是 nil，要在写入前初始化或返回明确错误。
6. 写 nil map 测试：读取 nil `MemberIndex` 不 panic，写入 nil `TagSet` 的策略必须被测试固定。
7. 实现 `RuneCount(s string) int`，用 `for range` 或 `utf8.RuneCountInString`。
8. 实现 `FirstRune(s string) (rune, bool)`，空字符串返回 `false`。
9. 用表驱动测试比较 `len("Go")`、`len("北京")`、`len("Go北京")`、`len("🚄")` 与 rune count 的差异。
10. 写一个索引一致性测试：从 `[]Member` 建 `MemberIndex` 后，查找复杂度不在测试里度量，但行为必须稳定。

### 建议文件

- `internal/trip/member_index.go`
- `internal/trip/tag_set.go`
- `internal/trip/text.go`
- `internal/trip/member_index_test.go`
- `internal/trip/tag_set_test.go`
- `internal/trip/text_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'TestMemberIndex|TestTagSet|TestRune|TestString' -v
```

### 检索问题

- 为什么 Go 的 `len(string)` 不等于“用户看到的字符数”？
- map 查询为什么需要 comma-ok？不用时会混淆哪些情况？
- nil map 为什么能读不能写？这对构造函数和方法 receiver 有什么影响？
- 什么时候应该从 slice 构建 index？什么时候直接线性扫描更简单？
- `map[string]struct{}` 和 `map[string]bool` 分别有什么取舍？

### 常见误区

- 用 `m[key] == zeroValue` 判断 key 不存在。只要 value 类型有合法 zero value，这个判断就不可靠。
- 忘记初始化 map 就写入，导致 panic。
- 把 map 赋值当成深拷贝。多个变量可能指向同一张 map。
- 用 byte 下标截断中文或 emoji，导致非法 UTF-8 或显示异常。
- 为了“性能”过早建立索引。学习阶段先让索引服务于 map 心智和测试可见性。

## Day 5：error handling

### 学习目标

- 能从 Node.js `throw/catch` 心智迁移到 Go 的显式 `value, error` 返回。
- 能定义稳定的 sentinel error，并用 `errors.Is` 判断错误类别。
- 能用 `fmt.Errorf("%w", err)` 包装错误，同时保留错误链。
- 能区分错误类别、错误上下文和展示给外部协议层的错误信息。

### Node.js 对照

- Node.js 常用 exception、Promise rejection 或框架 error middleware 集中处理错误。
- Go 要求调用点显式检查 `err`，错误处理是正常控制流的一部分。
- JavaScript Error 通常靠 class、name、message 分类；Go 常用 sentinel error、自定义 error type、`errors.Is`、`errors.As`。
- Node.js stack trace 常被用于定位；Go 更强调在错误向上返回时补充当前上下文。

### Go 核心心智

- error 是值，不是异常；返回 error 不会自动中断程序。
- sentinel error 用来表达稳定类别，例如 `ErrTripNotFound`、`ErrInvalidTrip`。
- 错误消息可以变化，但错误类别一旦被上层依赖，就要保持稳定。
- 包装错误时使用 `%w`，否则 `errors.Is` / `errors.As` 无法穿透错误链。
- 领域层只表达领域错误，不要提前决定 HTTP status 或 gRPC code。

### 实践步骤

1. 在 `internal/trip` 定义 `var ErrTripNotFound = errors.New("trip not found")`。
2. 定义 `var ErrInvalidTrip = errors.New("invalid trip")`，用于可分类的校验失败。
3. 实现 `ValidateTripID(id string) error`：空 id 返回包装了 `ErrInvalidTrip` 的错误，并带上上下文。
4. 实现 `FindTrip(trips []Trip, id string) (Trip, error)`：找不到时返回包装了 `ErrTripNotFound` 的错误。
5. 实现一个 service 函数，例如 `GetTripName(trips []Trip, id string) (string, error)`，在调用 `FindTrip` 失败时继续包装上下文。
6. 写测试证明：错误文本包含上下文，但 `errors.Is(err, ErrTripNotFound)` 仍为 true。
7. 写测试证明：修改外层错误文字不应破坏错误类别判断。
8. 写测试区分 invalid id 和 not found，避免所有失败都返回同一个 error。

### 建议文件

- `internal/trip/errors.go`
- `internal/trip/find.go`
- `internal/trip/errors_test.go`
- `internal/trip/find_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'Test.*Error|TestFindTrip|TestValidateTripID' -v
```

### 检索问题

- 什么时候错误需要稳定类别？什么时候只需要补充上下文？
- `%w` 和 `%v` 包装 error 的结果有什么关键差异？
- 为什么领域层不应该直接返回 HTTP status？
- `errors.Is` 适合判断什么？`errors.As` 又适合什么？

### 常见误区

- 写了 `fmt.Errorf("find trip: %v", err)`，导致错误链断掉。
- 用字符串比较错误。错误消息是给人看的，类别判断应使用 `errors.Is` 或 `errors.As`。
- 把所有错误都做成 sentinel。只有上层需要稳定分类时才值得定义。
- 在低层吞掉错误，返回 zero value，让调用方无法知道失败原因。
- 错误信息缺少上下文，导致测试能过但调试时不知道哪一步失败。

## Day 6：small interface + context timeout

### 学习目标

- 能从“依赖完整对象”迁移到“由使用方定义小接口”的 Go 风格。
- 能定义 `TripStore`，让 service 依赖行为而不是具体数据库或内存实现。
- 能正确传递 `context.Context`，支持 timeout、deadline 和 parent cancel。
- 能用 fake store 测试 found、not found、invalid id、timeout、cancel 场景。

### Node.js 对照

- Node.js 常用 class、repository object、dependency injection container 或 mock library 替换依赖。
- Go 通常由调用方附近定义小接口，只声明当前函数真正需要的方法。
- Node.js 常用 AbortController、request timeout 或框架生命周期取消异步操作。
- Go 的 `context.Context` 是跨 API 边界传递取消信号、deadline 和 request-scoped value 的标准方式。

### Go 核心心智

- 接口越小，越容易 fake，越不容易把 service 绑死在具体实现上。
- Go interface 是隐式实现：类型不需要声明 `implements TripStore`。
- 接收 `context.Context` 的函数应该把 ctx 继续传下去，不要在内部偷换成 `context.Background()`。
- timeout 不是强制杀死 goroutine，而是协作式取消；被调用方必须主动监听 `ctx.Done()`。
- 创建带 timeout 的 context 后要 `defer cancel()`，释放 timer 和父子 context 关联资源。

### 实践步骤

1. 定义 `type TripStore interface { FindTrip(ctx context.Context, id string) (Trip, error) }`。接口放在 service 使用方附近。
2. 定义 `type Service struct { store TripStore }` 和 `NewService(store TripStore) Service`。
3. 实现 `Service.GetTrip(ctx context.Context, id string) (Trip, error)`：先校验 id，再调用 store。
4. 写 `fakeStore`，用 map 或函数字段返回指定结果，覆盖 found、not found、invalid id。
5. 实现 `slowStore`：在 `FindTrip` 中 `select` 等待 `time.After(delay)` 或 `<-ctx.Done()`。
6. 写 timeout 测试：`context.WithTimeout(context.Background(), 50*time.Millisecond)` 调用 200ms 的 `slowStore`，期望返回 `context.DeadlineExceeded`。
7. 写 parent cancel 测试：提前调用 `cancel()`，期望 service/store 迅速返回 `context.Canceled`。
8. 写一个反例式测试或注释：如果 store 内部改用 `context.Background()`，timeout 测试会卡住或失败。
9. 确认错误包装仍保留 context 错误类别：`errors.Is(err, context.DeadlineExceeded)` 必须为 true。

### 建议文件

- `internal/trip/service.go`
- `internal/trip/store.go`
- `internal/trip/service_test.go`
- `internal/trip/context_test.go`
- `internal/trip/fake_store_test.go`

### 测试/验证命令

```sh
gofmt -w .
go test ./...
go test ./internal/trip -run 'TestService|TestTripStore|TestContext|TestTimeout|TestCancel' -v
```

### 检索问题

- 为什么一个接收 `context.Context` 的小接口，比直接依赖完整 `*sql.DB` 更适合早期学习和测试？
- Go interface 为什么通常由使用方定义，而不是由实现方提前定义？
- `context.WithTimeout` 后为什么要 `defer cancel()`？
- `context.Canceled` 和 `context.DeadlineExceeded` 分别代表什么？
- 为什么业务函数内部不应该把传入的 ctx 替换成 `context.Background()`？

### 常见误区

- 在 package 顶层提前定义巨大接口，最后每个 fake 都要实现一堆无关方法。
- 把 interface 放在实现方，导致调用方被迫依赖更宽的能力集合。
- 函数签名接收了 ctx，但内部没有传给 store 或外部调用。
- timeout 测试只用 `time.Sleep`，没有检查 `errors.Is` 和返回耗时。
- 忘记 `defer cancel()`，让 timer 资源留到超时自然结束。
- 把 context 当成参数袋，塞业务必需参数。必需参数应该显式出现在函数签名里。

## 阶段收束：Day 1-6 应该形成的能力

完成这 6 天后，学习者应该能独立说明并写出以下内容：

- 一个最小 Go module，包含 `cmd/` 入口和 `internal/` 包边界。
- 一个有 zero value 语义、构造函数和 receiver 方法的 `Trip` 领域模型。
- 一组 slice itinerary helper，能解释 array、slice、capacity、append、copy 和 aliasing。
- 一组 map/set/index/string helper，能解释 comma-ok、nil map、set 模拟、string byte 与 rune。
- 一套稳定错误类别和错误包装测试。
- 一个依赖小接口和 context 的 service，并能用 fake store 验证 timeout 与 cancel。

下一阶段进入 HTTP 和 JSON 前，不要求 Trip 练习切片像产品一样完整；只要求这些基础心智能被代码和测试证明。
