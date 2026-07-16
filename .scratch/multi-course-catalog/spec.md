# 多课程学习框架与 Go 兼容迁移冻结规范

Status: ready-for-agent

本规范综合 [Wayfinder 决策地图](map.md)及其全部已关闭决策票。本文没有待选方案；后续拆票、实现和验收均以本文为唯一范围契约，决策细节以对应 Wayfinder 票为证据来源。

## Problem Statement

当前仓库已经形成一套可用的 Go 36 天学习体系，但其领域身份、文件布局、Roadmap 运行时、评测 Skill、公开生成器、测试和发布链仍把“Go、单课程、Day 0–36、旧目录”当成隐含前提。Course、Language、Day、文件路径和学习记录的归属边界混杂，导致未来增加 Python Course 时容易复制整套逻辑、串联不同课程状态，或让 Day/目录意外成为永久身份。

现有 Roadmap 从单一 legacy 数据加载，画布布局和 Progress 仍包含 Go/Day 假设；现有评测入口直接解析旧课程与 `exercise/dayN`；生成器只认识 37 个 Go Lesson。仓库同时是公开 GitHub 仓库，而 Notes、Evaluation、回答、内部 rubric 和 Authoring Reference 必须保持私有，CI 不能直接读取这些本地事实源。若仅扩展现有 JSON 或保留双读、双写，将产生第二真相源并扩大泄露面。

现有 Go 用户还依赖根页面、legacy Course JSON、37 个旧 Markdown 地址、`$evaluate-go-day dayN`、Day Drawer、Markdown Reader 和 Zen 画布体验。这些外部兼容承诺不能因内部模型升级而中断；用户未提交的课程文档、Day 0 Notes/Evaluation、旧 Roadmap 数据和既有脏树也不能被迁移过程覆盖、暂存、清理或遗失。

因此需要一次兼容优先、可回滚且可独立验收的框架改造：先把 Course 确立为一级学习身份，再统一 Course Source、Learning Record、Evaluation、Progress、Roadmap 和发布链；完整迁移当前 Go Course 后，只有在永久兼容入口、安全门禁、生产发布及证据全部成立时，才允许开始编写 Python Course。

## Solution

建立由 Course Catalog 驱动的多课程学习框架。Course 是一级学习单元，Language 只是分类元数据；稳定学习身份统一为 `(courseId, lessonId)`，Day 只作为可选的 Course-local 节奏标签。当前 Go Course 永久使用 `go-backend`，继续作为 Default Course。

所有课程使用同一领域模型、存储规则、评测核心、生成器、Roadmap 运行时和发布管线。Course Catalog 注册全部 Course；每个 Course 拥有自己的 Curriculum、Lesson、Course Evaluation Policy 和资源；每个 Learning Record 只归属于一个稳定学习身份。Evaluation 是私有事实源，Progress 是派生视图，Public Progress 和 Release Progress Snapshot 均不得反向写回事实源。

公开站点以 `/courses/{courseId}` 为规范页面命名空间，并提供 v1 Public Catalog、Course、Progress、Lesson Markdown 与资源。根 `/`、legacy `/course.json` 和 `/sources/lessons/**` 永久映射 `go-backend`，由同一次生成产生，不保留旧内部存储或双写链。

Roadmap 从 URL 解析唯一 Active Course，按 Course Revision 配对加载 Course 与 Progress。Canvas、Day、Reader 和 Zen 均绑定稳定学习身份；首次加载完整 fitView，不默认聚焦某个 Day；切换课程不串联面板、异步结果或 React Flow transform。Go 继续保留现有三主干、六阶段、Day Drawer、应用内 Markdown Reader 和 Zen 体验。

评测统一通过 `$evaluate-course-lesson <courseId> <lessonId>`；`$evaluate-go-day dayN` 永久保留为只负责 Go Day 映射的兼容 router。所有 Course 共用四态、0–4 诊断评分、三次尝试、单 Lesson、单问题和零答案泄露约束；语言差异只通过 Course Policy 与受审 Command Profile 表达。

生成与发布使用 fail-closed 模型：本地私有工作区导出脱敏 Release Progress Snapshot；公开 CI 从 Catalog 枚举 Course，执行确定性生成、generated/dist/prebuilt 三层精确白名单审计、四视口 Playwright、证据指纹和线上 smoke。Vercel 只接收经过审计的 Build Output API v3 prebuilt，不接收源码或私有记录。

Go 迁移采用“冻结基线 → 先造护栏 → 旧兼容基准 → 影子迁移计划 → 单次逻辑切换 → 等价核对 → 全量门禁 → 独立验收 → staged Production”的唯一顺序。迁移器必须可 plan/apply/rollback，禁止 Git reset、stash、clean、长期双读、双写、symlink 或旧路径 fallback。

## User Stories

