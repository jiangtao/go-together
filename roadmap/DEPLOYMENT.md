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

构建发生在完整的 GitHub checkout 中；部署只上传已经审计的 `.vercel/output`。`src/data/course.json` 是受保护的旧本地数据，任何生成、测试、构建或部署命令都不得读取或改写它。

## Git 事件矩阵

| 事件 | 工作流 | 行为 |
| --- | --- | --- |
| PR 或 main 的 Roadmap/教程变更 | `roadmap-quality` | Node 24、`npm ci`、`npm run lint`；不运行构建、单测或浏览器 E2E |
| 受信身份产生的 Preview/Production deployment status | `roadmap-deployment-status` | 仅记录匹配受信创建者与环境的 Ready 事件，不访问部署 URL |
| 人工托管 | `roadmap-vercel-manual` | 明确选择 Preview/Production，执行 lint 和无测试的安全 prebuilt 构建后部署 |

普通质量工作流不部署。GitHub Actions 不运行 Vitest、Playwright、浏览器 smoke、截图或视觉证据。Git Integration 和所有 source deployment 保持关闭；不得把 PR/main push 直接配置为 Vercel source build。deployment status 工作流只记录受信状态，不创建部署或执行线上验证。

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
- Node.js：24.x（GitHub Runner 本地 hosting build）

人工工作流只读取以下 GitHub Secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

工作流在完成 `audit:prebuilt` 后，用 org/project ID 写入忽略的 `.vercel/project.json`，再执行 `vercel deploy --prebuilt`；它不拉取构建设置、不上传源码，也不触发云端构建。Secrets 只配置在 GitHub/Vercel 设置中，不写入仓库或日志。

Deployment status 记录另需仓库变量 `ROADMAP_DEPLOYMENT_CREATOR`，用于精确匹配受信事件创建者；未配置时 workflow 不运行。该工作流不请求 `environment_url`，仅将匹配的 Ready URL 写入 Actions 日志。

人工 Preview/Production 托管工作流固定执行：

```bash
npm ci
npm run lint
npm run build:hosting
vercel deploy --prebuilt
```

`build:hosting` 只包含公开课程生成、确定性检查、generated/dist 审计、Vite 构建、Build Output API v3 打包及精确 prebuilt 审计；不运行 typecheck、Vitest、Playwright 或其他浏览器步骤。

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

只有独立只读 QA 接受本地候选后，才可运行人工工作流。工作流捕获 `vercel deploy --prebuilt` 返回的实际 URL 后停止；GitHub Actions 不执行 HTTP 或浏览器 smoke。

需要线上复核时，由开发者或只读 QA 在本地明确运行：

```bash
npm run smoke:deployment -- <VERCEL_PREVIEW_URL>
```

Smoke 仅允许 HTTPS、本项目 Vercel 主机和 443；拒绝凭证、参数、IP literal、localhost、私有/链路本地/保留/CGNAT/组播地址及任何重定向。DNS 只解析一次，全部结果必须是公网单播；Node HTTPS 固定到该地址集合并保留 TLS SNI/主机名校验，Chromium 使用同一已验证地址映射且拦截跨源请求。随后验证首页、`course.json`、Day 0/36、SPA 深链、缓存、安全头、47 个节点、Day Drawer、Markdown Reader 与 Zen。

Preview smoke 未通过时不得 promote。Production 只从已经通过同等 smoke 的候选发布；回滚选择最近一个已验证 Deployment 重新 promote，并再次执行 smoke。不要恢复旧 `course.json` 或私有同步链。

## 更新进度与故障诊断

评测仍在私有工作区完成。发布者只能使用 `export:progress` 从规范 Evaluation 导出 `release-progress/<courseId>.json`，不得手工抄写状态或复制评测正文、回答、笔记与路径。更新后重新执行完整 release gate 与独立 QA。

1. `generate:public` 失败：检查 Catalog/Course/Snapshot 一一配对、修订与严格 schema。
2. `audit:*` 失败：按命中文件移除私有路径、秘密、旧字段、额外文件或 source map；不得放宽规则绕过。
3. `audit:prebuilt` 失败：重新从 audited dist 打包；不要手工向 `.vercel/output` 添加文件。
4. source deployment 被拒绝：这是预期保护；只使用人工 prebuilt 工作流。
5. Smoke 失败：先看 URL/DNS/TLS、HTTP/安全头，再看浏览器 console/network；修复后创建新候选，不覆盖证据。
6. 项目名冲突、认证失效或设置要求交互：停止发布，保留本地证据并升级处理。

## English operational summary

The only deployable artifact is the audited Vercel Build Output API v3 directory at `.vercel/output`. GitHub quality CI runs only `npm ci` and lint. The manual hosting workflow runs lint plus the non-test `build:hosting` chain, verifies the exact prebuilt manifest against audited `dist`, and deploys only with `vercel deploy --prebuilt`. GitHub Actions never runs Vitest, Playwright, browser smoke, screenshots, or visual evidence. Full tests and deployment smoke remain explicit local/QA commands. Source deployment, cloud builds, and Git Integration are disabled.
