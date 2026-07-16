# 17 — 证明迁移候选与 Clean Clone 可复现

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 产出一个可交给独立验收的迁移后候选：真实 Go 数据、通用 Skill、Roadmap、规范/legacy 公共面、安全 prebuilt 和证据链全部通过；并在没有私有记录的全新 clone 中重复构建成功。

**Blocked by:** 16 — 事务迁移 Go 并收缩旧内部契约

**Status:** resolved

- [x] 完整 `verify:release` 通过：lint、typecheck、全部 unit、determinism、generated/dist/prebuilt audit、Playwright、evidence 和 Receipt 无跳过关键门禁。
- [x] Catalog 只登记迁移完成的 go-backend 为 Default；37 个 Lesson/Track/Stage/legacy/revision 通过 exact-key、唯一性和 hash 证据。
- [x] `/` 与规范 Go 页面呈现同一 Course Revision；legacy v3 逐字段等价，37 个 legacy/canonical Markdown 逐字节相同。
- [x] 私有 Day 0 Notes/Evaluation/Exercise 完整且 untracked，Release Snapshot 与派生 Progress 一致，旧内部路径零消费者。
- [x] 通用评测与 Go router 使用同一记录和状态机；准备、评测、回炉、重新开始、安全停止和零泄露测试通过。
- [x] 四视口 Roadmap 与 12 张候选视觉证据通过，覆盖 Course switch fixture、Canvas/Day/Reader/Zen、焦点和 transform。
- [x] 从全新 clone 在无 Learning Record/internal resource 条件下，仅凭提交的 Course Source、Release Snapshot 和 lockfile 完成相同 release build。
- [x] 两次 clean-clone/release 关键 manifest 与 prebuilt hash 一致；Release Receipt 精确绑定当前候选。
- [x] working-tree 非迁移脏项、docs/learning-records hash、仓库外备份和既有 5173 listener 与 baseline 一致。
- [x] 所有发现由原执行者修复并重跑完整门禁，不以局部测试替代候选级证明。
- [x] 本票不部署 Preview 或 Production，只冻结可独立验收的候选和无敏感证据目录。

**Verified evidence:** 本票状态提交后的候选由主工作区与两份无私有数据的 clean clone 各完成 14 步 `verify:release`。三份 Receipt 的候选 HEAD、工作树指纹、determinism、78 文件 generated tree、86 文件 dist tree 与 prebuilt manifest 摘要完全相同；视觉 evidence 清单按独立 run ID 变化。仓库外最终证明记录为 `go-together-ticket17-final-verification.json`；它不含 Secrets 或学习记录内容。
