# Roadmap 安全发布手册

## 公开边界

公开站点只包含两类内容：`docs/go-learning/daily-lessons` 下 Day 0–36 教程的安全公开投影，以及 `content/progress.public.json` 中的脱敏状态与参考分数。投影按 Markdown 结构移除 rubric、答案/评测材料和仓库治理路径，同时保留教学正文、命令及 `cmd/`、`internal/` 等教学代码路径。

构建与部署产物不得包含回答、学习笔记、评测正文、`exercise`、旧 `src/data/course.json`、私有/本机路径、环境文件、测试证据、source map 或源码。固定数据链如下：

```text
Day 0–36 教程 → public projection + progress.public.json
  → generate:public → audit:generated
  → .generated/public → Vite → dist → audit:dist
  → package:prebuilt → .vercel/output → audit:prebuilt
  → vercel deploy --prebuilt
```

构建发生在完整的 GitHub checkout 中；部署只上传已经审计的 `.vercel/output`。`src/data/course.json` 是受保护的旧本地数据，任何生成、测试、构建或部署命令都不得读取或改写它。

## Git 事件矩阵

| 事件 | 工作流 | 行为 |
| --- | --- | --- |
| PR 或 main 的 Roadmap/教程变更 | `roadmap-quality` | Node 24、`npm ci`、release build、prebuilt 审计、四视口 Playwright |
| 受信身份产生的 Preview/Production deployment status | `roadmap-deployment-smoke` | 只对本项目 Vercel HTTPS 主机做 HTTP、DOM、Reader、Zen 与安全头检查 |
| 人工兜底 | `roadmap-vercel-manual` | 明确选择 Preview/Production，在 GitHub Runner 本地构建并只执行 prebuilt 部署与 smoke |

普通质量工作流不部署。Git Integration 和所有 source deployment 保持关闭；不得把 PR/main push 直接配置为 Vercel source build。`roadmap-deployment-smoke` 只验证已有部署，不创建重复部署。

## 唯一可部署制品

仓库根 `.vercelignore` 的唯一内容为 `/*`，用于 fail-closed 禁止 source deployment；`roadmap/` 下不得再放置覆盖它的 `.vercelignore`。`roadmap/vercel.json` 的 source build 命令也会明确失败。

`npm run package:prebuilt` 从已审计 `dist` 创建 Vercel Build Output API v3 包：

- `.vercel/output/config.json`：SPA fallback、静态资源缓存、`course.json`/教程 revalidation 与安全响应头；
- `.vercel/output/static/**`：与已审计 `dist` 逐字节一致的静态文件；
- `.generated/prebuilt-manifest.json`：包外审计证据，记录精确路径、大小和 SHA-256，不属于部署内容。

`npm run audit:prebuilt` 拒绝任何额外/缺失文件、符号链接、source map、源码、脚本、测试、教程输入、`exercise`、旧数据、环境文件、日志或证据。Vercel 的 prebuilt 模式直接使用 `.vercel/output`，不依赖源码上传白名单；因此不得用云端构建、source deployment 或 Git Integration 替代此流程。

## Vercel 项目与凭据

- Project Name：`go-together-roadmap`
- Framework：Vite（项目元数据）；实际部署格式为 Build Output API v3
- Git Integration：Disabled
- Node.js：24.x（GitHub Runner 本地 release build）

人工工作流只读取以下 GitHub Secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

工作流在临时 Runner 中用 org/project ID 写入忽略的 `.vercel/project.json`，随后再次审计并执行 `vercel deploy --prebuilt`；它不拉取构建设置、不上传源码，也不触发云端构建。Secrets 只配置在 GitHub/Vercel 设置中，不写入仓库或日志。

Deployment status smoke 另需仓库变量 `ROADMAP_DEPLOYMENT_CREATOR`，用于精确匹配受信事件创建者；未配置时 workflow 不运行。Smoke 仅接受 `go-together-roadmap.vercel.app` 及该项目的动态 `go-together-roadmap-*.vercel.app` 主机，不接受任意 custom host。

## 本地门禁与可归因证据

在 Node 24 / npm 11 下执行：

```bash
npm ci
npm run build:release
```

每次 E2E 使用全新临时目录和明确的 40 位候选 HEAD：

```bash
E2E_CANDIDATE_HEAD=<40_HEX_HEAD> \
E2E_EVIDENCE_DIR=<UNIQUE_TEMP_DIR>/evidence \
PLAYWRIGHT_ARTIFACT_DIR=<UNIQUE_TEMP_DIR>/artifacts \
E2E_RUN_ID=<RUN_ID> \
npm run test:e2e
```

`evidence-manifest.json` 必须登记且只登记八个规定视觉状态。每条包含 CSS 视口、DPR、PNG 像素尺寸、文件大小、SHA-256、run ID、候选 HEAD 与由相关产品/配置/脚本/测试/工作流及 37 篇教程内容生成的确定性指纹。生成器拒绝缺图、多图、历史文件、空白图、错误 CSS×DPR、非法 HEAD 或缺失教程输入，也可在无 `.git` 的隔离副本中使用显式 HEAD。

## Preview、Production 与 Smoke

只有独立只读 QA 接受本地候选后，才可运行人工工作流。工作流捕获 `vercel deploy --prebuilt` 返回的实际 URL，并在同一受信流程中执行：

```bash
npm run smoke:deployment -- <VERCEL_PREVIEW_URL>
```

Smoke 仅允许 HTTPS、本项目 Vercel 主机和 443；拒绝凭证、参数、IP literal、localhost、私有/链路本地/保留/CGNAT/组播地址及任何重定向。DNS 只解析一次，全部结果必须是公网单播；Node HTTPS 固定到该地址集合并保留 TLS SNI/主机名校验，Chromium 使用同一已验证地址映射且拦截跨源请求。随后验证首页、`course.json`、Day 0/36、SPA 深链、缓存、安全头、47 个节点、Day Drawer、Markdown Reader 与 Zen。

Preview smoke 未通过时不得 promote。Production 只从已经通过同等 smoke 的候选发布；回滚选择最近一个已验证 Deployment 重新 promote，并再次执行 smoke。不要恢复旧 `course.json` 或私有同步链。

## 更新进度与故障诊断

评测仍在私有工作区完成。发布者只更新 `content/progress.public.json` 中的 `day`、四状态之一和 `referenceScore`，不得复制评测正文、回答、笔记或路径。更新后重新执行完整 release build 与独立 QA。

1. `generate:public` 失败：检查 37 个 Day 输入及 progress 严格 schema。
2. `audit:*` 失败：按命中文件移除私有路径、秘密、旧字段、额外文件或 source map；不得放宽规则绕过。
3. `audit:prebuilt` 失败：重新从 audited dist 打包；不要手工向 `.vercel/output` 添加文件。
4. source deployment 被拒绝：这是预期保护；只使用人工 prebuilt 工作流。
5. Smoke 失败：先看 URL/DNS/TLS、HTTP/安全头，再看浏览器 console/network；修复后创建新候选，不覆盖证据。
6. 项目名冲突、认证失效或设置要求交互：停止发布，保留本地证据并升级处理。

## English operational summary

The only deployable artifact is the audited Vercel Build Output API v3 directory at `.vercel/output`. CI builds it locally from the checked-out, sanitized inputs, verifies an exact manifest against the audited `dist`, and deploys only with `vercel deploy --prebuilt`. Source deployment, cloud builds, and Git Integration are disabled. Deployment smoke accepts only this project's Vercel HTTPS hosts, pins validated public DNS answers for both Node and Chromium, rejects redirects, and validates the public data boundary plus core UI behavior.
