# 16 — 事务迁移 Go 并收缩旧内部契约

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 在已通过护栏的新框架上，把当前 37 个 Go Lesson、Course 文档、Day 0 Learning Record 和公开状态一次性迁入规范归属，并在同一逻辑切换中删除临时 adapter、旧内部读取点和旧存储；永久公开兼容继续由生成层提供。

**Blocked by:** 13 — 交付通用 Evaluation Core 与 Go Router；15 — 加固确定性 Release Gate 与证据链

**Status:** blocked

- [x] apply 前重新核对第 10 票 baseline、仓库外备份和当前 working tree；任何 drift 先停止，不自行清理或覆盖。
- [x] 37 个旧文件名语义 slug 成为固定 lessonId，Lesson 正文逐字节迁移；三个 Track、六个 Stage 和 37 条 Day/legacy mapping 与规范完全一致。
- [x] Go README、internal authoring references、Exercise Template 边界和 ignore 规则按规范落位；private/internal 目标没有 Git tracked 文件。
- [x] Day 0 Notes/Evaluation 与所有额外 Exercise 迁入稳定学习身份；Evaluation 历史字节一致，Notes 只有记录在 manifest 中的课程链接改写。
- [x] Release Progress Snapshot 从 Evaluation/无 Evaluation 规则重新导出，并与旧 37 条状态/分数逐项相等；旧手工 Progress 不成为源。
- [x] 受保护旧 Roadmap Course 数据先保全原始用户字节/hash，再退出运行时；私有路径和旧 resources 不进入 Public Projection。
- [ ] 在迁移锁内安装影子树、切换生成/评测/Roadmap/文档消费者并删除旧内部目录；期间没有消费者运行。
- [x] 临时旧 Go adapter、glob/H1/Day 身份推导、双读、双写、symlink 和旧路径 fallback 在同一票内删除。
- [x] 旧 public/generated/dist/prebuilt 被视为缓存重建，不作为输入；新生成后规范 Go 与 legacy 输出通过字段/字节核对。
- [x] 当前用户已完成的 docs/learning-records 文档搬迁保持原路径和 hash，其他非迁移脏项与 baseline 一致。
- [ ] 任一步失败自动恢复全部 baseline hash 后释放迁移锁；成功后保留仓库外原始备份，不自动删除。
- [x] 全局允许清单之外不再存在 Go、Day 0–36、固定三 Track/六 Stage、旧课程/Exercise/Progress 目录的运行时硬编码。

**Blocker:** 中控明确禁止修改、暂存或删除用户已有的 `docs/go-learning/README.md`、`exercise/day0/**`、`roadmap/src/data/course.json` 与 `learning-records`→`docs/learning-records` 脏树搬迁。它们虽已从全部运行时消费者和公开投影退出，但旧 README/本地 Exercise 仍会形成误导入口，且未暂存的用户文档搬迁会使候选门禁拒绝 tracked `learning-records/**`。最初 applied journal 只绑定第一阶段 89 项 copy/rewrite/delete；仓库外 append-only `go-together-ticket16-finalization.json` 已补充绑定 guarded baseline/plan/journal、135 个最终树条目、37 Lesson/Notes/Evaluation/Snapshot 等价、零 symlink/旧消费者、5173 不变量及 142 项反向操作，fingerprint `d9b160bc7b8c95de55e802814312d626a663238a40211606ef1c510195dca6a9`。该补救提供可独立复核的最终/回滚证据，但不伪称后续文件是在原迁移锁内安装。因此第 16 票保留受权限影响的迁移锁完整切换与旧源删除未完成，第 17–19 票不得越过。

**Verified evidence:** 37 个 Lesson 源/规范/legacy 字节等价；37 条旧/新状态与分数等价；Day 0 legacy Evaluation 可从 `legacySourceBase64` 精确恢复；Notes 仅一个规范课程链接改写；原始 Evaluation Buffer 进入 `privateInputDigest` 且非法 UTF-8 fail-closed；根 `NOTES.md` 已逐字节迁入 ignored `courses/go-backend/resources/internal/teaching-notes.md` 并退出 Git。新增仓库外 append-only `go-together-ticket16-notes-supplement-b253a29.json` 绑定原 finalization fingerprint、源 blob/hash、ignored 目标、staged 删除、外部备份、非破坏性反向操作、protected invariant 与 5173；supplement fingerprint `61e1798c031254e3a49c602de9c35ee67cc372d9d8ed53d4b3aa398bf1ac3bbe`，文件 SHA-256 `01da81468fb49287671edf5be290a898883269d8f1039ef2d2ff4255bb262c37`。lint/typecheck、167 Vitest、Evaluation 21+5、78 文件确定性、generated/dist/prebuilt 审计、四视口 Playwright 44 passed/52 skipped/0 failed 与 12 张证据均通过。受保护三文件 hash 与 5173 无 listener 状态保持基线。
