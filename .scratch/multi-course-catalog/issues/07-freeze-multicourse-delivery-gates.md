# 冻结多课程生成、审计与发布门禁

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 03, 04, 05, 06

## Question

生成器、确定性检查、敏感内容审计、prebuilt 文件集、候选指纹、单测、Playwright、线上 smoke 与 GitHub/Vercel 事件矩阵应如何按 Course 枚举并 fail-closed，同时保留当前安全发布边界？

## Answer

- 保留“公开 GitHub 仓库构建、只向 Vercel 上传受审 prebuilt”的唯一发布边界。Vercel Git Integration、source deployment 和云端 source build 继续关闭；仓库根 `.vercelignore` 必须精确为 `/*`，`roadmap/vercel.json` 的 source build 必须显式失败。唯一可部署物仍是经审计的 `.vercel/output` Build Output API v3；Vercel 官方确认 [`vercel deploy --prebuilt`](https://vercel.com/docs/cli/deploy) 只上传现成 `.vercel/output`。
- 私有 `learning-records/<courseId>/lessons/**`、`resources/internal/**`、Notes、Evaluation、回答和答案不得被 Git 跟踪；质量门禁以 `git ls-files` 明确拒绝这些规范私有路径。现有远端是 Public，因此 CI 不读取私有 Evaluation。新增 **Release Progress Snapshot** 作为本地 exporter 从 Evaluation 确定性生成的发布运输物；它可提交，但只允许 `courseId`、`courseRevision`、私有 Evaluation 集合摘要以及按 manifest 顺序排列的 `lessonId/status/referenceScore`，禁止路径、时间、Notes、证据、尝试历史和回答。Snapshot 不得手工编辑、不得反向覆盖 Evaluation，也不成为 Progress 的第二事实源。
- 生成器先 exact-key 解析规范 Course Catalog，再核对 `courses/<courseId>` 源目录与 Catalog 一一对应；所有 Source Course 都接受结构、ID、生命周期、Revision、路径和私有边界校验，只有 Published 与 Retired 被枚举进 Public Catalog 和公开制品，Draft 必须完全缺席。每个公开 Course 必须有匹配 `(courseId, courseRevision)` 的 Release Progress Snapshot；缺失、过期或额外 Snapshot 均使整次生成失败，不补默认状态。
- 所有 Course 共享同一生成管线，不允许 per-language 分支或 Go 专属生成器。每 Course 先在独立临时目录产生规范 Course、Progress、Lesson Markdown 和 public resources；全部 Course、Catalog、Go compatibility projection 与跨 Course 唯一性审计通过后，才原子替换 `.generated/public`。失败不得删除最后一次成功输出，更不得改写 Course Source、Learning Record、Release Progress Snapshot 或 `roadmap/src/data/course.json`。
- 确定性门禁在两个全新临时根中完整生成两次，按 POSIX 相对路径排序，逐文件比较路径、字节数与 SHA-256；Catalog、每个 Course、Progress、Markdown、resource 和 Go compatibility 文件都必须逐字节一致。生成时间、绝对路径、随机 ID、目录遍历顺序、Git 工作区位置与平台换行不得进入制品。
- generated/dist/prebuilt 审计器都以“Catalog + Course manifest 正向枚举的精确文件集”为白名单，拒绝额外/缺失 Course、Lesson、resource、大小写碰撞、符号链接、非普通文件、路径穿越、错误 MIME、source map、源码、测试、日志、截图、证据、环境文件、密钥、内部域名、本机路径、Notes、Evaluation、Exercise、模板和 internal resource。文本内容扫描必须覆盖 JSON、HTML、JS、CSS、SVG、Markdown 与可判定文本资源；二进制资源校验扩展名、magic bytes、大小上限和 manifest 哈希，不能因“不匹配文本正则”而放行。
- `dist` 文件集只能是 audited Public Projection、`index.html` 与带内容哈希的 Vite assets；`.vercel/output/static` 必须与 `dist` 逐字节相同，`config.json` 必须与代码内固定 Build Output API v3 配置逐字节相同。路由顺序必须先 filesystem，并让缺失的 `/courses/**.json`、`/courses/**/sources/**`、`/course.json`、`/sources/lessons/**` 返回 404，只有应用页面才可 SPA fallback。
- 每个候选生成一个不进入部署物的 Release Receipt，绑定 40 位 candidate HEAD、相关 working-tree fingerprint、Node/npm/Vercel CLI 版本、lockfile hash、Catalog hash、所有 `(courseId, courseRevision)`、Release Progress Snapshot hash、两次生成 manifest hash、dist hash、prebuilt manifest hash、测试结果与 E2E evidence manifest hash。fingerprint 覆盖 Course/Catalog、发布 Snapshot、Roadmap 源码、生成/审计/测试脚本、配置、lockfile 和 workflow，不包含绝对路径；任何输入变化都使旧 Receipt/截图失效。
- Node 固定 24.x、npm 固定 11.x，依赖只用 `npm ci`；Vercel CLI 作为 exact-version devDependency 进入 lockfile，禁止 `npx ...@latest`。所有 GitHub Actions 固定完整 commit SHA，并维持最小权限。质量命令统一为一个 fail-fast `verify:release` 入口，顺序固定为：候选/私有路径预检 → lint → typecheck → unit → 双次生成与 determinism → generated audit → Vite build → dist audit → prebuilt package/audit → Playwright 四视口 → evidence/Release Receipt audit。任一步失败不得上传部署 artifact。
- Unit 必须覆盖 Catalog/Course/Progress/Snapshot exact-key parser、Revision 配对、生命周期枚举、跨 Course ID 隔离、Day 可选、兼容映射、路径 allowlist、Markdown/resource 安全、原子生成、确定性、候选 fingerprint、prebuilt 精确文件集与 route precedence；fixture 至少包含 Go compatibility Course、一个结构不同且无 Day 的非默认 Course、Draft、Retired、恶意路径/内容及迟到/缺失 Progress。
- Playwright 在 1440×900、1024×768、390×844、360×800 全量运行，覆盖 `/` 与 `/courses/go-backend` 等价、第二 Course 切换与 history、首次全览/逐 Course transform、迟到请求隔离、无 Day Lesson、Retired/404/错误、Day/Reader/Zen/Escape/焦点恢复、Reader 安全资源、无横向溢出及零 console/page/network error。固定视觉证据扩为 12 张：Go 的 desktop/mobile normal、Zen、Zen+Day、Zen+Reader 共 8 张，加 desktop/mobile Course Select 展开与非默认 Course normal 共 4 张；只允许规定文件名、CSS×DPR 像素、非空内容和当前候选指纹。
- 线上 smoke 先校验可信 HTTPS Vercel host、DNS/TLS、无重定向和 Deployment metadata，再读取 Public Catalog；对 Catalog 中每个 Published/Retired Course 验证页面、Course/Progress 修订配对、全部 Lesson/resource HTTP、Content-Type、ETag/Cache-Control 和首个 Reader。另逐字段核对 Go legacy `/course.json`，逐字节核对全部 legacy Markdown；验证未知数据/资源路径为 404、应用深链才回 HTML、CSP/安全头、带哈希 asset immutable。浏览器 smoke 至少逐 Course 在桌面打开画布和 Reader，并对 Default Course 跑四视口、Course 切换、Drawer、Zen、焦点和零运行时错误。
- 本地验证和 CI 只写忽略的临时目录、`.generated`、`dist`、`.vercel/output` 与显式 evidence 目录；不得占用或替换 5173 服务。执行前后记录并核对受保护 dirty-tree、`roadmap/src/data/course.json` hash、现有 5173 PID/command 与所有 Course/Learning Record 源 hash；任何非预期变化立即停止。E2E 使用独立 4173 进程且 `reuseExistingServer: false`。

### CI/CD 事件矩阵

| 事件 | 质量与制品 | 部署行为 |
| --- | --- | --- |
| `pull_request` → `main` | 不使用 `paths` 过滤；无 Secrets 跑完整 `verify:release`，上传只含 prebuilt、manifests、Receipt 和证据的短期 artifact | 仅同仓 PR 可在受保护 `roadmap-preview` Environment 审批后部署 Preview；fork PR 永不取 Secrets、永不部署。部署 job 不 checkout 或执行候选代码，只校验 artifact/Receipt 并运行固定 CLI；随后由无 Secrets job 执行线上 smoke |
| `push` → `main` | 对实际 main SHA 重新执行完整门禁并只构建一次 | 将同一 prebuilt 以 `--prod --skip-domain` 创建 staged Production，smoke 通过后 `vercel promote`，再 smoke 生产域名；禁止重新构建或另一条 Vercel 自动部署。Vercel 官方支持[先 staged、后 promote](https://vercel.com/docs/cli/deploying-from-cli) |
| `workflow_dispatch` | 必填 40 位 `candidate_sha` 与 `preview|production`；checkout 精确 SHA 后重跑全部门禁。Production SHA 必须属于 `main` 历史 | 复用同一 Preview 或 staged Production 流程，作为 CLI/事件故障的唯一 fallback，不允许跳过测试或审计 |
| `deployment_status` | 不作为质量事实源 | 删除现有仅记录事件的独立 workflow；部署 workflow 自身写 GitHub Environment URL/状态，避免重复或伪造的外部 status 触发 |

- `roadmap-preview` 与 `roadmap-production` 使用独立 GitHub Environment Secrets（`VERCEL_TOKEN/ORG_ID/PROJECT_ID`）和环境级 branch policy；Production 只允许 `main`，并以全局 concurrency 串行且不取消已开始的 promote。GitHub 官方保证 Environment 审批完成前 job 无法读取其 Secrets，并支持 branch 限制与并发门禁（[GitHub Environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)）。
- 部署命令携带 candidate HEAD、prebuilt digest 与 Catalog digest 的 Vercel metadata；deploy 返回的 URL 必须经 `vercel inspect` 核对项目、环境和 metadata 后才 smoke。Preview smoke 失败不 promote；staged Production smoke 失败不切流。生产域名 smoke 失败立即执行 `vercel rollback` 回上一 Production 并复验，随后整次 workflow 失败；Hobby 计划只保证回上一版，符合 Vercel 官方限制（[Vercel rollback](https://vercel.com/docs/cli/rollback)）。
- 保持单一 Vercel Project `go-together-roadmap`，所有 Course 共用同一域名和制品；不按 Language/Course 建项目，不把私有数据放入 Vercel Environment Variables，也不创建第二套部署器。账户认证、Environment 审批规则与域名绑定是唯一外部配置；未配置时质量门禁仍可完成，但部署 job 必须停止并明确报缺项。
