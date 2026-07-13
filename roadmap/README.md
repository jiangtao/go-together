# lesson-together · Go 36 天参考路线图

这是 `lesson-together` 学习框架的当前参考课程界面。应用使用 React + TypeScript + Vite，以 React Flow 展示 Day 0–36 的完整学习路线；首屏自动适配全图，支持平移、缩放、Day-only Drawer、应用内 Markdown Reader、Zen 全屏聚焦以及完整的键盘焦点恢复。仓库及应用运行标识仍为 `go-together`。

## 公开数据边界

浏览器只接收：

- `docs/go-learning/daily-lessons/day-00...day-36` 经结构化脱敏后的公开教程投影；
- `content/progress.public.json` 的脱敏状态与参考分数；
- 由两者生成的 schema v3 `course.json`。

应用、普通构建、CI 和 Vercel 不读取 `exercise`，也不发布回答、笔记、评测正文、私有路径、本机信息或 source map。旧 `src/data/course.json` 不再被引用，且不会被生成器修改。

```text
教程 Markdown → public projection + progress.public.json
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
| `npm run generate:public` | 从教程和脱敏进度生成 `.generated/public` |
| `npm run check:determinism` | 双次生成并比较逐文件 SHA-256 |
| `npm run audit:generated` | 审计生成目录的 schema、白名单和敏感内容 |
| `npm run package:prebuilt` | 将已审计 dist 确定性打包为 `.vercel/output` |
| `npm run audit:prebuilt` | 核对 Build Output API v3 精确文件集、内容哈希与 source deployment 关闭状态 |
| `npm run build` | 执行安全生成、审计、类型检查、Vite 构建、dist 审计和 prebuilt 打包审计 |
| `npm run build:hosting` | GitHub 托管专用：安全生成、审计、Vite 构建和 prebuilt 打包，不运行测试 |
| `npm run build:release` | 本地增加 lint、类型检查和全部 Vitest 的完整发布门禁 |
| `npm run test:e2e` | 仅供本地/人工验证，在四个视口运行 Playwright |
| `npm run smoke:deployment -- <URL>` | 仅供本地/人工检查线上 HTTP、DOM、Reader、Zen、安全头与缓存 |

进度文件必须恰好包含 Day 0–36，每条对象只允许：

```json
{ "day": 0, "status": "未开始", "referenceScore": null }
```

状态只接受“未开始、定向回炉、重新学习、通过”，分数只接受 `null` 或 0–100 的有限数字。评测在私有工作区完成，发布者只能手工提取这三个公开字段。

部署设置、Preview/Production、Git 事件矩阵、回滚和故障诊断见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## English quick start

This Vite app publishes a structurally sanitized public projection of the Day 0–36 lessons plus the redacted `day`, `status`, and `referenceScore` fields from `content/progress.public.json`. It never reads `exercise` during development, build, CI, or Vercel deployment, and it never ships rubrics, notes, evaluation prose, answers, repository-governance paths, local paths, or source maps.

Use Node 24.x and npm 11.x, then run `npm ci && npm run dev`. GitHub quality checks run only `npm ci` and `npm run lint`; browser E2E stays local. Manual GitHub delivery runs lint plus `npm run build:hosting`, then deploys only the audited `.vercel/output` with `vercel deploy --prebuilt`. Source deployment and Git Integration stay disabled. Run `npm run build:release` and `npm run test:e2e` locally for the full verification gate. See [DEPLOYMENT.md](./DEPLOYMENT.md) for release operations.
