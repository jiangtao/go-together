# Go 后端 Day 级学习执行计划

> 生成日期：2026-06-12
> 来源计划：`docs/go-backend-learning-short-mid-term-plan.md`
> 目标：按天执行，先在 4 周内达到能接低风险 Go 后端业务，再用 8 周进入中等复杂度功能。

## 1. 使用方式

这份计划默认你每天有：

- Go 主线学习：2 小时。
- 算法题：额外 20-30 分钟，题目自选。
- 背景经验：有 Node.js 后端经验，但 Go 偏小白。
- 业务目标：能逐步读懂并接入业务后端。

每天固定节奏：

```text
00:00-00:10  复习昨天，打开今天目标
00:10-00:25  先用 Node.js 类比理解今天主题
00:25-00:45  学 Go 的真正差异，跟敲最小例子
00:45-01:25  动手练习或推进小项目
01:25-01:45  阅读 weboffice-backend 对应代码，找真实落点
01:45-02:00  写测试、跑命令、记录 Node -> Go 迁移复盘
额外 20-30 分钟  算法题，用 Go 写并补测试
```

Node.js 对照学习法：

```text
先问：Node.js 里我以前怎么做？
再问：Go 里这个能力的表达方式是什么？
重点问：Go 和 Node.js 真正不一样的地方在哪里？
最后问：weboffice-backend 里哪里有真实例子？
```

每天复盘模板：

```text
Day X

今天的 Node.js 类比：
今天学到的 Go 知识：
今天和 Node.js 最大的差异：
今天在 weboffice-backend 找到的真实落点：
今天读过的仓库路径：
今天写了什么代码或测试：
今天算法题的复杂度：
明天最需要补的点：
```

推荐本地练习目录：

```text
$HOME/Places/personal/go-together
```


仓库当前 `go.mod` 声明：

```text
go 1.24.13
```

练习时可以使用本机 Go，但读业务和跑仓库命令时要以业务仓库的 `go.mod` 为准。

## 2. 每日验收规则

每天至少满足 3 件事：

1. 写一点 Go 代码。
2. 读一个真实仓库文件。
3. 跑一个验证命令或写一条测试。
4. 写清楚一个 Node.js 到 Go 的差异点。

算法题统一要求：

1. 用 Go 写。
2. 至少 2 个测试用例。
3. 写时间复杂度和空间复杂度。
4. 记录一个 Go 语法点。

建议文件组织：

```text
go-practice/
  go.mod
  notes/
    day01.md
    day02.md
  algorithms/
    day01_array_test.go
    day02_hash_test.go
  doccheck/
    ...
```

## 3. 短期计划：Day 1-28

短期目标：4 周后能读懂 `exportapp` 这类中等复杂度 Go 服务，能在同事 review 下接低风险业务任务。

### Day 1：Go 环境、模块、运行

目标：

- 知道 Go 程序怎么创建、运行、测试。
- 知道 `go.mod` 对应 Node.js 里的 `package.json`，但语义不同。
- 读懂业务仓库的模块名和 Go 版本。

2 小时安排：

- 00:00-00:10：创建 `go-practice` 目录。
- 00:10-00:35：跟官方 Getting Started 写 Hello World。
- 00:35-01:00：执行 `go mod init`、`go run .`、`go test ./...`。
- 01:00-01:25：写第一个函数 `Hello(name string) string` 和测试。
- 01:25-01:45：阅读 `server/src/go.mod`，记录模块名、Go 版本、前 20 个依赖。
- 01:45-02:00：写 `notes/day01.md` 复盘。

命令：

```bash
mkdir -p "$HOME/Places/personal/go-together"
cd "$HOME/Places/personal/go-together"
go mod init go-practice
go test ./...
```

仓库阅读：

算法题：

- 数组遍历或字符串反转。
- 重点练习 `for`、`len`、`[]int`、`string`。

验收：

- 能跑通 `go test ./...`。
- 能说出 `go run .` 和 `go test` 分别做什么。

### Day 2：变量、slice、map、struct

目标：

- 掌握 Go 最常用的数据容器。
- 能用 struct 表达一个业务对象。

2 小时安排：

- 00:00-00:10：复习 Day 1。
- 00:10-00:35：看 Go by Example 的 variables、slices、maps、structs。
- 00:35-01:05：写 `FileStat` 结构体和 `TotalLines` 函数。
- 01:05-01:25：给 `TotalLines` 写 table-driven test。
- 01:25-01:45：阅读 `exportapp/domain/object` 里的 DO 类型。
- 01:45-02:00：记录 slice/map 和 JS Array/Object 的差异。

练习代码方向：

```go
type FileStat struct {
    Path      string
    LineCount int
    LinkCount int
}
```

仓库阅读：

- `domain/object/export_domain.go`
- `domain/object/task.go`

算法题：

- 两数之和或字符计数。
- 重点练习 `map[string]int` 或 `map[int]int`。

验收：

- 能写 struct。
- 能遍历 slice。
- 能用 map 计数。
- 能写最小 table-driven test。

### Day 3：函数、多返回值、error

目标：

- 知道 Go 里错误是返回值。
- 能写 `result, err := xxx()` 风格代码。

2 小时安排：

- 00:00-00:10：复习 struct/slice/map。
- 00:10-00:30：学习函数、多返回值、error。
- 00:30-01:05：写 `ReadFileStat(path string) (FileStat, error)`。
- 01:05-01:25：测试正常文件、不存在文件、空文件。
- 01:25-01:45：阅读 `exportapp/repo/task_info_repo.go` 的 `Set` 和 `Get`。
- 01:45-02:00：记录 Go error 和 JS throw/catch 的区别。

仓库阅读：

- `repo/task_info_repo.go`

算法题：

- 双指针题。
- 重点练习 `for left < right`。

验收：

- 能解释为什么 `if err != nil` 很常见。
- 能写出带 error 返回的函数。
- 能说明什么时候返回零值。

### Day 4：package、import、internal

目标：

- 会把代码拆包。
- 知道 `internal` 目录的约束。

2 小时安排：

- 00:00-00:10：复习 error。
- 00:10-00:30：学习 package/import。
- 00:30-01:05：把前几天练习拆到 `internal/scanner`。
- 01:05-01:25：修 import，跑测试。
- 01:25-01:45：阅读 `exportapp/internal/middleware` 的文件列表和职责。
- 01:45-02:00：画一张练习项目目录图。

练习目录：

```text
go-practice/
  internal/
    scanner/
      scanner.go
      scanner_test.go
  main.go
```

仓库阅读：

- `internal/middleware`

算法题：

- 有效括号。
- 重点练习用 slice 当栈。

验收：

- 能解释 package 名和目录名的关系。
- 能解释 `internal` 为什么适合放内部实现。

