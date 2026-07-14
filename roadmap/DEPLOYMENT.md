# Roadmap 安全发布手册

## 公开边界

公开站点只包含 `courses/catalog.json` 正向枚举的 Course 安全投影、对应 `release-progress/<courseId>.json` 的最小状态，以及默认 Go Course 的永久 legacy aliases。Markdown 投影按结构移除 rubric、答案/评测材料和仓库治理路径，同时保留教学正文与教学代码路径。

构建与部署产物不得包含回答、学习笔记、评测正文、`exercise`、旧 `src/data/course.json`、私有/本机路径、环境文件、测试证据、source map 或源码。固定数据链如下：

```text
Catalog + Course Source + Release Progress Snapshot
  → generate:public → audit:generated
  → .generated/public → Vite → dist → audit:dist
  → package:prebuilt → .vercel/output → audit:prebuilt
  → vercel deploy --prebuilt
```

完整 gate 发生在候选 commit 的 GitHub checkout 中；部署只下载已经审计的 `.vercel/output` artifact，绝不 checkout 或执行候选源码。旧 `src/data/course.json` 已随迁移移除，任何生成、测试、构建或部署命令都不得依赖它。

## Git 事件矩阵

| 事件 | `roadmap-release` 行为 | 部署边界 |
| --- | --- | --- |
| 外部 PR | 对 PR HEAD 执行完整 `npm run verify:release`，无 paths 过滤 | 无 Secrets、无部署 |
| 同仓 PR | 对 PR HEAD 执行同一完整 gate，上传唯一 audited prebuilt artifact | 使用 `roadmap-preview` Environment 部署 Preview 并 smoke |
| push 到 `main` | 对 push SHA 执行同一完整 gate，上传唯一 artifact | 使用 `roadmap-production` 先 staged Production、smoke、promote，再 smoke |
| `workflow_dispatch` | 必填 40 位小写 SHA 与 `preview`/`production` target；Production SHA 必须是 `main` 的祖先 | 重走完整 gate；按 target 进入同一 Preview 或 Production 链 |

不保留 paths 过滤、`deployment_status` 记录链或第二条发布入口。Preview/staged smoke 失败即停止，绝不 promote；生产域名 smoke 失败时工作流执行 Vercel rollback，并在无 Secrets 的独立 job 重新 smoke，原 workflow 仍保持失败。Git Integration、所有 source deployment 与 Vercel cloud source build 保持关闭；不得把 PR/main push 配成 Vercel source build。

## 唯一可部署制品

仓库根 `.vercelignore` 的唯一内容为 `/*`，用于 fail-closed 禁止 source deployment；`roadmap/` 下不得再放置覆盖它的 `.vercelignore`。`roadmap/vercel.json` 的 source build 命令也会明确失败。

`npm run package:prebuilt` 从已审计 `dist` 创建 Vercel Build Output API v3 包：

- `.vercel/output/config.json`：SPA fallback、静态资源缓存、`course.json`/教程 revalidation 与安全响应头；
- `.vercel/output/static/**`：与已审计 `dist` 逐字节一致的静态文件；
- `.generated/prebuilt-manifest.json`：包外审计证据，记录精确路径、大小和 SHA-256，不属于部署内容。

`npm run audit:prebuilt` 拒绝任何额外/缺失文件、符号链接、source map、源码、脚本、测试、教程输入、`exercise`、旧数据、环境文件、日志或证据。Vercel 的 prebuilt 模式直接使用 `.vercel/output`，不依赖源码上传白名单；因此不得用云端构建、source deployment 或 Git Integration 替代此流程。

## Vercel 项目、Environment 与凭据

- Project Name：`go-together-roadmap`
- Framework：Vite（项目元数据）；实际部署格式为 Build Output API v3
- Git Integration：Disabled
- Node.js：24.11.0；npm 由 `roadmap/package-lock.json` 固定

仅在 GitHub Environment 中配置以下 Secrets，Preview 与 Production 使用彼此独立的值和 branch policy：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

