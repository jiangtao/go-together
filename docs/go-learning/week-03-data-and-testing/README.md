# Week 03：数据访问、缓存与测试隔离

对应天数：Day 15-21

## 本周目标

- 理解 repository、缓存 miss、JSON 序列化、SQL、配置加载和测试隔离。
- 能区分业务错误、缓存 miss、系统错误和数据错误。
- 能用 fake/interface 做基础测试隔离。

## Node.js 对照

| Node.js/TypeScript | Go | 本周要理解的差异 |
|---|---|---|
| Redis client wrapper | repository interface + impl | 业务层依赖接口，不依赖具体实现 |
| `JSON.stringify` | `json.Marshal` | tag、zero value 和兼容性要注意 |
| cache miss 返回 `null` | `(nil, nil)` 或明确错误 | miss 和 error 必须分清 |
| ORM/query builder | `database/sql` / query layer | 参数化查询和错误处理更显式 |
| Jest mock | fake interface | 小接口比全局 patch 更稳 |

## 每日索引

- Day 15：缓存 repository 基础。
- Day 16：JSON 序列化和反序列化。
- Day 17：cache miss 和错误分支。
- Day 18：SQL 基础。
- Day 19：配置加载。
- Day 20：mock、interface 和测试隔离。
- Day 21：局部测试。

## 手写区

### Node.js 里我以前怎么做

### Go 里应该怎么写

### Go 和 Node.js 的本质差异

### 业务学习里的对应代码类型

### 本周 demo / 测试 / 复盘

## 参考资料

- [Accessing relational databases](https://go.dev/doc/database/)
- [database/sql package](https://pkg.go.dev/database/sql)
- [testing package](https://pkg.go.dev/testing)
- [Go Wiki: TableDrivenTests](https://go.dev/wiki/TableDrivenTests)