### Day 5：context、defer、HTTP client

目标：

- 知道 `context.Context` 是 Go 后端请求生命周期的核心。
- 会用 timeout 防止请求卡死。

2 小时安排：

- 00:00-00:10：复习 package。
- 00:10-00:35：学习 `context.WithTimeout`、`defer cancel()`。
- 00:35-01:10：写 `FetchStatus(ctx, url)`，返回 HTTP 状态码。
- 01:10-01:25：测试一个正常 URL 和一个超时场景。
- 01:25-01:45：阅读 `file-dispatch-server/main.go` 的 `context.WithCancel`。
- 01:45-02:00：记录 context 和 Node.js `AbortController` 对照。

仓库阅读：

- `src/file-dispatch-server/main.go`

算法题：

- 合并两个有序数组。
- 重点练习下标和边界。

验收：

- 能解释为什么要传 ctx。
- 能解释为什么 `defer cancel()`。
- 能写一个不会无限等待的 HTTP 请求。

### Day 6：单元测试和 table-driven tests

目标：

- 能写 Go 业务中最常见的测试风格。

2 小时安排：

- 00:00-00:10：复习 context。
- 00:10-00:30：学习 `testing`、`t.Run`、table-driven tests。
- 00:30-01:10：把前几天的测试都改成表格测试。
- 01:10-01:25：跑 coverage。
- 01:25-01:45：阅读 `exportapp/domain/services/export_service_test.go` 的测试结构。
- 01:45-02:00：记录 `assert` 和 `require` 的区别。

命令：

```bash
go test ./... -cover
```

仓库阅读：

- `domain/services/export_service_test.go`

算法题：

- 二分查找。
- 测试空数组、单元素、找不到。

验收：

- 能写 `tests := []struct{...}`。
- 能解释 `t.Run` 的作用。
- 能知道什么时候用 `require.NoError`。

### Day 7：第一周复盘和 exportapp 调用链

目标：

- 把基础知识和真实仓库第一次连接起来。
- 能说出 `exportapp` 从启动到 handler 注册的大概路径。

2 小时安排：

- 00:00-00:20：整理 Day 1-6 笔记。
- 00:20-00:50：阅读 `exportapp/main.go`。
- 00:50-01:15：阅读 `exportapp/handlers/http.go`。
- 01:15-01:35：画调用链图。
- 01:35-01:50：补一个本周练习测试。
- 01:50-02:00：写周复盘。

调用链图最少包含：

```text
main
-> lazy.LoadAll / ops.StartUp
-> wireServer
-> NewHTTPService
-> ExportHandler.RegisterServer
-> handler method
```

仓库阅读：

- `main.go`
- `handlers/http.go`

算法题：

- 第一周错题重做 1 题。

验收：

- 能口述 `exportapp` 的启动路径。
- 能说出 handler、service、repo 各自大概做什么。

### Day 8：HTTP 服务和 Gin 路由

目标：

- 用 Gin 写一个最小 HTTP 服务。
- 理解路由组和 middleware。

2 小时安排：

- 00:00-00:10：复习 `exportapp` 调用链。
- 00:10-00:35：学习 Gin 基本路由。
- 00:35-01:10：写 `POST /tasks` 和 `GET /tasks/:id`。
- 01:10-01:25：用 `httptest` 测试一个路由。
- 01:25-01:45：阅读 `opsserver/main.go` 的 Gin 初始化和 route。
- 01:45-02:00：记录 Gin 和 Express/Koa 的对照。

仓库阅读：

- `src/opsserver/main.go`

算法题：

- 链表反转。
- 如果链表不熟，先用数组模拟，再写 struct 版本。

验收：

- 能写 `gin.Default()`。
- 能注册 GET/POST。
- 能解释 `Group("/ops")`。

### Day 9：JSON bind 和参数校验

目标：

- 能处理请求体。
- 能把参数错误变成明确的响应。

2 小时安排：

- 00:00-00:10：复习 Gin route。
- 00:10-00:30：学习 JSON bind。
- 00:30-01:05：给 `POST /tasks` 增加 request struct。
- 01:05-01:25：测试正常 JSON、非法 JSON、缺字段。
- 01:25-01:45：阅读 `exportapp/handlers/export.go` 的 `getExportAsReq`。
- 01:45-02:00：记录 request struct 和 TS interface 的差异。

仓库阅读：

- `handlers/export.go`

算法题：

- 删除有序数组重复项。

验收：

- 能写 request/response struct。
- 能处理 bind 失败。
- 能说明参数错误为什么不该返回 500。

### Day 10：DTO/DO 转换

目标：

- 理解接口层对象和领域对象为什么要分开。

2 小时安排：

- 00:00-00:10：复习 JSON bind。
- 00:10-00:30：学习 DTO/DO 分层概念。
- 00:30-01:05：给练习服务写 `ConvertCreateTaskReqToDO`。
- 01:05-01:25：测试转换函数。
- 01:25-01:45：阅读 `exportapp/handlers/converter`。
- 01:45-02:00：记录“接口字段名”和“业务字段名”不一致时怎么办。

仓库阅读：

- `handlers/converter`

算法题：

- 滑动窗口最大无重复子串。

验收：

- 能解释 DTO/DO。
- 能写纯转换函数。
- 能用测试锁住字段映射。

### Day 11：错误包装和错误映射

目标：

- 能读懂业务错误如何转换成 HTTP/meerkat 错误。

2 小时安排：

- 00:00-00:10：复习 DTO/DO。
- 00:10-00:35：学习 `errors.Is`、`errors.As`、`fmt.Errorf("%w")`。
- 00:35-01:05：在练习服务里定义 `ErrTaskNotFound`。
- 01:05-01:25：把 not found 映射成 404，把 invalid 参数映射成 400。
- 01:25-01:45：阅读 `ConvertToMeerkatError`。
- 01:45-02:00：记录错误包装规则。

仓库阅读：

- `handlers/http.go`

算法题：

- 判断环形链表。

验收：

- 能写 sentinel error。
- 能用 `%w` 包装错误。
- 能解释错误映射为什么集中处理。

### Day 12：middleware 和 trace id

目标：

- 能写一个最小 middleware。
- 理解请求上下文里注入信息的方式。

2 小时安排：

- 00:00-00:10：复习错误处理。
- 00:10-00:30：学习 middleware 调用模型。
- 00:30-01:05：给练习服务加 request id middleware。
- 01:05-01:25：测试 response header 里有 request id。
- 01:25-01:45：阅读 `exportapp/internal/middleware` 和 `weboffice/webserver/middleware`。
- 01:45-02:00：记录 middleware 顺序问题。

仓库阅读：

- `internal/middleware`
- `src/weboffice/webserver/middleware`

算法题：

- BFS 层序遍历。

