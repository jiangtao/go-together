# lesson-together · Go 36 天参考路线图

这是 `lesson-together` 学习框架的当前参考课程界面。应用使用 React + TypeScript + Vite，以 React Flow 展示 Day 0–36 的完整学习路线；首屏自动适配全图，支持平移、缩放、Day-only Drawer、应用内 Markdown Reader、Zen 全屏聚焦以及完整的键盘焦点恢复。仓库及应用运行标识仍为 `go-together`。

## 公开数据边界

浏览器只接收 Catalog-driven 的公开投影：

- `courses/catalog.json` 注册的 Published/Retired Course；
- `courses/<courseId>/course.json` 与 Lesson 正文的结构化脱敏投影；
- `release-progress/<courseId>.json` 派生出的最小状态与参考分数；
- 默认 Go Course 的永久 `/`、`/course.json`、`/sources/lessons/**` 兼容别名。

应用、普通构建、CI 和 Vercel 不读取 `exercise`，也不发布回答、笔记、评测正文、私有路径、本机信息或 source map。旧 `src/data/course.json` 不再被引用，且不会被生成器修改。

```text
Course Catalog + Course Source + Release Progress Snapshot
  → .generated/public
  → Vite dist
  → .vercel/output（Build Output API v3）
```

## 启动与验证

要求 Node.js 24.x、npm 11.x。

```bash
cd roadmap
npm ci
npm run dev
```

默认地址为 <http://localhost:5173>。`npm run dev` 只执行安全公开生成器后启动 Vite，不监听或同步私有学习目录。

| 命令 | 作用 |
| --- | --- |
| `npm run generate:public` | 从 Catalog、Course Source 与 Release Snapshot 生成 `.generated/public` |
| `npm run check:determinism` | 双次生成并比较逐文件 SHA-256 |
| `npm run audit:generated` | 审计生成目录的 schema、白名单和敏感内容 |
| `npm run package:prebuilt` | 将已审计 dist 确定性打包为 `.vercel/output` |
| `npm run audit:prebuilt` | 核对 Build Output API v3 精确文件集、内容哈希与 source deployment 关闭状态 |
| `npm run build` | 执行安全生成、审计、类型检查、Vite 构建、dist 审计和 prebuilt 打包审计 |
| `npm run build:hosting` | GitHub 托管专用：安全生成、审计、Vite 构建和 prebuilt 打包，不运行测试 |
| `npm run build:release` | 执行唯一 `verify:release`，绑定工具链、测试、审计、浏览器证据与 Release Receipt |
| `npm run test:e2e` | 仅供本地/人工验证，在四个视口运行 Playwright |
| `npm run smoke:deployment -- <URL>` | 仅供本地/人工检查线上 HTTP、DOM、Reader、Zen、安全头与缓存 |

Release Snapshot 按 `(courseId, lessonId)` 携带四态与最小参考分数；Day 只属于 Course 内节奏标签。评测在私有工作区完成，Snapshot 必须由 exporter 从 Evaluation 派生，禁止手工维护为第二事实源。

状态只接受“未开始、定向回炉、重新学习、通过”，分数只接受 `null` 或 0–100 的有限数字。

部署设置、Preview/Production、Git 事件矩阵、回滚和故障诊断见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## English quick start

This Vite app publishes Catalog-driven, structurally sanitized Course projections and exported Release Progress Snapshots. The default Go Course keeps permanent root and lesson aliases. Builds never read private Learning Records and never ship rubrics, notes, evaluation prose, answers, local paths, or source maps.

Use Node 24.x and npm 11.x, then run `npm ci && npm run dev`. GitHub quality checks run only `npm ci` and `npm run lint`; browser E2E stays local. Manual GitHub delivery runs lint plus `npm run build:hosting`, then deploys only the audited `.vercel/output` with `vercel deploy --prebuilt`. Source deployment and Git Integration stay disabled. Run `npm run build:release` and `npm run test:e2e` locally for the full verification gate. See [DEPLOYMENT.md](./DEPLOYMENT.md) for release operations.
