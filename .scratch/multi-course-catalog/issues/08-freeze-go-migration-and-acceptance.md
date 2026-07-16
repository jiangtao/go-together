# 冻结 Go 全量迁移、回滚与验收顺序

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 03, 04, 05, 06, 07

## Question

现有 Go 课程源、37 个 Lesson、`exercise/dayN`、评测记录、公开进度、Skill、测试证据和永久 URL 兼容面应按什么原子顺序迁移、核对、切换和回滚，最终以哪些证据判定可以开始新增 Python Course？

## Answer

### 固定迁移映射

- 当前 Go Course 永久使用 `courseId: go-backend`。37 个 `docs/go-learning/daily-lessons/day-NN-<slug>.md` 中 `<slug>` 已验证唯一，初始规范 `lessonId` 就固定为该语义 slug；例如 Day 0 为 `why-go-after-node`、Day 36 为 `final-review`。不得使用 `day-NN`、数组位置、标题翻译或迁移后文件名重新推导身份。
- 课程文件逐字节迁移到 `courses/go-backend/lessons/<lessonId>.md`，Day 0–36 只保留为 Course-local 展示字段。`courses/go-backend/course.json` 必须显式登记 37 个 `(lessonId, day, legacyId, legacyPath)` 一对一映射；`legacyId` 固定 `day-NN`，`legacyPath` 固定当前 `/sources/lessons/day-NN-<slug>.md`。任何遗漏、重复或 hash 漂移停止迁移。
- 三个 Track ID 固定为 `language-and-web`、`data-and-service-contracts`、`runtime-and-agent`；六个 Stage ID 固定为 `language-foundations`、`http-and-data-entry`、`data-boundaries-and-contracts`、`grpc-service-chain`、`concurrency-and-operability`、`agent-slice-and-review`。现有 Go 的顺序、归属、标题和 Day 范围保持不变，但 `stage-1`、固定三列和 Day 不再构成身份。
- `docs/go-learning/README.md` 迁为 `courses/go-backend/README.md`。`daily-lessons/README.md`、`node-to-go-36-day-course.md` 与 `sprint-36-day/capstone-rubric.md` 作为 Authoring Reference 搬到本地私有 `courses/go-backend/resources/internal/`，不得继续被 Git 跟踪或进入发布物。当前用户已逐字节完成的 `learning-records/0005…0008 → docs/learning-records/0005…0008` 是既有文档整理，不是学习者记录迁移；必须原样保留，禁止移回。
- `exercise/dayN/notes.md` 映射到 `learning-records/go-backend/lessons/<lessonId>/notes.md`，`notes-eval.md` 映射为 `evaluation.md`，其余当天产物保持相对路径迁入该 Lesson 的 `exercise/**`。Evaluation 历史必须逐字节保留；Notes 先逐字节复制，随后只允许由受测链接重写器修正课程相对链接，并记录唯一预期 diff。不存在旧目录的 Lesson 不创建伪 Evaluation。
- `roadmap/content/progress.public.json` 不迁为事实源；迁移器从当前 Evaluation 集合和“无 Evaluation 即未开始”的领域规则导出 `release-progress/go-backend.json`，再与旧 37 条状态/分数逐项核对。当前事实为 37 条均“未开始”、分数为 `null`，Day 0 Evaluation 也为“未开始”；任何不一致必须人工归因后重新导出，禁止选一边覆盖另一边。
- `roadmap/src/data/course.json` 不是迁移事实源。执行前必须保存其完整用户字节与 SHA-256 到仓库外备份；安全结构信息由 Course manifest/旧生成器输出交叉核对，状态只来自 Evaluation 派生。切换完成后删除该运行时副本，不把私有路径、旧 resources 或其用户修改复制进 Public Projection。
- 根 `.gitignore` 必须在任何私有复制前先覆盖规范 `learning-records/*/lessons/**`、`courses/*/resources/internal/**` 和迁移期 `exercise/**`；迁移后 `git ls-files` 对这些路径必须为空。旧 `roadmap/public`、`.generated`、`dist`、`.vercel/output` 视为不可信缓存，切换前清空并从新链重建，绝不作为迁移输入或备份。

### 唯一执行顺序