验收：

- 能解释 middleware 前置/后置逻辑。
- 能说出 trace id 对排障的价值。

### Day 13：日志和上下文

目标：

- 会在上下文里取 logger。
- 知道什么该打 info、warn、error。

2 小时安排：

- 00:00-00:10：复习 middleware。
- 00:10-00:25：学习结构化日志概念。
- 00:25-01:05：给练习服务加请求日志。
- 01:05-01:25：给错误分支补日志。
- 01:25-01:45：搜索并阅读 `ctxlog.FromContext(ctx)` 用法。
- 01:45-02:00：写日志规范小结。

搜索命令：

```bash
cd src
rg "ctxlog.FromContext\\(ctx\\)" exportapp weboffice util | head -40
```

算法题：

- DFS 路径问题。

验收：

- 能解释为什么日志里要带 fileID/taskID 这类字段。
- 能避免把用户敏感信息打进日志。

### Day 14：第二周业务小练习

目标：

- 完成一次从 request 到 response 的小功能。

2 小时安排：

- 00:00-00:15：复盘 Day 8-13。
- 00:15-00:35：设计任务状态字段。
- 00:35-01:15：给练习服务加 `status` 字段。
- 01:15-01:35：补 DTO/DO 转换测试。
- 01:35-01:50：对照 `ExportTaskProgressDO` 阅读业务状态。
- 01:50-02:00：写周复盘。

仓库阅读：

- `domain/object/task.go`

算法题：

- 第二周错题重做 1 题。

验收：

- 能完成字段级改动。
- 能补转换测试。
- 能写一段变更说明。

### Day 15：Redis repo 基础

目标：

- 理解 repo 层的职责。
- 理解 key prefix 和 TTL。

2 小时安排：

- 00:00-00:10：复习状态字段小练习。
- 00:10-00:30：学习缓存基础：key、value、expire。
- 00:30-01:05：用内存 map 写 `TaskRepo` 接口和实现。
- 01:05-01:25：测试 Set/Get/NotFound。
- 01:25-01:45：阅读 `TaskInfoRepo`。
- 01:45-02:00：记录 Redis miss 和业务错误的区别。

仓库阅读：

- `repo/task_info_repo.go`

算法题：

- Top K 高频元素。

验收：

- 能写 interface + struct 实现。
- 能解释 `exportapp:task:` 这类 key prefix。

### Day 16：JSON 序列化和反序列化

目标：

- 能把结构体安全地 marshal/unmarshal。

2 小时安排：

- 00:00-00:10：复习 repo。
- 00:10-00:30：学习 `encoding/json`。
- 00:30-01:05：给 `TaskRepo` 加 JSON 存储格式。
- 01:05-01:25：测试非法 JSON、空对象、字段缺失。
- 01:25-01:45：阅读 `task_info_repo_test.go` 的 JSON 测试。
- 01:45-02:00：记录 JSON tag 用法。

仓库阅读：

- `repo/task_info_repo_test.go`

算法题：

- 有效字母异位词。

验收：

- 能写 `json.Marshal` 和 `json.Unmarshal`。
- 能处理反序列化失败。

### Day 17：cache miss 和错误分支

目标：

- 能区分“不存在”和“系统错误”。

2 小时安排：

- 00:00-00:10：复习 JSON。
- 00:10-00:30：学习 `errors.Is` 在 repo 层的用法。
- 00:30-01:05：给练习 repo 定义 `ErrNotFound`。
- 01:05-01:25：测试 miss 不当作系统错误。
- 01:25-01:45：阅读 `errors.Is(err, redis.ErrNil)` 分支。
- 01:45-02:00：写错误分类表。

仓库阅读：

- `repo/task_info_repo.go`

算法题：

- 合并区间。

验收：

- 能解释 `(nil, nil)` 的业务含义。
- 能解释为什么 Redis 网络错误要返回 error。

### Day 18：SQL 基础

目标：

- 能读简单 SQL 访问代码。
- 知道参数化查询的重要性。

2 小时安排：

- 00:00-00:10：复习 cache miss。
- 00:10-00:30：复习 SQL select/insert/update。
- 00:30-01:05：用 sqlite 或伪代码写一个任务表访问示例。
- 01:05-01:25：写参数化查询练习。
- 01:25-01:45：阅读 `opsserver/executor/sql/sql.go`。
- 01:45-02:00：记录 SQL 注入风险。

仓库阅读：

- `src/opsserver/executor/sql/sql.go`

算法题：

- 快速排序或归并排序。

验收：

- 能解释为什么不要拼接用户输入到 SQL。
- 能知道 `database/sql` 和 `sqlx` 是数据访问基础。

### Day 19：配置加载

目标：

- 理解服务启动时配置先加载，再初始化依赖。

2 小时安排：

- 00:00-00:10：复习 SQL。
- 00:10-00:30：学习 toml/yaml/env 配置读取。
- 00:30-01:05：给练习服务加 config struct。
- 01:05-01:25：测试默认值和非法配置。
- 01:25-01:45：阅读 `lazy.LoadAll` 调用点。
- 01:45-02:00：记录“全局配置对测试的影响”。

仓库阅读：

- `main.go`
- `src/opsserver/main.go`

算法题：

- 搜索旋转排序数组。

验收：

- 能解释启动流程里为什么先 load config。
- 能说出业务函数直接读全局配置为什么难测。

### Day 20：mock、interface 和测试隔离

目标：

- 理解 Go 里更推荐依赖接口而不是到处 patch。

2 小时安排：

- 00:00-00:10：复习配置。
- 00:10-00:30：学习 interface-based mock。
- 00:30-01:05：把练习 service 依赖 repo interface。
- 01:05-01:25：写 fake repo 测试 service。
- 01:25-01:45：阅读仓库里的 gomonkey 测试。
- 01:45-02:00：记录 gomonkey 的利弊。

仓库阅读：

- `src/file-dispatch-server/service/service_test.go`
- `repo/task_info_repo_test.go`

算法题：

- LRU Cache 设计题，难的话只写简化版。

验收：

- 能写 fake 实现。
- 能解释“依赖接口”如何提升可测试性。

### Day 21：仓库局部测试

目标：

- 能定位并运行一个局部测试。

2 小时安排：

- 00:00-00:15：复盘 Day 15-20。
- 00:15-00:35：学习 `go test ./pkg -run TestName`。
- 00:35-01:00：在练习项目里跑局部测试。
- 01:00-01:25：尝试在业务仓库跑 `exportapp` 局部测试。
- 01:25-01:45：记录失败原因或成功结果。
- 01:45-02:00：写周复盘。

业务仓库命令

算法题：

- 第三周错题重做 1 题。

验收：

- 能说清局部测试命令。
- 如果测试失败，能记录是依赖、配置、编译还是断言失败。

