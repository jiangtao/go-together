# 定义 Course 生命周期、替代与内容修订契约

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 02

## Question

在 Course 已具有稳定身份和 `draft`、`published`、`retired` 基础生命周期后，发布、退役、替代、内容修订与历史 Lesson 保留应采用什么规范规则，才能让公开 Catalog、缓存、学习记录和永久 URL 在课程演进中保持可解释且不丢失归属？

## Answer

- Course 生命周期是单向的 `draft → published → retired`。Draft 可改名、重排或删除尚未发布的内部元素，但不进入公开 Catalog、不能成为 Default Course，也不建立永久公开承诺；首次 Published 后 `courseId` 与全部已发布子 ID 冻结；Retired 为终态，不回退到 Published。
- 发布门禁要求 Catalog、Course manifest、全部稳定 ID、本地引用、Course Evaluation Policy、Command Profile、公开白名单和确定性修订摘要均通过校验。发布必须以完整 Course Revision 原子切换，禁止 Catalog、课程正文、Progress 或公开资源跨不同修订混装。
- `schemaVersion` 只描述数据契约形状，不表示课程内容版本；课程内容不使用手工 SemVer。每次构建确定性计算带 `sha256:` 前缀的完整摘要：`courseRevision` 汇总 Course manifest、结构、政策、资源与全部 Lesson 修订；每个 Lesson 分别具有覆盖完整教学内容的 `contentRevision`，以及只覆盖能力目标、必修证据、评分依据、Exercise Template、Course Policy 与 Command Profile 的 `evaluationRevision`。
- 纯排版、错别字或不改变评测契约的正文修订只改变 `contentRevision`，既有 Progress 继续有效；任何影响能力、证据、评分、练习模板或允许命令的修改必须改变 `evaluationRevision`。摘要由规范化输入生成，不允许编写者手工保持旧值或声明跳过重评。
- Evaluation Record 必须记录评测时的 `evaluationRevision` 和能力项快照。Progress 只接受与当前 Lesson `evaluationRevision` 匹配的最新有效 Evaluation；不匹配时，当前修订因尚无有效评测而派生为“未开始”，同时保留旧修订的全部历史、分数和“通过”事实。UI 可以显示“课程已更新”原因，但不得创造第五种学习状态。
- 同一 `evaluationRevision` 内“通过”保持终态；新的 `evaluationRevision` 不篡改、降级或删除旧通过记录，而是开启新的当前评测基线。安全失败、构建失败或修订摘要缺失不得触发进度重置，必须停止发布或评测。
- Published Course 可以在保持同一课程承诺时增加、重排或修订 Lesson。课程承诺指稳定的目标学习者、核心学习目标和达成结果；若这些边界发生实质变化，或新体系无法诚实继承大部分 Lesson 身份与学习记录，必须创建新的 `courseId`，不能用一次“大版本”覆盖原 Course。
- 已发布 Lesson 不得硬删除、改 ID 或把 ID 分配给新内容。退出当前 Curriculum 时将其标记为 Retired Lesson，保留最后内容、稳定 URL 与历史 Learning Record；它不再进入当前顺序、进度分母、“下一课”推荐或新评测，但仍可直接阅读和查看历史 Evaluation。Lesson 退役为终态，可用新的 Lesson ID 提供替代内容。
- Course 退役后从默认发现与新学习入口移除，不能成为 Default Course，也不允许开始新 Evaluation Cycle；其规范 URL、最后安全公开内容、课程修订信息和既有 Learning Record 必须继续可读。公开站点不得把 Retired Course 变成 404，也不得删除其历史 Progress 归属。
- 退役 Course 可声明一个可选 `replacementCourseId`，目标在建立关系时必须是同 Language 的 Published Course，且替代图必须无环。替代关系只表达推荐后继，不改变原 Course 身份，不重定向原 URL，不复制或自动映射 Lesson、Evaluation、Progress；如需学习记录映射，必须另有显式、可审计的迁移契约。
- Default Course 退役前必须在同一原子变更中先指定另一个 Published Default Course。Default 变化只影响未显式指定 Course 的新入口；已经冻结的 `/`、`/course.json` 与 `/sources/lessons/**` 永久继续解析 `go-backend`，即使未来 `go-backend` 退役也不跟随新 Default 漂移。
- 源 Catalog 登记 Draft、Published 与 Retired 全部 Course；公开制品排除 Draft，保留 Published 与 Retired 的直接解析所需数据；课程发现列表默认只展示 Published。Retired 标记和替代提示属于元数据，不得通过删除源内容模拟生命周期。
- 稳定课程与 Lesson URL 不携带修订号，内容响应必须可重新验证；`courseRevision`、`contentRevision` 与 `evaluationRevision` 用于 ETag、确定性构建、缓存失效和证据追踪。只有内容哈希命名的静态应用资产可以使用长期 immutable 缓存。
- 每次发布必须保留可回滚的上一完整制品及其 Revision Manifest。回滚恢复完整旧制品和对应 Catalog 投影，但不回写、不删除发布后产生的 Learning Record；评测器根据其中记录的 `evaluationRevision` 继续区分历史与当前，不允许回滚造成身份复用或记录覆盖。
