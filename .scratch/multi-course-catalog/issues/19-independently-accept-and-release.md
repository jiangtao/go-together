# 19 — 独立验收、发布并开启 Python 门

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 由未参与实现的只读验收者对完整规范逐项取证；finding 退回原执行者修复并 fresh 复验。零 finding 后，部署同一候选到 Preview、staged Production 和 Production，并以线上证据决定是否正式允许新增 Python Course。

**Blocked by:** 18 — 接通安全 Prebuilt CI/CD

**Status:** ready-for-agent

- [ ] 验收者未参与第 10–18 票实现，只读取规范、决策、current worktree、证据、运行结果和外部部署状态。
- [ ] 建立规范逐条证据矩阵，覆盖领域身份、存储/隐私、修订、评测、Roadmap、公共兼容、安全生成、迁移、CI/CD 和 Out of Scope。
- [ ] 核对迁移 manifest、仓库外备份摘要、37 个 Lesson/Evaluation/Progress hash、唯一 Notes diff、private tracked set 和旧路径允许清单。
- [ ] 重新执行或独立复核完整 release gate、clean-clone、四视口、12 张 evidence、prebuilt 精确文件集和 Release Receipt。
- [ ] 任一 finding 记录明确优先级、证据和违反的规范条款，退回原执行票修复；复验必须 fresh，不能只接受实现者说明。
- [ ] 零 finding 后才在受保护 Environment 部署 Preview，并执行逐 Course HTTP/浏览器 smoke、Vercel inspect 和 metadata/Receipt 绑定核对。
- [ ] Preview 通过后用同一 prebuilt 创建 staged Production；staged smoke 通过后 promote，再验证生产域名、规范/legacy URL、缓存、404、CSP 和零运行时错误。
- [ ] 生产验证失败时执行上一 Production rollback 并复验，验收保持失败；不得恢复旧内部读链或伪造通过。
- [ ] 记录最终部署 URL、Deployment ID、candidate HEAD、Catalog/prebuilt digest、smoke 结果和独立验收结论，不记录 Secrets 或私有绝对路径。
- [ ] Vercel 认证、Environment Secrets、审批或域名缺失时明确标记外部阻塞；不得以本地成功替代线上完成。
- [ ] 只有全部规范证据、Production 和 clean-clone 通过且零 finding，才把“允许创建 Python Course”判定为通过；否则门保持关闭。
- [ ] 验收完成后不自动删除仓库外迁移备份，也不修改用户私有 Learning Record。