`quality` job 在完整 `verify:release` 之后上传唯一 artifact；artifact 仅含 `.vercel/output`、Receipt、manifest、catalog 和供 lockfile CLI 使用的 package 文件。deploy job 先复算 Receipt/catalog/prebuilt digest，再把 org/project ID 写入临时、忽略且 mode 0600 的 `.vercel/project.json`，并以 lockfile 中的 Vercel CLI 执行 `vercel deploy --prebuilt`。deploy job 使用 `npm ci --ignore-scripts`，没有 checkout，不上传源码，也不触发云端构建。

每个 Vercel deployment 都必须携带并由 API 复核以下 metadata：`candidateHead`、`catalogDigest`、`prebuiltDigest`。Preview URL 由 Vercel 返回；Production 先以 `--prod --skip-domain` staged，staged smoke 通过才以 `vercel promote` 切到正式域名。promote 前必须从正式别名解析出当前可回退的 Production Deployment；若没有已验证基线，流程在 promote 前停止，首次生产上线须由独立验收建立基线。生产链以 `roadmap-production` 串行，禁止取消正在进行的生产发布。Secrets 只配置在 GitHub/Vercel 设置中，不写入仓库、artifact 或日志。

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

`evidence-manifest.json` 必须登记且只登记十二个规定视觉状态。每条包含 CSS 视口、DPR、PNG 像素尺寸、文件大小、SHA-256、run ID、候选 HEAD 与由产品、Course Source、Snapshot、配置、脚本、测试和工作流生成的确定性指纹。生成器拒绝缺图、多图、历史文件、空白图、错误 CSS×DPR、非法 HEAD 或缺失 Course 输入，也可在无 `.git` 的隔离副本中使用显式 HEAD。

## Preview、Production 与本地 Smoke

本地或独立 QA 可明确运行同一 smoke 命令复核线上候选：

```bash
npm run smoke:deployment -- <VERCEL_PREVIEW_URL>
```

Smoke 仅允许 HTTPS、本项目 Vercel 主机和 443；拒绝凭证、参数、IP literal、localhost、私有/链路本地/保留/CGNAT/组播地址及任何重定向。DNS 只解析一次，全部结果必须是公网单播；Node HTTPS 固定到该地址集合并保留 TLS SNI/主机名校验，Chromium 使用同一已验证地址映射且拦截跨源请求。随后验证首页、`course.json`、Day 0/36、SPA 深链、缓存、安全头、47 个节点、Day Drawer、Markdown Reader 与 Zen。

Preview/staged smoke 未通过时不得 promote。Production 只从已经通过同等 smoke 的候选发布；生产 smoke 失败时工作流以 `vercel rollback` 回到上一 Production，并在 `smoke-rollback-production` 复验。不要恢复旧数据或私有同步链。

## 更新进度与故障诊断

评测仍在私有工作区完成。发布者只能使用 `export:progress` 从规范 Evaluation 导出 `release-progress/<courseId>.json`，不得手工抄写状态或复制评测正文、回答、笔记与路径。更新后重新执行完整 release gate 与独立 QA。

1. `generate:public` 失败：检查 Catalog/Course/Snapshot 一一配对、修订与严格 schema。
2. `audit:*` 失败：按命中文件移除私有路径、秘密、旧字段、额外文件或 source map；不得放宽规则绕过。
3. `audit:prebuilt` 失败：重新从 audited dist 打包；不要手工向 `.vercel/output` 添加文件。
4. source deployment 被拒绝：这是预期保护；只使用 `roadmap-release` 的 prebuilt artifact 链。
5. Smoke 失败：先看 URL/DNS/TLS、HTTP/安全头，再看浏览器 console/network；生产失败应确认 rollback smoke 通过，修复后创建新候选，不覆盖证据。
6. 项目名冲突、认证失效、Environment Secrets/审批/branch policy 或域名要求交互：停止发布，保留本地证据并升级处理。

## English operational summary

The only deployable artifact is the audited Vercel Build Output API v3 directory at `.vercel/output`. The single `roadmap-release` workflow runs the full release gate for every PR, main push, and explicit dispatch. It deploys only the verified prebuilt artifact: same-repository PRs receive a protected Preview deployment; main follows staged Production, smoke, promote, and rollback-with-resmoke. Fork PRs never receive Secrets or deploy. Deployment jobs do not checkout candidate code and verify Receipt/catalog/prebuilt digests plus Vercel metadata before proceeding. Source deployment, cloud builds, and Git Integration are disabled.