1. 作为现有 Go 学习者，我希望根页面仍然直接打开 Go 路线图，以便原有使用习惯不变。
2. 作为现有 Go 学习者，我希望旧 `/course.json` 继续返回原有 v3 字段形状，以便既有客户端不会因新增 Course 字段失效。
3. 作为现有 Go 学习者，我希望 37 个旧 Lesson Markdown URL 永久可访问，以便收藏和历史链接不失效。
4. 作为现有 Go 学习者，我希望 `$evaluate-go-day dayN` 继续可用，以便无需立即学习新的命令形式。
5. 作为现有 Go 学习者，我希望迁移后 Notes、Exercise 和 Evaluation 历史完整保留，以便学习证据不丢失。
6. 作为现有 Go 学习者，我希望现有四种学习状态含义不变，以便迁移前后 Progress 可解释。
7. 作为学习者，我希望每次评测只处理一个明确 Course 的一个 Lesson，以免跨课程混入问题或答案。
8. 作为学习者，我希望没有评测记录时显示“未开始”，而不是由目录、Day 或旧快照猜测状态。
9. 作为学习者，我希望课程评测修订变化时保留旧通过历史，并明确要求当前修订重新评测。
10. 作为学习者，我希望课程正文只发生排版修订时原有通过状态仍有效。
11. 作为学习者，我希望退役 Course 和 Retired Lesson 仍可阅读并查看历史记录，以免长期学习证据失去归属。
12. 作为学习者，我希望 Replacement Course 只是推荐，不自动重定向或复制 Progress，以便课程身份保持诚实。
13. 作为多课程学习者，我希望通过课程选择器切换 Published Course，以便在同一 Roadmap 应用中学习不同课程。
14. 作为多课程学习者，我希望浏览器 URL 明确表达当前 Course，以便刷新、分享、前进和后退都可预测。
15. 作为多课程学习者，我希望未知、Draft 或非法 Course URL 显示明确错误，而不是静默退回 Go。
16. 作为多课程学习者，我希望切换课程后 Day Drawer、Reader 和异步加载结果不会串到新 Course。
17. 作为多课程学习者，我希望每个 Course 独立记住本次会话的画布位置，以便切回时继续查看原位置。
18. 作为首次进入某 Course 的学习者，我希望默认看到完整路线全览，而不是被自动拉到推荐 Lesson。
19. 作为使用 Zen 的学习者，我希望打开并关闭 Day 或 Reader 后仍回到同一 Course 的 Zen 状态。
20. 作为使用键盘的学习者，我希望 Escape 依次关闭 Reader、Day 和 Zen，每次只退一层。
21. 作为使用键盘的学习者，我希望课程切换、Drawer、Reader 和 Zen 都有确定的初始焦点和焦点恢复。
22. 作为屏幕阅读器用户，我希望 Course 切换、Retired 状态、加载完成和 Zen 状态都有简洁的 live announcement。
23. 作为移动端学习者，我希望课程选择器、画布、Day Drawer 和 Reader 在 390×844 与 360×800 下无横向溢出。
24. 作为移动端学习者，我希望 Reader 使用全部可用宽度，以便 Markdown 正文易读。
25. 作为桌面端学习者，我希望 Reader 保持约 70vw 的全高右侧面板，以便同时保留路线背景上下文。
26. 作为课程作者，我希望新增 Course 只需登记 Catalog、Course manifest、Lesson 和 Policy，而不是复制 Go 应用逻辑。
27. 作为课程作者，我希望 Language 只是 Course 元数据，以便同一语言未来拥有多个独立 Course。
28. 作为课程作者，我希望 Track、Stage 和 Lesson 使用稳定语义 ID，以便重排或改名不破坏学习记录。
29. 作为课程作者，我希望 Day 可省略或不连续，以便不是所有 Course 都被迫采用日课形式。
30. 作为课程作者，我希望 Lesson 正文、public resource、internal authoring reference 和 Exercise Template 有清晰边界，以免材料误发布或误写。
31. 作为课程作者，我希望 Draft 不进入公开 Catalog，以便未完成课程不会被学习者发现。
32. 作为课程作者，我希望 Published 后 Course/Lesson ID 不可复用，以便永久 URL 和学习记录保持稳定。
33. 作为课程作者，我希望修改能力、证据、评分或练习模板时自动改变 evaluationRevision，以便重评行为可审计。
34. 作为课程作者，我希望 Release Progress Snapshot 只能由私有 Evaluation 导出，以免公开状态成为手工第二真相源。
35. 作为评测维护者，我希望所有语言复用同一 Evaluation Core，以便四态、评分和安全纪律不会分叉。
36. 作为评测维护者，我希望 Course Policy 只能收紧核心安全规则，以免语言适配关闭零泄露或身份边界。
37. 作为评测维护者，我希望 Command Profile 使用预审参数模板而非 shell 字符串，以免命令注入或工作区外写入。
38. 作为 Go 课程维护者，我希望原有四类 Go 验证命令继续受限可用，以便兼容现有工程证据流程。
39. 作为安全审查者，我希望 Notes、Evaluation、回答、rubric、internal resource、密钥和本机路径永不进入 Git 跟踪或部署物。
40. 作为安全审查者，我希望公开文件集由 Catalog 和 manifest 正向枚举，以便未知文件默认被拒绝。
41. 作为安全审查者，我希望文本和二进制资源都接受类型、大小、路径和内容审计，以免伪装文件绕过扫描。
42. 作为安全审查者，我希望 Markdown 在生成阶段和 Reader 渲染阶段各有一层安全控制，以减少单点绕过风险。
43. 作为发布维护者，我希望相同输入两次生成逐字节一致，以便 Course Revision、缓存和证据可重复验证。
44. 作为发布维护者，我希望 generated、dist 和 prebuilt 各自接受精确文件集审计，以便构建步骤不能偷偷扩张公开面。
45. 作为发布维护者，我希望每个候选都有绑定 HEAD、输入、修订、制品和测试证据的 Release Receipt，以便部署可归因。
46. 作为发布维护者，我希望 PR、main 和手动 fallback 使用同一个 release gate，以免不同事件产生不同质量标准。
47. 作为发布维护者，我希望 Production 先 staged、smoke 后 promote，以免未经验证的制品直接接管域名。
48. 作为发布维护者，我希望生产 smoke 失败时回到上一已验证部署，以便快速恢复服务。
49. 作为外部贡献者，我希望 fork PR 可以运行完整无 Secrets 质量门禁，但不能取得部署凭据。
50. 作为同仓贡献者，我希望通过受保护 Environment 审批后得到 Preview，以便在发布前验证真实托管行为。
51. 作为迁移执行者，我希望在不要求 clean working tree 的情况下冻结完整基线，以便保护用户现有未提交工作。
52. 作为迁移执行者，我希望在真实数据切换前用 fixture 完成所有护栏，以便迁移错误可以在无损环境中暴露。
53. 作为迁移执行者，我希望先生成完整影子树和操作计划，以便任何未知文件或映射都能在写入前停止。
54. 作为迁移执行者，我希望失败时按操作日志恢复逐文件 hash，以便不用破坏性的 Git 命令回滚。
55. 作为独立验收者，我希望看到旧、新 Lesson 字节、Evaluation 历史、Progress、URL 和 UI 的成对证据，以便验收不是依赖实现者口头结论。
56. 作为框架维护者，我希望只有 Go 迁移、兼容、clean-clone、Preview 和 Production 证据全部通过后才能新增 Python Course，以免用第二门课程掩盖框架缺陷。

