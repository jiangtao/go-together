# 13 — 交付通用 Evaluation Core 与 Go Router

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让学习者能够用显式 `(courseId, lessonId)` 准备、评测、继续问答和查询状态，同时继续使用 `$evaluate-go-day dayN`；两种入口必须落到同一 Learning Record、同一状态机和同一安全核心。

**Blocked by:** 11 — 建立 Course 契约与安全发布快照

**Status:** resolved

- [x] `$evaluate-course-lesson <courseId> <lessonId>` 是唯一 Core 入口，拒绝缺失、未知、Retired、跨 Course 或由 Day/目录猜测的身份。
- [x] `$evaluate-go-day dayN` 固定 go-backend，只通过显式 legacy Day mapping 解析 lessonId，并调用同一 Core；无独立评分、Policy 或旧目录扫描。
- [x] 准备模式排他创建 Notes，仅在显式请求时初始化尚不存在的 Exercise；覆盖必须有本次请求明确授权。
- [x] 评测模式只读取当前 Lesson、Course Policy、Notes、既有 Evaluation 和 Notes 明示的当前 Exercise 证据，只原子更新 Evaluation 并追加历史。
- [x] 四态转换、0–4 诊断等级、全部必修项至少 3、三次机会、新评测周期和同 revision 通过终态符合规范。
- [x] Course Policy 只能收紧 Core；Command Profile 使用参数数组、固定工作目录、最小环境、无网络和超时，拒绝任意 shell 与工作区外写入。
- [x] Go Profile 仅允许课程明确要求的 go test、go test -race、go vet、go test -bench 模板，并继续拒绝可能访问外部服务的命令。
- [x] 安全停止、解析失败、工具缺失和命令超时不创建第五状态，也不覆盖上一次有效状态/分数。
- [x] token、密钥、DSN、认证头或完整隐私数据只产生不含原文的安全事件，零答案泄露测试覆盖问答、回炉和失败路径。
- [x] Progress 只从 Evaluation 派生；评测入口不能写 Release Snapshot、Public Progress、Roadmap 或 Course Source。
- [x] 临时 fixture 证明带 Day 与无 Day Course 均可工作；当前真实 Day 0 Notes/Evaluation 在迁移前保持原字节。

## Evidence

- `npm run build:release` 全链通过：Vitest 154/154、通用 Evaluation 20/20、Go Router 5/5，生成确定性、generated/dist/prebuilt 安全审计均通过。
- Skill TDD 覆盖 Python Profile、命令注入拒绝、敏感信息安全停止、Go legacy adapter 与旧 Evaluation 只读；独立规格审查 0 findings。
- 独立标准复验确认跨 revision 间隔后的同 revision 通过终态，以及 stdout/stderr 共用 1,000,000-byte 输出预算；最终 0 findings。
- Day 0 Notes、Evaluation 与 `roadmap/src/data/course.json` 的 SHA-256 保持不变；5173 端口未启动或替换服务。
- `npm@11.6.1 ci --dry-run --ignore-scripts` 已通过；真实 Go Day 0 `status` 经显式 adapter 读取为未开始且不写源记录。
