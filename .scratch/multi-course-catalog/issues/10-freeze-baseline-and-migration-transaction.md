# 10 — 冻结基线与迁移事务护栏

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让迁移执行者可以在当前含用户未提交工作的 main working tree 上，先得到可验证、可重放、不会写入真实课程数据的基线、仓库外备份、dry-run 迁移计划和事务回滚能力；任何未知文件或基线漂移都在数据切换前停止。

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] 基线记录候选 HEAD、NUL 安全的 working-tree 状态，以及所有受影响文件的相对路径、类型、模式、大小和 SHA-256，不要求 clean tree。
- [x] 基线记录私有路径的 ignored/tracked 状态、Course/Exercise/Learning Record 文件集，以及 5173 listener 的 PID/command（存在时）。
- [x] 仓库外备份保留原始字节和第二份可独立验证的 hash manifest；备份路径、用户名或私有内容不进入仓库证据。
- [x] dry-run 计划完整列出 source→destination、预期新增/删除、权限、hash、Lesson identity 映射和唯一允许的 Notes 链接改写，且运行前后真实数据 hash 不变。
- [x] 计划拒绝 baseline drift、未知文件、重复目标、大小写碰撞、symlink、非普通文件、路径逃逸和未受保护的私有目标。
- [x] apply/rollback 使用迁移锁和操作日志；逐步骤故障注入后能够恢复路径、类型、模式、大小、字节和原 working-tree 状态。
- [x] 回滚实现不调用 reset、stash、clean、checkout 覆盖或其他破坏性 Git 命令。
- [x] 测试使用临时仓库，覆盖用户脏文件、Day 0 私有记录、额外 Exercise、旧 Progress、旧 Roadmap 数据和可选端口 listener。
- [x] 本票只建立护栏和读取基线，不移动、删除或改写当前真实 Go Course、Notes、Evaluation 或用户文档。

**Evidence:** `roadmap/scripts/course-migration.ts` 是唯一公开入口；临时 Git 仓库测试覆盖 37 Lesson、Day 0 Notes/Evaluation、ignored 未知文件、外部备份、CLI dry-run/apply/rollback、逐操作故障注入、PID/command 探测及原脏树恢复。真实 Course、Learning Record 与受保护 Roadmap 数据未作为测试输入或迁移目标。