## Implementation Decisions

### 1. 领域身份与 Catalog

- Course 是一级身份和所有课程内容的归属根；Language 只有稳定 `id` 与展示 `label`，不参与 Course 或 Learning Record 身份。
- Course Catalog 是全部 Course 的唯一有序注册表，使用独立 schemaVersion、defaultCourseId 和 Course 摘要。当前 Go Course 的永久 ID 为 `go-backend`，Language ID 为 `go`。
- Track、Stage、Lesson ID 在所属 Course 内唯一，采用发布后不可变的语义 kebab-case。稳定学习身份固定为 `(courseId, lessonId)`；排序、Day、标题和存储位置均不参与身份。
- Curriculum 顺序由 Catalog/Course manifest 的有序集合表达。Day 是可选且仅在 Course 内唯一的节奏标签，可不连续，不能被 Core、Progress 或 Roadmap 当作主键。
- Course 生命周期单向为 Draft → Published → Retired。Published/Retired ID 永不复用；Retired 内容和记录继续可读。Replacement Course 仅作同 Language 推荐，必须无环，不重定向、不复制 Progress。
- Default Course 必须 Published。根兼容入口永久绑定 `go-backend`，即使未来 defaultCourseId 改变或 Go Course 退役也不漂移。

### 1.1 多语言边界补充契约

- 每个 Course 的既有 `language` 字段就是唯一 Primary Language，用于 Catalog 分类、课程发现与语言专属评测适配；一个 Course 不得声明多个同等主语言。语言、运行时、框架、库和工具若仅补充教学语境，只能作为不参与身份的 Supporting Technology。
- 每个 Course 自行定义 Cadence，但必须保留明确的 Lesson 顺序；Day 是可省略、可不连续的 Course-local 展示标签。`go-backend` 永久保留 Day 0–36 兼容语义，未来 Course 不得被固定天数模板约束。
- Lesson 只由一个 Course 拥有；相似内容出现在另一 Course 时必须成为独立 Lesson，并拥有独立的 `(courseId, lessonId)`、修订、Evaluation、Progress 与 Learning Record。
- Course 可声明可选的 Recommended Prerequisite Course。该关系只提供学习建议，目标必须是 Published Course 且关系图无环；它不阻断访问、不改变 Active Course、不会自动创建、复制、映射或合并任何 Progress、Evaluation、Exercise 或 Learning Record。

