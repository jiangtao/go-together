# 18 — 接通安全 Prebuilt CI/CD

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让 PR、main 和手动 fallback 复用同一个 release gate 与同一个 audited prebuilt，配置 Preview、staged Production、smoke、promote 和 rollback 的安全事件图；本票只完成自动化与可测试配置，不越过独立验收直接发布。

**Blocked by:** 17 — 证明迁移候选与 Clean Clone 可复现

**Status:** awaiting-external-configuration

- [x] PR→main、push→main、workflow_dispatch 均运行完整 gate，不使用可能漏掉 Course/Record/Policy 变化的 paths 过滤。
- [x] fork PR 永不取得 Secrets 或部署；同仓 PR 的部署分支只引用 `roadmap-preview` Environment。
- [x] main 只构建一次 audited prebuilt，Production 流程使用同一 artifact staged、smoke、promote，不触发第二次 Vercel build。
- [x] workflow_dispatch 强制 40 位 candidate SHA 和 target，Production SHA 必须属于 main 历史，不能跳过门禁。
- [x] deploy job 不 checkout/执行候选代码，只校验 artifact/Receipt、写临时项目 metadata 并运行 lockfile 固定 CLI；smoke job 无 Secrets。
- [x] Vercel metadata 绑定 candidate HEAD、Catalog digest 和 prebuilt digest；inspect 不匹配即停止。
- [x] Preview/staged smoke 失败不 promote；生产 smoke 失败回退到 promote 前捕获的 Production Deployment、复验并让 workflow 失败。
- [ ] 在 GitHub 账户中实际配置两个受保护 Environment 的独立 Secrets、branch policy 与所需审批；代码已使用最小 `contents: read` 和 production 串行 concurrency，账户状态尚未取证。
- [ ] 在 Vercel 账户中确认 Git Integration、source deployment 与 cloud source build 已禁用；仓库的 fail-closed `.vercelignore` 和 `vercel.json` 已受测试保护。
- [x] 删除不再作为质量事实源的 deployment_status 记录链，避免重复或伪造事件触发。
- [x] workflow/actions 固定 commit SHA，Node/npm/Vercel 版本与本地 lockfile 一致。
- [x] 在无外部 Secrets 的 fixture/dry-run 中验证事件条件、artifact 边界、命令参数、失败停止和 rollback 分支；本票不把真实域名切到新候选。

**Local verified evidence:** `roadmap-release` 的契约测试、YAML 解析与完整 release gate 均通过。外部账户配置是唯一剩余边界，必须由第 19 票的独立验收在真正部署前取证；不得用本地成功替代它。
