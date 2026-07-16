# 冻结公开课程制品与永久兼容投影

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 02, 03, 09

## Question

多 Course 的 Catalog、课程数据、Markdown 资源和安全进度投影应采用什么公开契约，Default Go Course 的三个永久兼容入口如何由同一真相源生成并验证，才能避免新旧制品漂移或泄露私有学习内容？

## Answer

- 公开站点只消费一棵可删除重建的 fail-closed Public Projection；规范路径固定为：

  ```text
  /courses/catalog.json
  /courses/<courseId>/course.json
  /courses/<courseId>/progress.json
  /courses/<courseId>/sources/lessons/<lessonId>.md
  /courses/<courseId>/sources/resources/**

  /                              # go-backend SPA 兼容入口
  /course.json                   # Go legacy schema v3 兼容投影
  /sources/lessons/<legacy>.md   # Go legacy Lesson 兼容投影
  ```

- `/courses/catalog.json` 使用独立 `schemaVersion: 1`，只含 `defaultCourseId` 与有序 Course 摘要；摘要白名单为 `courseId`、`title`、`description`、`language`、`lifecycle`、`courseRevision`、规范页面/数据/Progress href，以及可选 `replacementCourseId`。Draft 不进入公开 Catalog；Published 与 Retired 都保留解析数据，发现界面默认只列 Published。
- `/courses/<courseId>/course.json` 使用独立 `schemaVersion: 1`，是无学习者状态的安全 Course 结构投影；允许 Course 身份、标题、描述、Language、生命周期、替代关系、`courseRevision`、Track、Stage 与 Lesson。公开 Lesson 只含 `lessonId`、生命周期、可选 Day、标题、目标、goals、所属结构 ID、`contentRevision` 与同源 `lessonHref`；禁止 Evaluation Revision、私有路径、答案、rubric、Command Profile、评测政策和 Progress 字段。
- `/courses/<courseId>/progress.json` 使用独立 `schemaVersion: 1`，白名单固定为 `courseId`、`courseRevision` 与按 Course manifest 顺序排列的 Lesson Progress；每项仅含 `lessonId`、四态 `status` 和 `referenceScore`。分数只能是 `null` 或 0–100 有限数；不得包含 Day、Notes、回答、评测历史、尝试次数、证据位置、路径或时间戳。
- Canonical Course Data 与 Public Progress 在同一次生成中按 `(courseId, courseRevision)` 配对；任一缺失、修订不一致、Lesson 集合重复/缺失/越界或存在非白名单字段，整个生成失败。Roadmap 不允许把旧 Course JSON、自身常量或缺失 Progress 补成成功数据。
- 规范 Lesson Markdown 路径只使用稳定 `lessonId`；补充本地资源只能来自 manifest 明示的 `resources/public`，投影到 `/sources/resources/**`。`resources/internal`、Exercise Template 和 Learning Record 无论内容看似安全都不得进入公开候选集合。
- Markdown 与 public resource 必须先通过结构化安全投影，再由 Reader 继续执行渲染级 sanitization。生成阶段删除或拒绝答案、rubric、评测材料、仓库治理链接、私有路径和内部引用；拒绝符号链接、非普通文件、二进制伪装、绝对路径、`..`、编码分隔符、空字节、`file:`、`data:`、`javascript:`、凭据 URL 与非 HTTPS 外部资源。
- Public Projection 的路径白名单由 Catalog 和每个 Course manifest 正向枚举；审计器必须拒绝任何未枚举文件、额外 Course、缺失 Lesson、大小写碰撞、重复映射、source map、源码、测试、日志、截图、证据、环境文件、密钥、内部域名、本机路径、Notes、Evaluation、Exercise 或 authoring reference。不得通过黑名单命中率推断“其余内容安全”。
- 生成器只读取规范 `courses` 与派生 Progress 所需的受限 Evaluation 快照，只写临时生成目录；全部解析、投影、路径审计和内容审计通过后才原子替换 `.generated/public`。相同规范输入必须产生逐字节相同的文件集合和内容，不写生成时间、随机 ID、绝对路径或 Git 工作区位置。
- 根 `/` 永久作为 `go-backend` 的 SPA 入口，不重定向，也不跟随未来 `defaultCourseId` 变化；应用在该路径加载规范 `/courses/go-backend/*` 制品。`/courses/go-backend` 是该 Course 的规范页面 URL，两者必须呈现同一 Course Revision。
- `/course.json` 永久保持当前 Go legacy `schemaVersion: 3` 的严格字段形状：`title`、`dayRange`、六个 Stage 与 Day 0–36 的 37 个 legacy Lesson，包含旧四态、参考分数和 `/sources/lessons/**` href；不得添加 `courseId` 或新字段破坏现有 exact-key parser。它由 `go-backend` manifest、派生 Progress 和显式兼容映射生成，不是第二份课程数据源；未来新增的非 legacy Lesson 只进入规范 v1 制品，不扩张 v3 集合。
- `go-backend` Source manifest 必须显式保存 37 个迁移 Lesson 的 legacy Day、legacy `day-NN` ID 与 legacy public path 到规范 `lessonId` 的一对一映射。生成器拒绝映射遗漏、碰撞、跨 Course 指向、Day 0–36 不连续或 legacy 文件名不匹配；禁止从新文件名、排序或 Markdown H1 猜映射。
- `/sources/lessons/<legacy>.md` 只为显式 legacy 映射生成，并与对应规范 Lesson 的安全 Markdown 逐字节相同；未知 legacy 路径返回 404，不得 SPA fallback、模糊匹配或目录列表。没有 legacy 映射的新 Lesson 不产生根级别名。
- 三个兼容入口与规范制品必须在同一次生成、同一审计和同一部署中发布。验收逐字段核对 v3 投影与 v1 `go-backend`/Progress 的 legacy 子集，并逐字节核对每个 legacy Markdown 与规范 Markdown；任何漂移阻止发布。兼容只存在于公开投影层，不保留旧源目录、不双写 Progress，也不让旧 ID 回流为内部身份。
- 稳定 JSON、Markdown、HTML 与兼容入口统一使用可重新验证缓存策略：`Cache-Control: public, max-age=0, must-revalidate`，并以响应字节或对应 Revision 生成强 ETag；稳定 URL 不使用 immutable。只有内容哈希文件名的前端静态资产使用长期 `immutable`，且构建继续禁止 source map。
- SPA rewrite 只处理不存在的应用页面路径，如 `/courses/<courseId>`；`/courses/**.json`、`/courses/**/sources/**`、`/course.json` 与 `/sources/lessons/**` 必须先按精确静态文件解析，缺失时返回 404，绝不能回退 `index.html`。所有响应继续接受 CSP、安全头、Content-Type、nosniff 和同源加载验收。