### Day 22：读一个真实需求

目标：

- 学会从需求或 tasks 文件拆技术步骤。

2 小时安排：

- 00:00-00:10：复习局部测试。
- 00:10-00:35：阅读一个 `openspec/changes/*/tasks.md`。
- 00:35-01:00：把任务拆成输入、输出、改动点、测试点。
- 01:00-01:25：找对应代码路径。
- 01:25-01:45：写一个迷你实现计划。
- 01:45-02:00：复盘“需求到代码”的路径。

仓库阅读：

- `openspec/changes`

算法题：

- 最小栈。

验收：

- 能把一个需求拆成 3-5 个开发步骤。
- 能列出至少 2 个测试点。

### Day 23：追踪 exportapp 一个接口

目标：

- 能沿着一个接口从 route 追到 service。

2 小时安排：

- 00:00-00:10：复习需求拆解。
- 00:10-00:30：选 `CreateExportTask` 或 `DownloadExportedFile`。
- 00:30-01:10：从 `RegisterServer` 追到 handler。
- 01:10-01:30：从 handler 追到 app/service。
- 01:30-01:50：画调用链。
- 01:50-02:00：记录不懂的外部依赖。

仓库阅读：

- `handlers/http.go`
- `handlers/export.go`
- `app/export_app.go`
- `domain/services/export_service.go`

算法题：

- 二叉树最大深度。

验收：

- 能画出 route -> handler -> app -> service -> repo/external。
- 能说出每层职责。

### Day 24：设计一个低风险小改动

目标：

- 学会先设计再动代码。

2 小时安排：

- 00:00-00:10：复习调用链。
- 00:10-00:35：选择一个练习改动，例如新增任务 `source` 字段。
- 00:35-01:00：列改动点：request、DO、converter、response、test。
- 01:00-01:25：写测试清单。
- 01:25-01:45：对照 `exportapp` 字段流转。
- 01:45-02:00：写设计说明。

算法题：

- 岛屿数量。

验收：

- 能写一份不超过 1 页的小改动设计。
- 能列出哪些文件会改、哪些测试要补。

### Day 25：测试先行

目标：

- 练习先写失败测试。

2 小时安排：

- 00:00-00:10：复习小改动设计。
- 00:10-00:25：确认一个最小行为。
- 00:25-01:10：先写转换函数测试或 service 测试。
- 01:10-01:25：运行测试，确认失败原因符合预期。
- 01:25-01:45：阅读业务仓库相似测试。
- 01:45-02:00：记录测试失败信息。

算法题：

- 最长递增子序列，难的话先做 DP 入门题。

验收：

- 能接受“测试先失败”。
- 能判断失败是否是自己预期的行为缺失。

### Day 26：实现低风险小改动

目标：

- 完成一个完整但小的业务练习闭环。

2 小时安排：

- 00:00-00:10：复习失败测试。
- 00:10-01:00：实现 Day 25 的最小改动。
- 01:00-01:20：跑测试并修复。
- 01:20-01:40：补边界测试。
- 01:40-02:00：写变更说明。

算法题：

- 零钱兑换或爬楼梯。

验收：

- 测试从失败变通过。
- 改动范围小。
- 能说明为什么这么改。

### Day 27：代码清理和 review 准备

目标：

- 让代码达到能给同事看的程度。

2 小时安排：

- 00:00-00:10：复习实现改动。
- 00:10-00:30：跑 `go fmt`、`go test`。
- 00:30-01:00：检查命名、错误信息、日志。
- 01:00-01:25：补必要注释，不写废话注释。
- 01:25-01:45：阅读 Go Code Review Comments 中命名和错误处理部分。
- 01:45-02:00：写 review 自查表。

算法题：

- 字符串解码或括号生成。

验收：

- 能自己指出 2 个潜在 review 点。
- 能把测试命令写进交付说明。

### Day 28：短期交付演练

目标：

- 模拟一次真实 MR 交付。

2 小时安排：

- 00:00-00:20：复盘 4 周学习。
- 00:20-00:45：整理调用链图、测试命令、变更说明。
- 00:45-01:15：写 MR 描述。
- 01:15-01:35：列风险和回滚方案。
- 01:35-01:50：对照最小接业务能力清单打勾。
- 01:50-02:00：写下中期最想补的 3 个方向。

MR 描述模板：

```text
本次变更：
- 

验证：
- go test ./xxx -run TestXxx

风险：
- 

回滚：
- revert 本次改动，不涉及数据迁移
```

算法题：

- 短期错题复盘 1-2 题。

验收：

- 能完成一次小需求的“设计、测试、实现、验证、说明”闭环。
- 达到可接低风险 Go 业务任务的水平。

## 4. 中期计划：Day 29-68

中期按 8 周、每周 5 天安排。周末用于复盘、补课、错题和真实仓库阅读，不强制写新代码。

中期目标：能独立负责一个小型后端功能，覆盖 proto/gRPC、并发、数据层、配置、观测性和交付。

### 第 5 周：gRPC/protobuf 入门

#### Day 29：读 proto 基础

- 学习：message、service、rpc、field number。
- 动手：写一个最小 `task.proto`，只定义 message，不生成代码也可以。
- 仓库阅读：`server/src/weboffice/protos/filedispatchserverpb/filedispatchserver.proto`。
- 验收：能解释 proto 字段编号为什么不能随便改。
- 算法题：图的邻接表表示。

#### Day 30：proto 到 Go 代码

- 学习：generated pb.go 的结构。
- 动手：在仓库里找一个 pb.go，观察 request/response struct。
- 仓库阅读：`server/src/weboffice/protos` 下对应生成文件。
- 验收：能说出 `.proto` 和 `.pb.go` 的关系。
- 算法题：BFS 最短路径。

#### Day 31：gRPC server 注册

- 学习：gRPC server、service implementation、RegisterServer。
- 动手：画 `file-dispatch-server` 的 gRPC 注册路径。
- 仓库阅读：`file-dispatch-server/service/service.go`。
- 验收：能找到 server 启动和服务注册位置。
- 算法题：拓扑排序入门。

#### Day 32：gRPC client 和 metadata

- 学习：client 调用、metadata、context。
- 动手：读一个仓库中的 gRPC client 调用，记录 ctx 如何传递。
- 仓库阅读：搜索 `grpc.Dial`、`metadata.NewOutgoingContext`。
- 验收：能解释 metadata 类似 HTTP header。
- 算法题：课程表。

#### Day 33：gRPC 错误和状态码

- 学习：`status.Error`、`codes.NotFound`、`codes.InvalidArgument`。
- 动手：给练习项目写一个错误转换函数。
- 仓库阅读：`file-dispatch-server/service/service.go` 中 `status` 用法。
- 验收：能说明业务错误和 gRPC status 的映射。
- 算法题：第五周错题复盘。

