# 15 — 加固确定性 Release Gate 与证据链

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让任何候选在部署前都必须经过同一个 fail-closed `verify:release`：全 Course 确定性生成、安全审计、应用构建、精确 prebuilt、四视口浏览器测试、12 张视觉证据和绑定候选输入/制品的 Release Receipt。

**Blocked by:** 12 — 贯通规范与 Legacy 公开投影；14 — 交付多 Course Roadmap 体验

**Status:** ready-for-agent

- [ ] Node/npm/Vercel CLI 版本和 lockfile 固定，依赖只通过 npm ci；release gate 的步骤顺序与规范一致并 fail-fast。
- [ ] 候选预检拒绝 tracked Learning Record/internal resource、私有内容、错误 HEAD 和非预期工作树变化。
- [ ] 两个全新临时根完整生成，排序后的路径、大小和 SHA-256 逐项一致；时间、随机数、绝对路径和平台遍历顺序不进入制品。
- [ ] generated、dist、prebuilt 都按 Catalog/manifest 精确 allowlist 拒绝额外/缺失文件、symlink、非普通文件、大小写碰撞、路径逃逸和 source map。
- [ ] 文本与二进制分别完成内容/MIME/magic/大小/hash 审计，覆盖密钥、内部域名、本机路径、Notes、Evaluation、Exercise、答案和 rubric。
- [ ] dist 只包含 Public Projection、index 和哈希 asset；prebuilt static 与 dist 逐字节一致，路由优先保证数据/资源 404 而非 SPA fallback。
- [ ] Release Receipt 绑定 HEAD、working-tree fingerprint、工具链、lockfile、Catalog、Course Revision、Snapshot、生成 manifest、dist/prebuilt、测试和 evidence hash。
- [ ] Playwright 四视口覆盖根/规范等价、Course switch/history、迟到请求、无 Day、Retired、404、Day/Reader/Zen/Escape/焦点/安全资源与零运行时错误。
- [ ] evidence manifest 只接受规定的 12 张图、正确 CSS×DPR、非空 PNG、当前 candidate fingerprint，拒绝历史或多余文件。
- [ ] E2E 独占 4173 且不复用服务；运行前后 5173 listener 的 PID/command（若有）不变。
- [ ] 任一步失败都不产生可上传的部署 artifact，也不改写 Course Source、Release Snapshot、Learning Record 或受保护旧 Roadmap 数据。
