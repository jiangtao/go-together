# 11 — 建立 Course 契约与安全发布快照

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让维护者可以用同一套严格契约描述任意 Course、Curriculum、Lesson、生命周期、修订和派生 Progress，并在完整本地私有工作区中导出公开 CI 可安全消费的 Release Progress Snapshot；尚不迁移真实 Go 数据。

**Blocked by:** 10 — 冻结基线与迁移事务护栏

**Status:** resolved

- [x] Catalog、Source Course、Public Catalog、Public Course、Public Progress 和 Release Progress Snapshot 均有独立 schemaVersion 与 exact-key parser。
- [x] parser 强制稳定 kebab-case ID、Course-local 唯一性、有序 Track/Stage/Lesson、可选且 Course-local 唯一的 Day、Default Published 和 replacement 无环。
- [x] 稳定学习身份只接受 `(courseId, lessonId)`；测试证明 Day、数组位置、标题和路径不能替代身份。
- [x] Draft/Published/Retired Course 与 Retired Lesson 规则、Default 约束、历史可读和替代关系按规范生效。
- [x] contentRevision、evaluationRevision、courseRevision 由规范化输入确定性生成；排版变化、评测契约变化和 revision 失配行为均有测试。
- [x] Progress 从当前 Curriculum 与最新有效 Evaluation 派生；无 Evaluation 为未开始，Retired Lesson 不进入当前分母/推荐，旧修订历史仍保留。
- [x] 本地 exporter 只读取明确 Course 的私有 Evaluation/Policy/Template，并导出仅含允许字段、修订和私有输入摘要的 Snapshot；不泄露路径、时间、Notes、证据、尝试历史或回答。
- [x] Snapshot 不可反向更新 Evaluation，且缺失、过期、额外 Lesson 或手工伪造的修订绑定会被拒绝。
- [x] authoring validation 与 public-CI validation 边界清晰：CI 不假装读取本地私有事实，但能验证公共内容、声明修订和 Snapshot 的一致性。
- [x] fixture 覆盖 Go-compatible Course、无 Day 的非默认 Course、Draft、Retired、Replacement、恶意路径和修订边界；不创建真实 Python 课程内容。
- [x] 当前真实 Go 目录、旧 Progress 和 Day 0 Learning Record 在本票前后保持基线 hash。

## Evidence

- TDD 契约测试：`scripts/lib/course-contract.test.ts` 14/14 通过。
- 静态门禁：TypeScript、ESLint、`git diff --check` 通过。
- Fresh review：Standards 0 findings；Spec 0 findings；scope creep 0。
- 完成门禁：全量 lint、typecheck、unit 与受保护 working-tree/hash 不变性检查通过。