### 第 6 周：gRPC/protobuf 业务链路

#### Day 34：追踪一个 gRPC 方法

- 学习：从 proto 方法追到实现。
- 动手：选 `file-dispatch-server` 一个方法，从 proto 追到 service method。
- 仓库阅读：`filedispatchserverpb` 和 `file-dispatch-server/service`。
- 验收：能画出 proto -> pb.go -> implementation。
- 算法题：岛屿最大面积。

#### Day 35：流式响应概念

- 学习：server streaming、chunk、io.Reader。
- 动手：读文件分块传输伪代码。
- 仓库阅读：`file-dispatch-server/service/service.go` 中 stream 相关逻辑。
- 验收：能解释为什么大文件不能一次性读进内存。
- 算法题：滑动窗口最大值。

#### Day 36：Makefile 中的 pb_files

- 学习：代码生成命令。
- 动手：阅读 `server/Makefile` 的 `pb_files`、`pb_files_v2`。
- 仓库阅读：`server/Makefile`。
- 验收：能解释 generated code 不手改。
- 算法题：合并 K 个链表，难的话先用数组排序。

#### Day 37：proto 兼容性

- 学习：加字段、删字段、保留字段的兼容性风险。
- 动手：写一页“proto 字段变更注意事项”。
- 仓库阅读：任意一个已有 proto 的 message 演进结构。
- 验收：能说明新增字段比改字段语义更安全。
- 算法题：单词搜索。

#### Day 38：第 6 周小演练

- 学习：综合 gRPC/protobuf。
- 动手：为一个 proto 方法写调用链说明。
- 仓库阅读：整理本周读过的路径。
- 验收：能向同事讲清一个 gRPC 接口怎么进服务。
- 算法题：第 6 周错题复盘。

### 第 7 周：并发基础和 context cancel

#### Day 39：goroutine 和 channel

- 学习：goroutine、channel、select。
- 动手：写一个 worker pool，处理 10 个任务。
- 仓库阅读：搜索 `go func` 在 `file-dispatch-server` 的用法。
- 验收：能解释 goroutine 不是线程，但也不能无限开。
- 算法题：生产者消费者模拟。

#### Day 40：WaitGroup 和 errgroup

- 学习：等待并发任务完成。
- 动手：用 `sync.WaitGroup` 改写 worker pool。
- 仓库阅读：搜索 `errgroup` 或 `sync.WaitGroup`。
- 验收：能解释什么时候要等所有任务完成。
- 算法题：并发安全计数器思考题。

#### Day 41：Mutex、Cond、并发资源限制

- 学习：`sync.Mutex`、`sync.Cond`。
- 动手：读懂 `acquireGlobalStream` 的等待和释放。
- 仓库阅读：`file-dispatch-server/service/service.go`。
- 验收：能解释为什么 release 后要 Signal。
- 算法题：设计阻塞队列，写伪代码也可以。

#### Day 42：context cancel 唤醒等待

- 学习：取消中的等待者如何退出。
- 动手：写一个等待资源但支持 ctx cancel 的函数。
- 仓库阅读：`acquireGlobalStream`、`acquireCompanyStream`。
- 验收：能解释如果不处理 cancel 会发生什么。
- 算法题：超时重试模拟。

#### Day 43：并发测试

- 学习：并发测试、超时保护。
- 动手：写一个“达到限制后阻塞，释放后继续”的测试。
- 仓库阅读：`file-dispatch-server/service/service_test.go`。
- 验收：能写 `select { case <-ch: ... case <-time.After: ... }`。
- 算法题：第 7 周错题复盘。

### 第 8 周：限流、singleflight、流式处理

#### Day 44：rate limiter

- 学习：`golang.org/x/time/rate`。
- 动手：写一个每秒限制 N 次的 demo。
- 仓库阅读：`initBandwidthLimiter`。
- 验收：能解释 limit 和 burst。
- 算法题：令牌桶模拟。

#### Day 45：singleflight

- 学习：重复请求合并。
- 动手：用 singleflight 模拟多个请求只触发一次加载。
- 仓库阅读：`file-dispatch-server/service` 中 `singleflight.Group`。
- 验收：能说明 singleflight 适合防止缓存击穿。
- 算法题：缓存淘汰策略对比。

#### Day 46：io.Reader 和文件流

- 学习：`io.Reader`、`io.Copy`、buffer。
- 动手：写文件 copy demo。
- 仓库阅读：`file-dispatch-server/service/font_sync.go` 或 stream 代码。
- 验收：能说明流式处理和一次性读入的区别。
- 算法题：大文件分片思路题。

#### Day 47：atomic 和 sync.Map

- 学习：`sync/atomic`、`sync.Map`。
- 动手：写安全计数器和普通 map 对比。
- 仓库阅读：`FileDispatchService` 中 atomic/sync.Map 字段。
- 验收：能说明普通 map 不能并发读写。
- 算法题：线程安全 Map 设计思路。

#### Day 48：第 8 周小演练

- 学习：并发综合复盘。
- 动手：为 `file-dispatch-server` 写一页“并发控制说明”。
- 仓库阅读：整理本周读过的函数。
- 验收：能解释全局限流、公司级限流、带宽限流。
- 算法题：第 8 周错题复盘。

### 第 9 周：数据层和缓存

#### Day 49：Redis key 设计

- 学习：prefix、TTL、命名规范。
- 动手：设计 3 个业务 key。
- 仓库阅读：`exportapp/repo/task_info_repo.go`。
- 验收：能说明 key 包含哪些维度。
- 算法题：前缀树入门。

#### Day 50：缓存序列化

- 学习：JSON、msgpack、兼容性。
- 动手：给缓存结构加新字段，测试老 JSON 能否解析。
- 仓库阅读：`ExportTaskInfo` 结构。
- 验收：能说明新增字段的兼容性。
- 算法题：字符串前缀匹配。

#### Day 51：SQL transaction

- 学习：事务开始、提交、回滚。
- 动手：写伪代码模拟订单创建事务。
- 仓库阅读：`opsserver/executor/sql`。
- 验收：能解释 defer rollback 的常见写法。
- 算法题：事务状态机思考题。

#### Day 52：数据层错误分类

- 学习：not found、conflict、timeout、internal。
- 动手：写错误分类表。
- 仓库阅读：`weboffice/errs` 或 handler 错误转换。
- 验收：能把数据错误映射到业务错误。
- 算法题：错误码映射练习。

#### Day 53：第 9 周小演练

- 学习：repo 层综合。
- 动手：给练习 repo 补成功、not found、非法数据、下游错误四类测试。
- 仓库阅读：对照 `task_info_repo_test.go`。
- 验收：四类测试都通过。
- 算法题：第 9 周错题复盘。

