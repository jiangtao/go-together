# Day 03：data structures I: array / slice / capacity / copy

English title: **Day 03: data structures I: array / slice / capacity / copy**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