### 2. 规范归属、存储与私有边界

- Catalog、Course manifest、Lesson、public resource、internal authoring reference 和 Exercise Template 均由 Course 所有；Notes、Exercise Workspace 和 Evaluation Record 由稳定学习身份所有。
- 规范存储以 Course 为根组织 Catalog、Course manifest、语义 Lesson、public/internal resources 和每 Lesson 的 Exercise Template；Learning Record 以 courseId/lessonId 组织 notes、evaluation 和 exercise。
- Evaluation 是状态、等级、尝试与历史的唯一事实源。Progress 由当前 Curriculum 和最新有效 Evaluation 派生；无 Evaluation 时为“未开始”。生成文件、Roadmap 数据和手工 Progress 均不得成为反向事实源。
- 公开仓库不得跟踪 Learning Record、internal resource、回答、答案或敏感材料。CI 使用本地 exporter 生成且可提交的 Release Progress Snapshot；快照只运输 courseId、courseRevision、私有输入摘要以及有序 lessonId/status/referenceScore。
- Course Revision 与 evaluationRevision 涉及私有 Policy/Template 时，必须由完整本地 authoring workspace 确定性导出并绑定 Release Progress Snapshot；公开 CI 验证声明、公共内容摘要、快照和制品的一致性，但不伪装成重新读取私有事实源。所有 revision 字段均由工具生成，禁止手工维持旧值。
- 所有路径引用使用 manifest 中的稳定 ID 和仓库相对 POSIX 路径；拒绝绝对路径、`..`、符号链接逃逸、大小写碰撞和从文件名/H1 反推身份。
- 单写者固定：作者只写 Course Source，学习者只写 Notes/Exercise，评测只写 Evaluation，exporter 只写 Release Progress Snapshot，生成器只写可删除重建的生成目录。

### 3. 修订、重评与退役

- schemaVersion 只表示契约形状。courseRevision、contentRevision、evaluationRevision 使用带 `sha256:` 前缀的确定性摘要，不使用手工 SemVer。
- contentRevision 覆盖完整 Lesson 教学内容；evaluationRevision 覆盖能力、必修证据、评分依据、Exercise Template、Course Policy 和 Command Profile；courseRevision 汇总 Course 结构、资源、政策和全部 Lesson 修订。
- 纯排版或不改变评测契约的修改只改变 contentRevision，现有 Progress 保持有效。能力、证据、评分、模板或允许命令变化必须改变 evaluationRevision。
- Evaluation 保存评测时的 evaluationRevision 与能力快照。只有与当前 evaluationRevision 匹配的最新有效 Evaluation 参与当前 Progress；不匹配时当前状态派生为“未开始”，旧通过和历史保留。
- 同一 evaluationRevision 中“通过”为终态。Retired Lesson 不再进入当前顺序、分母、推荐或新 Evaluation，但保留内容和历史；Retired Course 不允许开始新评测周期。
- 每次发布和回滚都以完整 Course Revision 为单位，禁止 Catalog、Course、Progress 或资源跨修订混装。

### 4. Public Projection 与永久兼容

- 规范公开命名空间固定为 `/courses/catalog.json`、`/courses/{courseId}/course.json`、`/courses/{courseId}/progress.json`、Course-scoped Lesson Markdown 与 public resources；页面规范 URL 为 `/courses/{courseId}`。
- Public Catalog、Course 和 Progress 分别使用严格 v1 exact-key schema。Public Course 不含 Progress、evaluationRevision、Policy、私有路径或答案；Public Progress 每 Lesson 只含 lessonId、四态和 referenceScore。
- Published 和 Retired 进入公开解析数据，Draft 完全排除。Catalog、Course、Progress 必须在 courseId、courseRevision、Lesson 集合和顺序上严格配对。
- 根 `/` 不重定向并加载规范 `go-backend` 制品。legacy `/course.json` 永久保持 schema v3 的标题、Day range、六 Stage、37 Lesson、四态、分数和旧 Markdown href，不增加新字段。
- 37 个 legacy Markdown 由显式兼容映射生成，与对应规范安全 Markdown 逐字节相同。未知 legacy 路径返回 404；非 legacy Lesson 永不自动获得根级别名。
- Markdown/public resource 先做结构化安全投影，再由 Reader 禁止原始 HTML并规范化链接。internal resource、Exercise Template、Learning Record 和 Authoring Reference 无条件排除。
- 稳定 HTML/JSON/Markdown 使用 must-revalidate 与强 ETag；只有内容哈希 asset 使用长期 immutable。数据和资源缺失必须 404，只有不存在的应用页面可 SPA fallback。

### 5. Roadmap 产品体验与状态模型