### 第 10 周：配置、依赖注入、可测试性

#### Day 54：配置中心和启动顺序

- 学习：服务启动、配置加载、依赖初始化。
- 动手：画 `exportapp/main.go` 启动时序。
- 仓库阅读：`lazy.LoadAll`、`ops.StartUp`、`wireServer`。
- 验收：能解释为什么启动顺序错会导致服务不可用。
- 算法题：拓扑排序复习。

#### Day 55：Google Wire 概念

- 学习：依赖注入和 provider set。
- 动手：阅读 `exportapp/wire.go` 和 `wire_gen.go`。
- 仓库阅读：`exportapp/*/wire.go`。
- 验收：能解释手写 new 和 wire 生成的区别。
- 算法题：依赖图环检测。

#### Day 56：全局状态和测试困难

- 学习：全局函数、全局配置、单例的测试成本。
- 动手：把练习服务的全局配置改成构造函数注入。
- 仓库阅读：`feat-sql-testability-governance` 的设计或任务。
- 验收：能说明为什么依赖注入利于测试。
- 算法题：设计题，配置热更新思路。

#### Day 57：mock 策略

- 学习：fake、stub、mock、patch。
- 动手：同一逻辑分别用 fake 和 patch 思路写测试对比。
- 仓库阅读：`gomonkey` 使用位置。
- 验收：能说明长期优先 interface mock。
- 算法题：模拟题。

#### Day 58：第 10 周小演练

- 学习：可测试性综合。
- 动手：选一个难测函数，写“如何改成可测”的方案。
- 仓库阅读：`openspec/changes/feat-sql-testability-governance`。
- 验收：方案包含依赖拆分、测试点、风险。
- 算法题：第 10 周错题复盘。

### 第 11 周：观测性和排障

#### Day 59：日志字段设计

- 学习：结构化日志字段。
- 动手：给练习服务统一 logger 字段。
- 仓库阅读：搜索 `WithFields("fileID"`。
- 验收：能说明哪些字段适合作为日志字段。
- 算法题：日志聚合计数题。

#### Day 60：metrics 基础

- 学习：counter、gauge、histogram/latency。
- 动手：给练习服务加请求计数。
- 仓库阅读：`exportapp/internal/metrics`、`weboffice/metrics`。
- 验收：能说明 counter 和 gauge 的区别。
- 算法题：滑动窗口计数。

#### Day 61：trace 基础

- 学习：trace id、span、跨服务传递。
- 动手：画一个请求跨 handler/service/external 的 trace。
- 仓库阅读：`middleware.Trace`、OpenTelemetry 相关依赖。
- 验收：能解释 trace 对排查慢请求的作用。
- 算法题：路径压缩思考题。

#### Day 62：错误上报和告警

- 学习：Sentry、错误采样、告警噪音。
- 动手：写错误上报策略说明。
- 仓库阅读：搜索 `sentrysdk`。
- 验收：能说明哪些错误不该上报告警。
- 算法题：异常流统计。

#### Day 63：第 11 周小演练

- 学习：观测性综合。
- 动手：为一个小功能设计日志、metrics、trace 点。
- 仓库阅读：对照 `exportapp` 的已有 metrics。
- 验收：说明里包含字段、指标名、低基数约束。
- 算法题：第 11 周错题复盘。

### 第 12 周：独立小功能演练

#### Day 64：选题和范围控制

- 学习：如何选择低到中等复杂度功能。
- 动手：选一个真实或模拟需求，写 scope。
- 仓库阅读：参考 `openspec/changes` 的 proposal/tasks 写法。
- 验收：范围不超过 5 个主要改动点。
- 算法题：综合题 1。

#### Day 65：设计和测试计划

- 学习：先写测试计划。
- 动手：列 API 行为、错误分支、数据分支、观测性点。
- 仓库阅读：对照相似模块测试。
- 验收：至少 5 个测试场景。
- 算法题：综合题 2。

#### Day 66：实现核心逻辑

- 学习：保持改动小步提交的思路。
- 动手：完成核心纯逻辑和转换函数。
- 仓库阅读：参考 `exportapp` service 风格。
- 验收：核心逻辑测试通过。
- 算法题：错题重做。

#### Day 67：接入 handler/repo/external

- 学习：把纯逻辑接入真实调用链。
- 动手：接 handler/app/service/repo 中必要层。
- 仓库阅读：对照 `CreateExportTask` 或 `DownloadExportedFile`。
- 验收：局部测试通过，错误分支可解释。
- 算法题：自选薄弱题型。

#### Day 68：交付说明和最终复盘

- 学习：如何提交给 review。
- 动手：写 MR 描述、风险、回滚、验证命令。
- 仓库阅读：回看所有调用链图。
- 验收：达到“能独立负责小功能”的演练标准。
- 算法题：最终错题复盘。

## 5. Node.js 对照版每日落地表

这张表是每天学习时的导航。原来的 Day 级安排告诉你“做什么”，这张表告诉你“用 Node.js 怎么理解、Go 真正要补什么、业务仓库去哪里看”。

