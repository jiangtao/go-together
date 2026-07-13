# 16 — 事务迁移 Go 并收缩旧内部契约

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 在已通过护栏的新框架上，把当前 37 个 Go Lesson、Course 文档、Day 0 Learning Record 和公开状态一次性迁入规范归属，并在同一逻辑切换中删除临时 adapter、旧内部读取点和旧存储；永久公开兼容继续由生成层提供。

**Blocked by:** 13 — 交付通用 Evaluation Core 与 Go Router；15 — 加固确定性 Release Gate 与证据链

**Status:** ready-for-agent

- [ ] apply 前重新核对第 10 票 baseline、仓库外备份和当前 working tree；任何 drift 先停止，不自行清理或覆盖。
- [ ] 37 个旧文件名语义 slug 成为固定 lessonId，Lesson 正文逐字节迁移；三个 Track、六个 Stage 和 37 条 Day/legacy mapping 与规范完全一致。
- [ ] Go README、internal authoring references、Exercise Template 边界和 ignore 规则按规范落位；private/internal 目标没有 Git tracked 文件。
- [ ] Day 0 Notes/Evaluation 与所有额外 Exercise 迁入稳定学习身份；Evaluation 历史字节一致，Notes 只有记录在 manifest 中的课程链接改写。
- [ ] Release Progress Snapshot 从 Evaluation/无 Evaluation 规则重新导出，并与旧 37 条状态/分数逐项相等；旧手工 Progress 不成为源。
- [ ] 受保护旧 Roadmap Course 数据先保全原始用户字节/hash，再退出运行时；私有路径和旧 resources 不进入 Public Projection。
- [ ] 在迁移锁内安装影子树、切换生成/评测/Roadmap/文档消费者并删除旧内部目录；期间没有消费者运行。
- [ ] 临时旧 Go adapter、glob/H1/Day 身份推导、双读、双写、symlink 和旧路径 fallback 在同一票内删除。
- [ ] 旧 public/generated/dist/prebuilt 被视为缓存重建，不作为输入；新生成后规范 Go 与 legacy 输出通过字段/字节核对。
- [ ] 当前用户已完成的 docs/learning-records 文档搬迁保持原路径和 hash，其他非迁移脏项与 baseline 一致。
- [ ] 任一步失败自动恢复全部 baseline hash 后释放迁移锁；成功后保留仓库外原始备份，不自动删除。
- [ ] 全局允许清单之外不再存在 Go、Day 0–36、固定三 Track/六 Stage、旧课程/Exercise/Progress 目录的运行时硬编码。