- URL 是 Active Course 的唯一选择源。根入口解析 `go-backend`；规范 Course URL 精确解析 Public Catalog。非法、未知或 Draft ID 显示明确 not-found，不使用最近访问或 localStorage 回退。
- 应用先加载 Public Catalog，再并行加载目标 Course 与 Progress；使用 AbortController、请求代次和 courseId 丢弃迟到结果。失败保留目标 URL，不展示旧 Course，也不补默认 Progress。
- 运行时拆为 RouteState、按 courseId/courseRevision 标识的 CourseLoadState、互斥 Surface 和正交 zen。Day/Reader Surface 必须携带完整稳定学习身份；Course 变化原子重置为 canvas。
- Header 保留 Active Course 标题。至少两个可发现 Published Course 时显示 shadcn Select，使用 BookOpen Lucide 图标、Language 和当前标题；只有一个时显示静态身份。Retired 只可直达，Header 显示退役与 Replacement 提示。
- Course Select 只在普通 canvas 可操作，使用 history.pushState；popstate 走同一加载流程。切换后焦点返回 Select，深链接/历史加载后聚焦 h1，错误聚焦错误区域。
- React Flow transform 按 courseId/courseRevision/desktop-or-mobile 在内存隔离。首次进入或修订/布局档变化执行 duration 0 的完整 fitView；返回同一组合恢复 transform。用户拖拽/缩放取消待恢复任务。
- 画布完全由 Course Track/Stage/Lesson/Progress 构建，不含 Go、固定三 Track/六 Stage、连续 Day 或 day-* ID 常量。Go 数据仍产生现有结构；无 Day Lesson 显示“第 N 课”。
- Zen 继续为 app-level CSS 聚焦状态。Day/Reader 可在 Zen 内打开，关闭后返回 Zen；Escape 分层为 Reader → Day → Zen。Zen、Drawer 和 Reader 均不得改变画布 transform。
- Day Drawer 只展示当前 Lesson 的材料、Notes、Evaluation 与状态，不突出总览或分阶段进度。Reader 保持应用内安全 Markdown、桌面约 70vw、移动端全宽。
- Drawer/Reader 启用 autoFocus：Day 默认关闭按钮；Day→Reader 默认返回按钮；canvas→Reader 默认关闭按钮。关闭回原 trigger，trigger 已销毁时回新 Course h1。
- UI 延续现有 shadcn、Lucide、React Flow 和克制视觉语言；加载用结构骨架，禁止全局 spinner、渐变、装饰卡片和无意义动效。触控目标至少 44×44 px，并遵守 reduced-motion。

### 6. 通用评测与 Progress

- 唯一通用入口为 `$evaluate-course-lesson <courseId> <lessonId>`，承担准备、开始/继续评测和状态查询；必须显式提供稳定学习身份。
- `$evaluate-go-day dayN` 永久保留为兼容 router，固定 go-backend，通过 Go manifest 的显式 Day 映射调用同一 Core；禁止保留旧目录扫描、独立评分或第二份 Policy。
- Evaluation Core 固定：单 Lesson、单问题、只依据当前 Lesson、零答案泄露、每能力项最多三次、0–4 诊断分、全部能力项至少 3 才通过，referenceScore 为等级总和占满分比例的四舍五入结果。
- 四态固定为未开始、定向回炉、重新学习、通过；系统失败、安全停止、解析失败和工具缺失不是第五状态。重新学习后只有学习者显式开始新周期才恢复评测，旧历史不删除。
- Course Evaluation Policy 规定栏目、证据和 Command Profile，只能收紧 Core。Command Profile 使用参数数组模板、最小环境、固定 Exercise Workspace、无网络、超时和工作区外写入禁止。
- Go Profile 仅允许课程明确要求的 go test、go test -race、go vet 和 go test -bench 模板；可能访问数据库/网络的命令仍不自动执行。
- 准备模式排他创建 Notes，可在显式请求时初始化 Exercise Template；覆盖需要本次请求明确授权，不创建 Evaluation、不执行命令、不填写答案。
- 评测模式只读当前 Lesson、Policy、Notes、Evaluation 及 Notes 明示的当前 Exercise 证据，只原子更新 Evaluation 当前快照并追加历史；不修改其他事实源。
- 发现 token、密钥、DSN、认证头或完整隐私数据时只追加不含原文的安全终止事件，保持上一次有效状态和分数。
- Progress、Stage 进度和推荐 Lesson 均按 manifest 的当前 Lesson 顺序派生，不按 Day 或文件名；评测不得直接写 Public Progress 或部署物。

### 7. 生成、安全审计与候选证据

