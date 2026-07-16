# 16 — 事务迁移 Go 并收缩旧内部契约

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 在已通过护栏的新框架上，把当前 37 个 Go Lesson、Course 文档、Day 0 Learning Record 和公开状态一次性迁入规范归属，并在同一逻辑切换中删除临时 adapter、旧内部读取点和旧存储；永久公开兼容继续由生成层提供。

**Blocked by:** 13 — 交付通用 Evaluation Core 与 Go Router；15 — 加固确定性 Release Gate 与证据链

**Status:** resolved

- [x] apply 前重新核对第 10 票 baseline、仓库外备份和当前 working tree；任何 drift 先停止，不自行清理或覆盖。
- [x] 37 个旧文件名语义 slug 成为固定 lessonId，Lesson 正文逐字节迁移；三个 Track、六个 Stage 和 37 条 Day/legacy mapping 与规范完全一致。
- [x] Go README、internal authoring references、Exercise Template 边界和 ignore 规则按规范落位；private/internal 目标没有 Git tracked 文件。
- [x] Day 0 Notes/Evaluation 与所有额外 Exercise 迁入稳定学习身份；Evaluation 历史字节一致，Notes 只有记录在 manifest 中的课程链接改写。
- [x] Release Progress Snapshot 从 Evaluation/无 Evaluation 规则重新导出，并与旧 37 条状态/分数逐项相等；旧手工 Progress 不成为源。
- [x] 受保护旧 Roadmap Course 数据先保全原始用户字节/hash，再退出运行时；私有路径和旧 resources 不进入 Public Projection。
- [x] 规范影子树与所有生成/评测/Roadmap/文档消费者已切换；在授权后的新迁移锁内核验零旧消费者并删除全部残余旧内部源，期间没有消费者运行。
- [x] 临时旧 Go adapter、glob/H1/Day 身份推导、双读、双写、symlink 和旧路径 fallback 在同一票内删除。
- [x] 旧 public/generated/dist/prebuilt 被视为缓存重建，不作为输入；新生成后规范 Go 与 legacy 输出通过字段/字节核对。
- [x] 当前用户已完成的 docs/learning-records 文档搬迁保持原路径和 hash，其他非迁移脏项与 baseline 一致。
- [x] 对最终 4 项操作逐步注入失败，均自动恢复全部新 baseline hash 后释放迁移锁；成功后保留仓库外原始备份，不自动删除。
- [x] 全局允许清单之外不再存在 Go、Day 0–36、固定三 Track/六 Stage、旧课程/Exercise/Progress 目录的运行时硬编码。

**Finalization:** 用户已授权终局迁移。`d303618` 已保全 `learning-records/0005…0008 → docs/learning-records/0005…0008`；新迁移基线 `7fb44f…e8f9` 以仓库外备份精确覆盖残余 4 个旧源。计划 `6eb663…ccf9` 在迁移锁内删除 `docs/go-learning/README.md`、Day 0 Notes/Evaluation 与 `roadmap/src/data/course.json`；Day 0 Notes 只保留一处课程链接规范化，Evaluation 可从规范记录逐字节恢复，README 已有规范评测入口，旧 Roadmap JSON 仅进入备份且不进入公开投影。4/4 个真实逐操作故障注入均自动回滚，最终 journal 为 `applied`；仓库外终局收据 `go-together-ticket16-authorized-finalization.json` 指纹为 `c9bdac…60d3`。初始 89 项 journal 的历史安装时序仍如实由旧收据记录；本终局事务只宣称它实际执行的残余旧源收缩与可验证回滚，不倒填历史。

**Verified evidence:** 37 个 Lesson 源/规范/legacy 字节等价；37 条旧/新状态与分数等价；Day 0 Evaluation 可从 `legacySourceBase64` 精确恢复；Notes 仅一个规范课程链接改写；原始 Evaluation Buffer 进入 `privateInputDigest` 且非法 UTF-8 fail-closed；根 `NOTES.md` 已逐字节迁入 ignored `courses/go-backend/resources/internal/teaching-notes.md` 并退出 Git。终局基线、备份、计划、4 份故障回滚 journal、成功 journal 与当时 Candidate 均由仓库外终局收据绑定。`2cebe31` 当时的完整 release gate 通过：lint/typecheck、167 Vitest、Evaluation 21+5、78 文件确定性、generated/dist/prebuilt 审计、四视口 Playwright 44 passed/52 skipped/0 failed 与 12 张证据；其 Receipt 只绑定该提交。后续候选的 Receipt 与 clean-clone 证明由第 17 票重新绑定，旧源零残留、私有路径零 tracked、5173 无 listener 的迁移结论不变。
