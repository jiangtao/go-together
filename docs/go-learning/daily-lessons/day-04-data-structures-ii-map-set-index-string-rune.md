# Day 04：data structures II: map / set / index / string / rune

English title: **Day 04: data structures II: map / set / index / string / rune**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