- 所有 Course 使用同一 Catalog-driven 生成器。Source Catalog 与 Course 目录必须一一对应；Source 全生命周期接受校验，只有 Published/Retired 生成公开制品。
- 每个公开 Course 必须存在匹配 courseId/courseRevision 的 Release Progress Snapshot。缺失、过期、额外 Snapshot 或 Lesson 集不一致使全局生成失败。
- 每 Course 在独立临时目录生成；全部 Course、Catalog、Go compatibility、路径和内容审计通过后才原子替换成功输出。失败保留上一次成功输出且不改写任何源。
- 确定性门禁在两个全新临时根完整生成两次，比较排序后的相对路径、大小和 SHA-256。制品不得含时间、随机数、绝对路径、工作区位置或平台相关遍历顺序。
- generated、dist、prebuilt 均按 Catalog/manifest 精确 allowlist 审计。拒绝额外/缺失文件、symlink、非普通文件、路径穿越、大小写碰撞、source map、源码、测试、日志、证据、环境文件、私有学习内容和密钥。
- 文本扫描覆盖 JSON/HTML/JS/CSS/SVG/Markdown/文本资源；二进制校验扩展名、magic bytes、大小和 manifest hash。不能以黑名单未命中作为安全证明。
- dist 只允许 Public Projection、index 和哈希 asset；prebuilt static 与 dist 逐字节相同，config 与受审 Build Output API v3 配置逐字节相同。
- Release Receipt 绑定 candidate HEAD、working-tree fingerprint、Node/npm/Vercel 版本、lockfile、Catalog、所有 Course Revision、Release Snapshot、双生成 manifest、dist/prebuilt、测试与 E2E evidence hash；任何输入变化使旧证据失效。

### 8. Go 一次性迁移

- Go 的 37 个初始 lessonId 固定为旧文件名 `day-NN-` 后的唯一语义 slug。三个 Track ID 固定为 language-and-web、data-and-service-contracts、runtime-and-agent；六个 Stage ID 固定为 language-foundations、http-and-data-entry、data-boundaries-and-contracts、grpc-service-chain、concurrency-and-operability、agent-slice-and-review。
- Lesson 正文逐字节迁入 go-backend Course；Day、legacy day-NN ID 和旧 Markdown path 只进入显式一对一兼容映射。
- Go README 迁为 Course README；旧课程总纲、daily README 和 capstone rubric 迁为本地 untracked internal authoring references。现有 docs/learning-records 文档整理保持原样，不被误识别为学习者记录。
- exercise/dayN 的 Notes、Evaluation 和其他产物按映射迁入 go-backend Learning Record；Evaluation 历史逐字节保留，Notes 只允许受测课程链接重写。
- 旧人工 Public Progress 被从 Evaluation 重新导出的 Release Progress Snapshot 取代并逐 Lesson 比对。旧 Roadmap Course 数据只做受保护备份和结构交叉核对，不是状态或公开事实源。
- 迁移执行固定九步：基线与仓库外备份；fixture 护栏；冻结旧兼容基准；影子计划；逻辑原子切换；兼容重建；本地/clean-clone 门禁；独立验收/发布；保留长期无敏感证据。
- 迁移锁期间禁止消费者运行。任何失败必须按操作日志恢复全部 baseline hash 后释放锁；禁止 Git reset/stash/clean、symlink、双读、双写和旧路径 fallback。
- 旧内部目录、旧 Progress、旧 Roadmap 数据在切换点删除；旧 public/generated/dist/prebuilt 作为不可信缓存清理并从新链重建。仓库外原始备份保留到用户明确清理，自动化不得删除。

### 9. CI/CD 与 Vercel

- Node 固定 24.x、npm 固定 11.x，依赖只用 npm ci；Vercel CLI 使用 lockfile 中 exact version。GitHub Actions 固定 commit SHA 并采用最小权限。
- 唯一 release gate 为 fail-fast verify:release：候选/私有路径预检、lint、typecheck、unit、双生成/determinism、generated audit、Vite build、dist audit、prebuilt package/audit、四视口 Playwright、evidence/Receipt audit。
- PR 到 main 不使用 paths 过滤，并在无 Secrets 环境执行完整门禁。fork PR 永不部署；同仓 PR 只有通过受保护 roadmap-preview Environment 审批后才部署 Preview。
- main push 对实际 main SHA 重新运行完整门禁，只构建一个 prebuilt；以 production skip-domain 创建 staged Production，smoke 通过后 promote 同一制品，再 smoke 生产域名。
- workflow_dispatch 必须指定 40 位 candidate SHA 和 target，重跑完整门禁；Production SHA 必须属于 main 历史。deployment_status 不作为质量事实源，不保留独立触发工作流。
- Deploy job 不 checkout 或执行候选代码，只校验 artifact/Receipt、写临时项目元数据并运行固定 CLI。线上 smoke 在无 Secrets job 执行。
- Preview/staged smoke 失败不 promote。生产 smoke 失败立即 rollback 到上一 Production 并复验；源码保持新模型并停止发布、修复向前。
- Vercel Git Integration、source deployment 和 cloud source build 继续关闭；根 source ignore 精确拒绝全部源码，source build 命令显式失败。唯一部署物是 audited Build Output API v3。
- 单一 Vercel Project 固定为 go-together-roadmap；所有 Course 共用同一站点。Preview 和 Production 使用独立 GitHub Environment secrets、branch policy 与串行 production concurrency。

