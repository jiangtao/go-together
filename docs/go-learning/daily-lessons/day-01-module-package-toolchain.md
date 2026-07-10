# Day 01：module / package / toolchain

English title: **Day 01: module / package / toolchain**

返回：[每日课程目录](README.md) | 主教程：[node-to-go-36-day-course.md](../node-to-go-36-day-course.md)

本文件只服务当天学习。今天只完成今天的目标，不提前展开后续天数，避免主题互相干扰。

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
