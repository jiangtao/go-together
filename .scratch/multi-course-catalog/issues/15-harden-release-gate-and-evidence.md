# 15 — 加固确定性 Release Gate 与证据链

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让任何候选在部署前都必须经过同一个 fail-closed `verify:release`：全 Course 确定性生成、安全审计、应用构建、精确 prebuilt、四视口浏览器测试、12 张视觉证据和绑定候选输入/制品的 Release Receipt。

**Blocked by:** 12 — 贯通规范与 Legacy 公开投影；14 — 交付多 Course Roadmap 体验

**Status:** resolved

- [x] Node/npm/Vercel CLI 版本和 lockfile 固定，依赖只通过 npm ci；release gate 的步骤顺序与规范一致并 fail-fast。
- [x] 候选预检拒绝 tracked Learning Record/internal resource、私有内容、错误 HEAD 和非预期工作树变化。
- [x] 两个全新临时根完整生成，排序后的路径、大小和 SHA-256 逐项一致；时间、随机数、绝对路径和平台遍历顺序不进入制品。
- [x] generated、dist、prebuilt 都按 Catalog/manifest 精确 allowlist 拒绝额外/缺失文件、symlink、非普通文件、大小写碰撞、路径逃逸和 source map。
- [x] 文本与二进制分别完成内容/MIME/magic/大小/hash 审计，覆盖密钥、内部域名、本机路径、Notes、Evaluation、Exercise、答案和 rubric。
- [x] dist 只包含 Public Projection、index 和哈希 asset；prebuilt static 与 dist 逐字节一致，路由优先保证数据/资源 404 而非 SPA fallback。
- [x] Release Receipt 绑定 HEAD、working-tree fingerprint、工具链、lockfile、Catalog、Course Revision、Snapshot、生成 manifest、dist/prebuilt、测试和 evidence hash。
- [x] Playwright 四视口覆盖根/规范等价、Course switch/history、迟到请求、无 Day、Retired、404、Day/Reader/Zen/Escape/焦点/安全资源与零运行时错误。
- [x] evidence manifest 只接受规定的 12 张图、正确 CSS×DPR、非空 PNG、当前 candidate fingerprint，拒绝历史或多余文件。
- [x] E2E 独占 4173 且不复用服务；运行前后 5173 listener 的 PID/command（若有）不变。
- [x] 任一步失败都不产生可上传的部署 artifact，也不改写 Course Source、Release Snapshot、Learning Record 或受保护旧 Roadmap 数据。

## 完成证据

- Node 24.11.0、npm 11.6.1、Vercel CLI 50.27.1 与 exact lockfile 安装契约通过；`npm ci` 已在冻结工具链下完成。
- lint、typecheck、175 个单测、25 个 Evaluation 测试、78 个文件双生成确定性以及 generated/dist/prebuilt 三段审计通过。
- Playwright：44 passed、52 skipped、0 failed；12 张规定状态的 CSS×DPR、非空 PNG 与 candidate fingerprint 清单通过。
- 当前 legacy 候选运行 `verify:release` 按预期在 tracked private/internal 预检处 fail-closed；Receipt、prebuilt、Build Output 与 evidence 均被清理。完整成功 Receipt 由 Ticket 17 在 Ticket 16 迁移后证明。
- 失败前后 5173 无 listener；两个 Evaluation Skill、Course/Record/Snapshot 与受保护旧 `course.json` 不变，且 Python Evaluation 不产生 `__pycache__`。
- 原规格审查与标准/安全审查 fresh 复验均为 0 findings。