1. **冻结基线**：在当前 main working tree 上记录 HEAD、NUL 安全的 status、所有受影响文件的相对路径/类型/模式/大小/SHA-256、私有路径 ignore/tracked 状态、5173 listener 的 PID/command（若存在）及 Course/Exercise/Learning Record 文件集。当前脏树就是事实，禁止要求 clean、stash、stage、commit、reset、clean 或覆盖用户文件。备份放在 `<MIGRATION_BACKUP_DIR>` 仓库外，并用第二份 hash manifest 验证可读。
2. **先造护栏，不碰真实数据**：用临时 fixture 完成 Catalog/Course/Progress/Snapshot parser、通用 `$evaluate-course-lesson`、`$evaluate-go-day` 兼容 router、Catalog 驱动生成/审计、Roadmap 多课程 runtime、迁移器的 `plan/apply/rollback` 与全部单测。此阶段现有程序仍只读旧链，禁止双写。
3. **冻结旧兼容基准**：在修改旧生成器前，用当前 37 篇 Lesson 和旧公开进度在仓库外生成一次 legacy v3 `/course.json` 与 37 篇安全 Markdown，记录逐字段/逐字节 hash；同时记录现有四视口 UI 与 8 个 Go 状态截图。受保护的 `roadmap/src/data/course.json` 不参与该基准。
4. **生成影子迁移计划**：迁移器只读基线，输出完整 source→destination 清单、37 个 identity/legacy 映射、Notes 唯一链接改写、预期新增/删除、权限和 hash；在同文件系统临时目录构建完整 `courses`、`learning-records`、`release-progress` 影子树。先核对 Lesson/Evaluation 字节、公开进度和所有未归类文件，任何未知文件或基线变化立即停止。
5. **逻辑原子切换**：取得迁移锁并停止启动新的生成/评测/dev 命令；按已审计划安装影子树、切换所有代码/Skill/文档读取点，再移除旧 `docs/go-learning`、`exercise/dayN`、`roadmap/content/progress.public.json` 和 `roadmap/src/data/course.json`。期间不允许任何消费者运行；若任一步失败，迁移器自动按操作日志恢复全部基线 hash 后才释放锁。旧、新内部路径不得同时成为可读或可写事实源，也不得用 symlink、fallback、double-read 或 double-write 过渡。
6. **立即重建与等价核对**：只从 Catalog、Course Source、Release Progress Snapshot 生成全新 Public Projection。规范 `go-backend` 与 legacy v3 的 37 条字段逐项等价，37 个 legacy Markdown 与规范 Markdown 逐字节相同；`/` 和 `/courses/go-backend` 呈现同一 `courseRevision`。未知数据/资源路径必须 404，旧私有链接必须零命中。
7. **全量本地门禁**：执行冻结的 `verify:release`、四视口 Playwright、12 张 evidence、候选 Receipt、敏感扫描与两次确定性构建；再从不含私有记录的全新 Git clone 仅凭已提交 Release Progress Snapshot 重跑同一 release build，证明 CI 可复现。当前 working tree 的非迁移脏项、备份 hash 和既有 5173 listener 必须与基线一致。
8. **独立只读验收与发布**：独立验收者先核对迁移 manifest、源/目标 hash、允许的 Notes 链接 diff、私有路径未跟踪、Skill 路由、Root/Canonical 兼容、四视口和 prebuilt；通过后才部署 Preview 并跑逐 Course smoke。随后对同一 prebuilt 创建 staged Production、smoke、promote，再对生产域名复验。未经独立验收不得发布。
9. **关闭迁移窗口**：Production 与一个全新 clone 的后续重复构建都通过后，迁移 manifest 和无敏感信息的 hash/计数报告进入长期证据；仓库外原始备份继续保留到用户明确清理，不由自动化删除。此后所有新学习、评测、生成只写规范路径，旧内部路径出现即视为回归。

### 回滚与停止条件

- 在 promote 前，任何 baseline drift、未知文件、hash/字段不等、Snapshot 不一致、私有路径被跟踪、旧路径消费者、生成/审计/测试失败或非预期工作树变化，都必须停止并由迁移器恢复本地基线；恢复后逐文件核对，禁止用 Git reset/stash/clean 代替事务回滚。
- Preview 或 staged Production smoke 失败只丢弃该部署，不改变源数据。promote 后生产 smoke 失败先执行 Vercel rollback 回上一已验证 Production 并复验；源码不自动倒回旧模型，而是保持备份、停止后续发布并修复向前。严禁临时恢复旧读链或手工复制旧 Progress 救火。
- 若 Vercel 账户、Environment Secrets、审批或域名配置缺失，工程门禁可继续到本地/clean-clone/独立验收，但发布与“允许新增 Python Course”保持未通过；不得用本地成功冒充生产验收。

### 允许开始 Python Course 的证据门

- Catalog 只登记完成迁移的 `go-backend` 为 Default Course；37 个语义 Lesson、Track/Stage、Day/legacy 映射、Course/Content/Evaluation Revision 均通过 exact-key、唯一性和逐字节证据。
- 私有 Day 0 Notes/Evaluation 与所有 Exercise 字节/历史完整，旧内部路径全部删除且未被 Git 跟踪；Release Progress Snapshot 与派生 Progress 一致。`docs/learning-records` 的既有用户文档整理保持原 hash。
- 通用评测 Skill 对 `(courseId, lessonId)` 工作，`$evaluate-go-day dayN` 只经显式映射路由到相同记录；零答案泄露、三次尝试、四态和允许命令测试全部通过。Core、Roadmap、生成器、审计器中不存在 Go、Day 0–36、三 Track/六 Stage 或旧目录硬编码；仅 Go manifest/policy/兼容 router、legacy generator 和对应测试允许命中。
- `/`、`/course.json`、37 个 `/sources/lessons/**` 与 `/courses/go-backend/**` 通过线上等价/字节/缓存/404/CSP 验收；Preview、staged Production、promote 后 Production smoke 与 Vercel metadata/Receipt 完全绑定。
- lint、typecheck、全部 unit、determinism、generated/dist/prebuilt audit、四视口 Playwright、12 张视觉证据、clean-clone build、候选指纹、dirty-tree/PID/hash 不变性与独立只读验收全部为通过且零未处置 finding。
- 以上任一证据缺失即不得创建 `courses/python-*`、Python Lesson、Exercise Template 或评测 Policy。Python 是验证框架可扩展性的下一项内容工作，不得反过来充当 Go 迁移的测试夹具或完成证据。