| Day | Node.js 类比 | Go 差异重点 | weboffice-backend 落点 | 当天必须写下来的迁移笔记 |
|---|---|---|---|---|
| Day 1 | `package.json`、`node index.js`、`npm test` | `go.mod` 声明模块，Go 代码需要 package，测试是语言内置能力 | `server/src/go.mod` | `go.mod` 和 `package.json` 的相同点与不同点 |
| Day 2 | TS interface/type + Array/Object | Go 用 `struct`、slice、map；字段大小写影响导出 | `exportapp/domain/object` | struct 字段为什么常见大写 |
| Day 3 | `try/catch`、`throw new Error()` | Go 用多返回值返回 `error`，调用方必须显式处理 | `exportapp/repo/task_info_repo.go` | `if err != nil` 为什么不是啰嗦 |
| Day 4 | Node 模块拆分、`src/internal` 约定 | Go 的 package 是编译边界，`internal` 有导入限制 | `exportapp/internal/middleware` | package、目录、import 的关系 |
| Day 5 | `AbortController`、axios timeout | Go 用 `context.Context` 传递取消和超时 | `file-dispatch-server/main.go` | `defer cancel()` 的意义 |
| Day 6 | Jest table tests | Go 常用 table-driven tests，测试文件是 `*_test.go` | `exportapp/domain/services/export_service_test.go` | `t.Run`、`assert`、`require` 的分工 |
| Day 7 | 从 `index.ts` 找服务启动 | Go 从 `main.go` 开始，但依赖初始化可能由 wire/lazy 完成 | `exportapp/main.go`、`handlers/http.go` | `exportapp` 启动链路图 |
| Day 8 | Express/Koa 路由 | Gin 用 router group 和 handler func，middleware 链更显式 | `opsserver/main.go` | Gin `Group` 和 Express Router 的差异 |
| Day 9 | `req.body` + DTO validation | Go 需要定义 request struct，JSON bind 失败要显式返回 | `exportapp/handlers/export.go` | 参数错误为什么不能直接 500 |
| Day 10 | Controller DTO -> Service input | Go 常把 DTO/DO 转换写成纯函数并用测试保护 | `exportapp/handlers/converter` | DTO 和 DO 为什么分开 |
| Day 11 | 自定义 Error class + error middleware | Go 用 error wrapping 和集中映射，不靠异常冒泡 | `ConvertToMeerkatError` | `%w`、`errors.Is`、`errors.As` 的用法 |
| Day 12 | Express middleware 注入 request id | Gin/meerkat middleware 显式串联，顺序影响行为 | `exportapp/internal/middleware`、`weboffice/webserver/middleware` | middleware 顺序带来的风险 |
| Day 13 | pino/winston logger child fields | Go 常从 context 取 logger，再补业务字段 | `ctxlog.FromContext(ctx)` 用法 | 哪些字段适合放日志里 |
| Day 14 | 给接口加字段并传到 service | Go 需要同时改 struct、converter、测试，编译器会帮你找漏点 | `exportapp/domain/object/task.go` | 字段级改动检查清单 |
| Day 15 | Redis client repo 封装 | Go 里 repo 常定义 interface + impl，错误显式返回 | `exportapp/repo/task_info_repo.go` | key prefix 和 TTL 如何设计 |
| Day 16 | `JSON.stringify` / `JSON.parse` | Go 用 `json.Marshal/Unmarshal`，字段 tag 和零值要注意 | `task_info_repo_test.go` | 新增 JSON 字段的兼容性 |
| Day 17 | cache miss 返回 `null` | Go 要区分 `(nil, nil)`、sentinel error、系统 error | `errors.Is(err, redis.ErrNil)` | miss 和 error 的边界 |
| Day 18 | `mysql2`、`knex.raw`、SQL 参数 | Go 的 `database/sql`、`sqlx` 都要用参数化查询 | `opsserver/executor/sql/sql.go` | SQL 注入在 Go 里怎么避免 |
| Day 19 | `config` 包、dotenv、环境变量 | Go 服务常启动时加载配置，全局配置会增加测试成本 | `lazy.LoadAll` 调用点 | 配置为什么不该散落在业务函数里 |
| Day 20 | Jest mock、依赖注入 | Go 更自然的 mock 是 interface fake，patch 全局函数只是补救 | `gomonkey` 测试位置 | fake、mock、patch 的取舍 |
| Day 21 | `npm test -- xxx` 跑单测 | Go 用 `go test ./pkg -run TestName`，包路径很关键 | `exportapp/repo`、`exportapp/domain/services` | 局部测试命令模板 |
| Day 22 | 从 Jira/需求文档拆任务 | Go 改动也先拆输入、输出、改动点、测试点 | `openspec/changes` | 一个需求如何拆成开发步骤 |
| Day 23 | 从 route 追 controller/service/repo | Go 也是 route -> handler -> app/service -> repo/external，但类型更显式 | `exportapp` 调用链 | 一条接口链路图 |
| Day 24 | 写技术方案或 design note | Go 小改动也先列 struct、converter、test、兼容性 | 对照 `exportapp` 字段流转 | 小改动设计模板 |
| Day 25 | TDD 先写 failing Jest test | Go 先写 failing test，再补最小实现 | 相似 `_test.go` 文件 | 预期失败和意外失败如何区分 |
| Day 26 | 实现 service 逻辑让测试变绿 | Go 编译器会帮你发现类型和字段遗漏 | 练习 service/converter | 从红到绿的最小改动记录 |
| Day 27 | PR 自查、lint、format | Go 必须 `gofmt`，错误信息和命名是 review 重点 | Go Code Review Comments 对照仓库 | 自查表：命名、错误、测试、范围 |
| Day 28 | MR 描述、风险、回滚 | Go 交付也要写验证命令和回滚方式 | 练习 MR 文案 | 我现在能接哪些低风险任务 |
| Day 29 | OpenAPI/GraphQL schema | proto 是跨语言契约，字段编号是兼容性核心 | `filedispatchserverpb/*.proto` | proto 字段编号不能乱改的原因 |
| Day 30 | TS 生成 client types | `.pb.go` 是生成代码，只读不手改 | `weboffice/protos` 生成文件 | proto 和 pb.go 的对应关系 |
| Day 31 | RPC server route 注册 | gRPC 要注册 service implementation 到 server | `file-dispatch-server/service/service.go` | gRPC server 注册路径 |
| Day 32 | HTTP headers / metadata | gRPC metadata 类似 headers，但走 RPC context | 搜索 `metadata.NewOutgoingContext` | metadata 和 context 的关系 |
| Day 33 | HTTP status / error code | gRPC 用 `codes` 和 `status.Error` 表达错误 | `file-dispatch-server` status 用法 | 业务错误如何映射 RPC status |
| Day 34 | 从 API schema 追实现 | Go 里从 proto service 追到实现方法 | `filedispatchserverpb`、`file-dispatch-server/service` | proto -> implementation 链路 |
| Day 35 | Node stream / readable | Go 用 `io.Reader`、chunk、stream response 控制内存 | `file-dispatch-server` stream 逻辑 | 大文件为什么要流式处理 |
| Day 36 | npm script codegen | Go 仓库用 Makefile/protoc 生成代码 | `server/Makefile` 的 `pb_files` | 生成代码的入口和禁区 |
| Day 37 | API schema 兼容升级 | proto 新增字段通常安全，改语义和删字段危险 | 任意 proto message | proto 兼容性 checklist |
| Day 38 | API 调用链文档 | Go/gRPC 也要能写接口链路说明 | 本周读过的 proto/service | 一个 gRPC 接口说明 |
| Day 39 | `Promise.all` 并发 | goroutine 很轻，但也要控制数量和生命周期 | 搜索 `go func` | goroutine 和 Promise 的差异 |
| Day 40 | `Promise.allSettled` 等待结果 | Go 用 `WaitGroup`、errgroup 等待并发任务 | 搜索 `WaitGroup`、`errgroup` | 并发任务如何收敛 |
| Day 41 | 队列 + semaphore | Go 用 `Mutex`、`Cond`、channel 控制资源 | `acquireGlobalStream` | 为什么释放资源后要唤醒等待者 |
| Day 42 | request abort 后取消等待 | Go 要在等待资源时监听 `ctx.Done()` | `acquireCompanyStream` | 不处理 cancel 会怎样 |
| Day 43 | Jest 异步测试超时 | Go 并发测试用 channel + `time.After` 防卡死 | `service_test.go` 并发测试 | 并发测试防死锁模板 |
| Day 44 | `p-limit` / rate limit middleware | Go 可用 `rate.Limiter` 做令牌桶 | `initBandwidthLimiter` | limit 和 burst 的区别 |
| Day 45 | 防缓存击穿的请求合并 | Go 用 `singleflight` 合并重复加载 | `singleflight.Group` | singleflight 适合什么场景 |
| Day 46 | Node stream pipe | Go 用 `io.Copy`、buffer、Reader/Writer | `font_sync.go` 或 stream 代码 | Reader/Writer 思维 |
| Day 47 | 原子计数和 Map 并发安全 | Go 普通 map 并发读写会 panic，要用锁或 `sync.Map` | `atomic`、`sync.Map` 字段 | map 并发安全规则 |
| Day 48 | 服务限流设计文档 | Go 并发控制要说清全局、租户、带宽维度 | `file-dispatch-server` | 三层限流说明 |
| Day 49 | Redis key naming | Go repo 里 key 生成最好集中封装 | `TaskInfoRepo.getKey` | key 设计维度 |
| Day 50 | JSON 结构演进 | Go struct 新字段会涉及零值和 tag | `ExportTaskInfo` | 老数据如何兼容新字段 |
| Day 51 | ORM transaction | Go 事务也要 begin/commit/rollback，context 贯穿 | `opsserver/executor/sql` | defer rollback 模板 |
| Day 52 | DB error -> service error | Go 要把底层错误分类成业务错误 | `weboffice/errs`、错误映射 | 数据层错误分类表 |
| Day 53 | repo 单测分支覆盖 | Go repo 测试要覆盖成功、miss、坏数据、下游错 | `task_info_repo_test.go` | repo 四类测试 |
| Day 54 | Nest/Express app bootstrap | Go 服务启动顺序通常是 config -> deps -> server | `exportapp/main.go` | 启动时序图 |
| Day 55 | NestJS provider / DI container | Go 的 Wire 是编译期依赖注入生成代码 | `exportapp/wire.go`、`wire_gen.go` | provider set 的作用 |
| Day 56 | 全局 config 导致测试难 | Go 里全局状态同样难测，优先构造函数注入 | `feat-sql-testability-governance` | 如何把全局依赖改成可注入 |
| Day 57 | Jest mock function | Go fake interface 更稳，gomonkey 更像 monkey patch | `gomonkey` 使用点 | mock 策略对比 |
| Day 58 | 可测试性改造方案 | Go 改造重点是拆依赖、纯函数、接口边界 | SQL testability openspec | 难测函数改造方案 |
| Day 59 | 日志字段规范 | Go context logger 要带稳定低基数字段 | 搜索 `WithFields` | 日志字段清单 |
| Day 60 | Prometheus client in Node | Go metrics 分 counter/gauge/latency，label 要低基数 | `exportapp/internal/metrics`、`weboffice/metrics` | 指标类型和 label 设计 |
| Day 61 | OpenTelemetry trace | Go trace 通过 context 跨层传递 | `middleware.Trace` | trace 链路草图 |
| Day 62 | Sentry 上报策略 | Go 里也要控制错误采样和噪音 | 搜索 `sentrysdk` | 哪些错误不该告警 |
| Day 63 | 可观测性设计 | Go 功能交付要带日志、metrics、trace 设计 | `exportapp` metrics 对照 | 一个功能的观测性说明 |
| Day 64 | 需求 scope 控制 | Go 小功能先限制改动层数和风险面 | `openspec/changes` | 功能范围声明 |
| Day 65 | 测试计划 | Go 先列正常、异常、边界、兼容、观测性 | 相似 `_test.go` 文件 | 至少 5 个测试场景 |
| Day 66 | service 核心逻辑 | Go 先实现纯逻辑，降低 handler/repo 干扰 | `exportapp/domain/services` | 纯逻辑测试通过记录 |
| Day 67 | 接入调用链 | Go 接入要检查 handler/app/service/repo/external 每层类型 | `CreateExportTask` 或 `DownloadExportedFile` | 接入层检查清单 |
| Day 68 | MR/PR 交付 | Go 交付写清测试命令、风险、回滚 | 回看所有链路图 | 最终能力复盘 |

