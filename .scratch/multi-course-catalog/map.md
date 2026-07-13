# 多课程 Course Catalog 改造决策地图

Label: wayfinder:map
Status: resolved

## Destination

形成一份中文优先、可直接交给后续执行任务的多课程改造规范与适配计划。规范必须覆盖领域身份、Course Catalog、统一存储、公开兼容面、Roadmap、评测 Skill、安全生成、CI/CD、全量迁移与验收，并保证当前 Go Course 仍是 Default Course。

## Notes

- 领域：课程驱动学习框架；Course 是一级学习单元，Language 只是元数据。
- 每次决策会话使用 `grilling` 与 `domain-modeling`；一次只解决一张决策票。
- 本地图只产出决策，不实施产品代码、不移动用户记录、不部署。
- 当前 working tree 含用户未提交文档、练习和旧课程数据；后续实施必须先做基线与哈希保护。
- 所有 Course 最终使用同一套逻辑与归属模型，不为 Default Go Course 保留内部存储特例或双写链。
- 用户已授权后续决策采用证据驱动、保守且唯一的推荐直接冻结，不再逐项询问；每张票仍须记录理由、边界与可验证后果。

## Decisions so far

- [冻结 Course 身份、默认课与兼容边界](issues/01-freeze-course-identity-and-compatibility.md) — Course 是一级身份，Go 为默认课，规范 URL 按 Course 命名空间组织，旧公开入口永久兼容 Go，内部数据全部迁入统一模型。
- [定义 Course Catalog 与稳定标识契约](issues/02-define-course-catalog-contract.md) — Catalog 统一注册 Course；`go-backend` 是当前 Go Course 的永久身份，课程结构采用 Course 域内语义 ID，Day、顺序与路径均不再充当身份。
- [统一课程源、练习与进度的规范归属](issues/03-unify-course-storage-and-migration.md) — `courses/<courseId>` 是课程源，`learning-records/<courseId>/lessons/<lessonId>` 是私有学习记录；Evaluation 是单一评测事实源，Progress 与公开数据仅作派生投影，旧 Go 路径只参与一次性迁移。
- [统一评测 Skill 与课程进度语义](issues/06-unify-evaluation-skill-and-progress.md) — 通用 Evaluation Core 固定四态、评分与安全边界，Course Policy 和受审 Command Profile 处理语言差异；`evaluate-go-day` 仅作为 `go-backend` 的兼容路由，Progress 按稳定 Lesson 顺序派生。
- [定义 Course 生命周期、替代与内容修订契约](issues/09-define-course-lifecycle-and-revisions.md) — Course 单向经历 Draft、Published、Retired；稳定身份与确定性内容/评测修订分离，退役内容和记录永久可读，替代 Course 不重定向或自动继承进度。
- [冻结公开课程制品与永久兼容投影](issues/04-freeze-public-artifacts-and-compatibility.md) — `/courses/**` 提供 v1 Catalog、Course、Progress 与安全 Markdown；根入口、legacy v3 `/course.json` 和旧 Lesson 路径由 `go-backend` 同源生成并接受逐字段/逐字节一致性审计。
- [定义 Roadmap 多课程导航与状态模型](issues/05-define-roadmap-multicourse-experience.md) — URL 唯一决定 Active Course，Course/Progress 按修订配对加载；所有面板以稳定学习身份隔离，视口按 Course 缓存，现有 Go 根入口与 Day/Reader/Zen 体验保持兼容。
- [冻结多课程生成、审计与发布门禁](issues/07-freeze-multicourse-delivery-gates.md) — Catalog 驱动全 Course 原子确定性生成和三层 allowlist 审计；公开仓库以脱敏发布进度快照桥接私有 Evaluation，GitHub 只部署受审 prebuilt，并在 staged Production smoke 后 promote。
- [冻结 Go 全量迁移、回滚与验收顺序](issues/08-freeze-go-migration-and-acceptance.md) — 37 个 Go Lesson 以语义 ID 和显式 legacy 映射事务迁移；私有记录、发布快照、Skill、Roadmap 与兼容制品按影子构建、单次切换、独立验收和 staged Production 顺序闭环。

## Current frontier

- 无；全部决策票已关闭。

## Not yet specified

- 无；实施拆票由后续 `to-spec → to-tickets` 流程处理，不再属于本决策地图的 fog。

## Out of scope

- 编写 Python 课程正文、练习题或评测答案。
- 在本地图中修改产品代码、移动数据、运行迁移、发布或部署。
- 多用户账户、云端私有学习记录同步、计费与组织权限。
- 重命名 Git 仓库、Vercel 项目或现有产品品牌。
