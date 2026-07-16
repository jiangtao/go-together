# 定义 Course Catalog 与稳定标识契约

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by:

## Question

Course Catalog、Course、Curriculum、Track、Stage、Lesson 与 Language 的最小规范字段、稳定标识规则、排序关系、默认解析及生命周期边界应如何定义，才能支持 Go 全量迁移和未来 Python Course，而不把 Day 或目录路径当成身份？

## Answer

- `Course Catalog` 是全部 Course 的唯一有序注册表；最小契约包含 `schemaVersion`、`defaultCourseId` 与 `courses`。Catalog 中每个 Course 的最小摘要包含 `courseId`、`title`、`description`、`language` 与 `lifecycle`。
- `Course` 是一级学习单元和归属根。`courseId` 全局唯一、采用稳定 kebab-case，发布后不可修改、删除后复用，也不得由 Language、Day、顺序、版本或目录路径推导。当前 Default Go Course 的永久 `courseId` 为 `go-backend`。
- `Language` 仅是 Course 的分类元数据，最小值为稳定 `id` 与展示 `label`；Go 使用 Language id `go`。同一 Language 可以拥有多个 Course。
- `Curriculum` 是一个 Course 独占的教学结构，不具有脱离 Course 的全局身份或独立生命周期。它由有序 Track、Stage 与 Lesson 组成。
- `Track` 是 Course 内的主题主干，最小字段为稳定 `trackId`、`title`、`description`；`Stage` 是 Track 内的学习阶段，最小字段为稳定 `stageId`、`title`、`description`；`Lesson` 是 Stage 内的最小学习单元，最小字段为稳定 `lessonId`、`title`、`objective`、`goals` 与可选 `day`。
- `trackId`、`stageId`、`lessonId` 仅需在所属 Course 内唯一，均采用语义化 kebab-case；移动、重排或改名不得改变 ID。旧 `day-NN`、数组位置和文件路径只能作为迁移输入或兼容信息，不能继续作为规范身份来源。
- Catalog 的 Course、Curriculum 的 Track、Track 的 Stage、Stage 的 Lesson 都由所属有序集合确定展示与学习顺序；顺序可变且不参与身份。`day` 仅是可选的 Course 内学习节奏标签；存在时必须在该 Course 内唯一，但可不连续。
- 稳定学习身份保持为 `(courseId, lessonId)`。Track 与 Stage 只组织 Curriculum，不成为 Exercise、Evaluation 或 Progress 的替代归属身份。
- 默认解析规则固定为：显式且有效的 `courseId` 优先；未显式指定时解析 `defaultCourseId`；未知、不可用或格式非法的 ID 必须返回明确的不存在结果，禁止静默回退。旧根入口永久映射 `go-backend`，不跟随最近访问课程或未来默认值漂移。
- Course 生命周期使用独立的 `lifecycle`，避免与 Lesson 学习状态混淆；基础状态为 `draft`、`published`、`retired`。Default Course 必须为 `published`；已发布或退役 Course 的 ID 永不复用，退役不得使历史学习记录失去归属。替代关系、退役后的公开行为与内容修订策略由后续独立决策冻结。