### 10. Python 开课门禁

- 在 Go 迁移完成前，不得创建 Python Course、Lesson、Exercise Template 或 Policy，也不得用 Python fixture 代替 Go 迁移完成证据。
- 允许开始 Python 的必要条件为：规范 Go Source/Learning Record/Release Snapshot 完整；旧内部路径零消费者；通用 Skill 与 Go router 通过；root/canonical/legacy 线上兼容通过；full release gate、12 张证据、clean-clone、Preview、Production 和独立验收全部通过且零未处置 finding。
- Vercel 账户、Environment Secrets、审批或域名缺失时，本地工程可继续收敛，但 Python 开课门保持关闭。

## Testing Decisions

### 测试原则与最高接缝

- 测试只断言领域与用户可观察行为，不断言组件内部 state、私有函数调用次数或临时目录实现细节。
- 生成、安全、打包和发布候选以单一 verify:release 为最高接缝；同一命令必须在本地、PR、main 和 workflow_dispatch 上产生同一门禁语义。
- 迁移以 plan/apply/rollback CLI 对临时完整工作区为最高接缝，断言源/目标字节、操作日志、失败恢复和 baseline invariants。
- 评测以 `$evaluate-course-lesson` 及 `$evaluate-go-day` CLI 为最高接缝，断言稳定身份、允许读写集、状态机和零泄露。
- Roadmap 以真实 HTTP Public Projection 和 Playwright 浏览器行为为最高接缝，避免通过 mock 组件状态证明课程隔离。
- 仅对 exact-key parser、revision hash、路径规范化、Markdown sanitizer、命令模板和 route precedence 等难以通过高层测试定位的纯边界增加 unit。

### 单元与集成

- Catalog/Course/Public Course/Public Progress/Release Snapshot 使用 exact-key 测试，覆盖字段缺失、额外字段、非法 ID、重复 ID、生命周期、default、replacement 环和顺序。
- Revision 测试覆盖排版变化、评测契约变化、旧 evaluationRevision、Retired Lesson、通过终态和完整 Course Revision 原子配对。
- 路径/安全测试覆盖绝对路径、`..`、编码分隔符、空字节、大小写碰撞、symlink、非普通文件、错误 MIME、二进制伪装、凭据 URL、危险协议和非 HTTPS 外链。
- Markdown 测试覆盖 rubric/答案/评测内容剔除或拒绝、HTML 禁止、相对图片/外链规范化、仓库治理路径和本机路径。
- Progress 测试覆盖无 Evaluation、四态转换、三次尝试、0–4 评分、revision 失配、manifest 顺序、无 Day Lesson、Retired 分母和推荐 Lesson。
- Command Profile 测试覆盖参数数组、工作目录、最小环境、超时、网络/安装/生成/写入拒绝，以及 Go 四类允许模板。
- Generator 测试使用至少五类 fixture：Go compatibility Course、结构不同且无 Day 的非默认 Course、Draft、Retired、恶意/缺失数据。不得编写真实 Python 课程内容。
- Audit/prebuilt 测试覆盖全 Catalog 枚举、额外/缺失文件、三层字节一致、静态资源缓存、数据 404 优先于 SPA、source map 和 source deployment 禁止。
- Candidate evidence 测试覆盖 HEAD、fingerprint、input hash、截图文件集、CSS×DPR、非空 PNG、manifest/prebuilt hash 和任一输入变化使证据失效。

### 迁移测试

- 在临时仓库构造 37 个旧 Lesson、Day 0 Notes/Evaluation、额外 Exercise、用户脏文件、旧 Progress、旧 Roadmap 数据和可选 5173 进程；plan 必须完整分类且不写入。
- apply 必须产生 37 个语义 Lesson 与一对一 legacy 映射，保持 Lesson/Evaluation 字节，仅产生允许的 Notes 链接 diff，并从 Evaluation 导出相等 Progress。
- 在每个操作步骤注入失败，rollback 必须恢复路径、类型、模式、大小、SHA-256、dirty-tree 和 listener；不得调用破坏性 Git 命令。
- 测试拒绝 baseline drift、未知文件、重复 slug、缺失 Lesson、旧/新目标碰撞、tracked private path、Snapshot 不一致和备份 hash 失败。
- 迁移后的全局搜索必须证明旧目录、Go/Day/固定结构硬编码只存在于 manifest、Go Policy/router、legacy generator、迁移证据和对应测试的允许清单。

### Playwright 与视觉证据

