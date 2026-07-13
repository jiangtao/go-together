# 18 — 接通安全 Prebuilt CI/CD

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让 PR、main 和手动 fallback 复用同一个 release gate 与同一个 audited prebuilt，配置 Preview、staged Production、smoke、promote 和 rollback 的安全事件图；本票只完成自动化与可测试配置，不越过独立验收直接发布。

**Blocked by:** 17 — 证明迁移候选与 Clean Clone 可复现

**Status:** ready-for-agent

- [ ] PR→main、push→main、workflow_dispatch 均运行完整 gate，不使用可能漏掉 Course/Record/Policy 变化的 paths 过滤。
- [ ] fork PR 永不取得 Secrets 或部署；同仓 PR 仅能进入受保护 Preview Environment。
- [ ] main 只构建一次 audited prebuilt，Production 流程使用同一 artifact staged、smoke、promote，不触发第二次 Vercel build。
- [ ] workflow_dispatch 强制 40 位 candidate SHA 和 target，Production SHA 必须属于 main 历史，不能跳过门禁。
- [ ] deploy job 不 checkout/执行候选代码，只校验 artifact/Receipt、写临时项目 metadata 并运行 lockfile 固定 CLI；smoke job 无 Secrets。
- [ ] Vercel metadata 绑定 candidate HEAD、Catalog digest 和 prebuilt digest；inspect 不匹配即停止。
- [ ] Preview/staged smoke 失败不 promote；生产 smoke 失败执行上一 Production rollback、复验并让 workflow 失败。
- [ ] Preview/Production Environment 使用分离 Secrets、branch policy 和 production 串行 concurrency；最小 GitHub permissions 生效。
- [ ] Git Integration、source deployment 和 cloud source build 保持关闭；source ignore 与显式失败命令接受测试。
- [ ] 删除不再作为质量事实源的 deployment_status 记录链，避免重复或伪造事件触发。
- [ ] workflow/actions 固定 commit SHA，Node/npm/Vercel 版本与本地 lockfile 一致。
- [ ] 在无外部 Secrets 的 fixture/dry-run 中验证事件条件、artifact 边界、命令参数、失败停止和 rollback 分支；本票不把真实域名切到新候选。