## 6. 阶段验收清单

### Day 28 验收

- [ ] 能创建 Go 项目并写测试。
- [ ] 能读 `go.mod` 和基本 Makefile。
- [ ] 能读 `exportapp/main.go` 启动流程。
- [ ] 能从 route 找到 handler。
- [ ] 能从 handler 找到 app/service/repo/external。
- [ ] 能写 DTO/DO 转换和测试。
- [ ] 能处理 error、context、JSON bind。
- [ ] 能跑局部测试。
- [ ] 能写低风险改动说明。

### Day 68 验收

- [ ] 能读懂一个 proto 并找到对应 Go 实现。
- [ ] 能解释 gRPC server/client 调用链。
- [ ] 能读懂基本并发、限流、stream 代码。
- [ ] 能处理 repo 层缓存和数据错误。
- [ ] 能解释配置加载和依赖注入。
- [ ] 能为功能设计日志、metrics、trace。
- [ ] 能独立完成一个小型后端功能演练。

## 7. 每周复盘问题

每周最后一天回答：

1. 本周我能读懂哪些仓库路径？
2. 哪个 Go 语法点还不稳？
3. 哪个错误处理场景最容易混？
4. 我的测试是否覆盖正常、异常、边界？
5. 如果明天让我接一个小需求，我会先找哪几个文件？
6. 这个知识点如果用 Node.js 写，我会怎么写？Go 为什么不一样？

## 8. 推荐学习材料使用顺序

第 1-2 周：

- https://go.dev/doc/tutorial/getting-started
- https://go.dev/tour/
- https://gobyexample.com/
- https://github.com/quii/learn-go-with-tests

第 3-4 周：

- https://go.dev/doc/effective_go
- https://go.dev/wiki/CodeReviewComments
- https://go.dev/doc/comment
- https://gin-gonic.com/docs/

中期：

- https://grpc.io/docs/languages/go/
- https://protobuf.dev/
- https://pkg.go.dev/
- 仓库真实代码优先于泛泛课程。

## 9. 最重要的执行原则

1. 每天都写 Go，不只看。
2. 每天都读一点真实仓库，不只写玩具代码。
3. 每天都跑测试或写测试。
4. 每个知识点都问一句：它在 `weboffice-backend` 哪里出现了？
5. 先把 `exportapp` 吃透，再进 `file-dispatch-server`，最后碰 `apiserver`。
6. 每天都写一句 Node.js 对照，但不要把 Go 写成 Node.js 的样子。