- 四个项目固定为 1440×900、1024×768、390×844、360×800；不得复用 5173，测试服务器独占 4173 且 reuseExistingServer 为 false。
- 覆盖根与规范 Go URL 等价、第二 Course 切换/history、迟到请求、首次全览、逐 Course transform、无 Day Lesson、Retired、not-found、解析错误、loading/retry。
- 覆盖 Day、Reader、Zen、Escape 分层、autoFocus、焦点恢复、course change fallback focus、键盘操作、reduced-motion、无横向溢出和安全区。
- Reader 覆盖同源 Markdown、危险 URL、相对资源、加载/失败/重试、桌面 70vw、移动全宽及关闭返回路径。
- 每个项目断言零 console error、pageerror 和非预期 network failure。
- 固定 12 张候选视觉证据：Go desktop/mobile 的 normal、Zen、Zen+Day、Zen+Reader，共 8 张；desktop/mobile 的 Course Select 展开和非默认 Course normal，共 4 张。证据只接受规定名称、尺寸、DPR、非空内容与当前 fingerprint。

### Release、线上与独立验收

- verify:release 必须按固定顺序执行且 fail-fast，任何失败都禁止上传 artifact。连续两次在全新临时根生成的路径、大小和 SHA-256 必须一致。
- clean-clone 验证不包含私有 Learning Record/internal resources，只凭提交的 Course Source、Release Snapshot 和锁文件完成 release build。
- 线上 HTTP smoke 枚举 Public Catalog 中全部 Published/Retired Course，验证 Course/Progress、全部 Lesson/resource、ETag/cache、安全头、MIME、404 和 hashed asset。
- Go compatibility smoke 逐字段核对 legacy v3 与规范 Go 子集，并逐字节核对 37 个 legacy/canonical Markdown。
- 浏览器 smoke 至少逐 Course 在桌面打开 canvas/Reader，并对 Default Course 跑四视口、Course switch、Drawer、Zen、焦点和零运行时错误。
- Vercel inspect 必须证明 URL 属于目标项目/环境，metadata 与 candidate HEAD、Catalog digest、prebuilt digest 和 Release Receipt 一致。
- 独立验收者只读核对迁移 manifest、备份、hash、private tracked set、Skill、Public Projection、UI 证据、prebuilt 和线上 smoke；所有 finding 退回原执行者修复后 fresh 复验，零 finding 才通过。

## Out of Scope

- 编写 Python 课程正文、Python Exercise Template、Python Command Profile 或 Python 评测答案。
- 多用户账户、登录、权限、云端私有 Learning Record 同步、协作编辑、计费或组织管理。
- 把本地私有 Evaluation/Notes 上传 GitHub、Vercel、对象存储或其他云端。
- 改变当前课程品牌、重命名 Git 仓库、拆分 Vercel Project 或按 Language 部署多个站点。
- 将根兼容入口重定向到未来 Default Course，或删除 `/`、`/course.json`、`/sources/lessons/**` 的 Go 永久兼容。
- 自动映射 Replacement Course 的 Lesson/Progress，或把退役课程/课次硬删除。
- 引入第五种学习状态、奖励/排名、跨 Lesson 评分、自动答案提示或开放任意 shell。
- 保留旧内部目录作为长期兼容、symlink、双读、双写、手工 Public Progress 或公开制品反向同步。
- Vercel source build、Git Integration 自动源码部署、重复部署器或未经审计的云端构建。
- 低保真 UI 原型、额外说明区、装饰性卡片、渐变、品牌重设计或无关 Roadmap 功能扩张。

## Further Notes

- 当前事实基线：Go Course 有 37 个文件名/H1 一一匹配且语义 slug 唯一的 Lesson；公开进度 37 条均为“未开始”、分数为 null；本地仅有 Day 0 Notes/Evaluation，Evaluation 当前也是“未开始”。这些是迁移前核对事实，不是永久 schema 假设。
- 当前远端仓库是 Public；因此 private Learning Record/internal authoring reference 必须 untracked。当前 release chain 已使用 Node 24、npm lock、Vite、React、shadcn、React Flow、Playwright 和 audited Vercel prebuilt，可复用但不能视为多 Course 已完成。
- 当前 working tree 含用户未提交文档整理、Go README、Day 0 私有记录和旧 Roadmap 数据。实施必须把该脏树作为 baseline；不得先清理、stash、stage、commit 或还原。`docs/learning-records` 的四份用户文档已与旧位置逐字节一致，应保持该既有改动。
- 账户级阻塞只有 Vercel 认证/项目关联、GitHub Environment Secrets/审批规则和生产域名。缺少它们不阻止本地实现与验收准备，但阻止 Production 完成和 Python 开课门通过。
- 需求来源为同目录 Wayfinder 地图及九张 resolved 决策票。拆票必须采用纵向 tracer bullet：先建立可验证的最小 Course 框架与迁移护栏，再迁移真实 Go 数据、切换 Roadmap/Skill、加固发布，最后独立验收；不得按“先改完所有 schema、最后补测试”拆成横向大票。
