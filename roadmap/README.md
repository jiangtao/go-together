# Go 36 天学习路线图

这是一个本地运行的 React + TypeScript + Vite 应用。首屏以全宽路线画布为核心，直接展示 Day 0–36 的结构化学习路线和相邻路径；路线图使用 `@xyflow/react`，支持平移、缩放和适配视图。

路线图按“总路线 → 三条主题主干 → 六个阶段簇 → 37 个 Day 节点”组织，而不是把阶段纵向叠成目录。总进度、四种状态数量、六个阶段分进度和每个图节点的状态都来自同一份生成数据。

跨模块的总览、主干和阶段连接使用动画虚线，跨阶段 Day 路径使用静态虚线，阶段内 Day 学习路径保持实线；系统启用“减少动态效果”时，跨模块连接保留虚线但停止动画。桌面端点击节点后以半屏 Drawer 展示进度和详情，移动端则使用底部 Drawer。

选择任意 Day 节点后，桌面端从右侧、移动端从底部打开学习 Drawer，集中展示总进度、阶段进度、当日目标与课程资源。顶部“学习进度”按钮也可随时打开 Drawer，关闭后画布仍保持原视口上下文。

课程内容只来自仓库内的 `docs/go-learning/daily-lessons/day-00...day-36`。学习状态只来自对应练习目录的 `notes-eval.md`，页面不提供手工打卡入口。

## 启动

要求：Node.js 20.19+ 或 22.12+，npm 10+。

```bash
cd roadmap
npm install
npm run dev
```

默认地址：<http://localhost:5173>

首次启动会先同步课程数据，然后并行启动数据监听器与 Vite。若 5173 端口被占用，以终端输出的实际地址为准。

## 自动同步 loop

开发模式的闭环如下：

1. `npm run dev` 先执行一次 `npm run sync`。
2. 同步器严格读取 `../docs/go-learning/daily-lessons/day-*.md`，并探测 `../exercise/day*/notes.md`、`README.md` 与 `notes-eval.md`。
3. 监听器捕获课程、笔记或评测文件的新增、修改、删除，防抖后重新解析。
4. 生成结果确定性写入 `src/data/course.json`；可打开的 Markdown 以 UTF-8 静态副本写入已忽略的 `public/sources/`，源文件不改动。
5. 数据与资源内容未变化时不写盘；Vite 监听生成结果并自动更新或刷新页面。
6. `npm run build` 通过 `prebuild` 再同步一次，避免构建陈旧数据。

监听器不会读取 `.env`、密钥或仓库外课程文件。只有 `notes-eval.md` 能改变学习状态；普通学习笔记只影响资源入口是否可用。

## 进度数据约定

标准评测路径为：

```text
exercise/dayN/notes-eval.md
```

例如 Day 8 对应 `exercise/day8/notes-eval.md`。为兼容已有练习命名，同步器也识别 `day08`、`day-08`、`day-8`，但新文件建议统一使用 `dayN`。

评测文件支持以下明确标签：

```markdown
状态：未开始
状态：定向回炉
状态：重新学习
状态：通过
参考分数：85 / 100
```

- 状态只接受“未开始、定向回炉、重新学习、通过”。
- 同一文件存在多次明确评测时，使用最后一个状态和最后一个有效参考分数。
- 参考分数有效范围为 0–100；缺失或越界时显示 `—`。
- 练习目录或评测文件不存在时，该 Day 自动视为“未开始”。
- 总进度只按“通过”数量计算；当前推荐 Day 是按顺序遇到的第一个未通过课程。
- 页面只展示评测结果，不写回评测文件，也不允许手工修改状态。

## 课程与笔记跳转

每个 Day 节点右上角的文件按钮可直接打开课程 Markdown；选择节点后，详情区还会显示三个资源入口：

| 资源 | 路径约定 | 不存在时 |
|---|---|---|
| 课程 Markdown | `docs/go-learning/daily-lessons/day-*.md` | 课程同步会直接报错 |
| 学习笔记 | `exercise/dayN/notes.md`，兼容同目录 `README.md` | 按钮禁用并显示“待创建” |
| 评测文件 | `exercise/dayN/notes-eval.md` | 按钮禁用，状态视为“未开始” |

练习目录继续兼容 `dayN`、`dayNN`、`day-NN`、`day-N`。资源入口指向同步生成的 `/sources/...` 静态副本，因此开发服务器和生产构建都能在浏览器中打开 UTF-8 Markdown；副本目录已忽略，不进入 Git 提交。

## 六阶段分组

| 阶段 | Day | 主题 |
|---|---:|---|
| 1 | 0–6 | 起步与语言基础 |
| 2 | 7–12 | HTTP 与数据入口 |
| 3 | 13–18 | 数据边界与契约 |
| 4 | 19–22 | gRPC 服务链路 |
| 5 | 23–28 | 并发与可运行性 |
| 6 | 29–36 | Agent 切片与复盘 |

## 命令

| 命令 | 作用 |
|---|---|
| `npm run sync` | 从 Markdown 确定性生成课程 JSON |
| `npm run dev` | 同步、持续监听并启动 Vite |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 工程检查 |
| `npm test` | Vitest 单元测试 |
| `npm run build` | 构建前同步并生成生产产物 |
| `npm run test:e2e` | Playwright 桌面与移动真实浏览器验收 |

Playwright 截图、trace 与 HTML 报告写入 `output/playwright/`、`playwright-report/`，均已忽略，不进入提交。

## Vercel 部署

项目可作为 Vite 静态站点部署到 Vercel。由于构建前同步需要读取仓库根目录的 `docs/go-learning`，推荐以下两种方式：

1. 本地预构建部署：在 `roadmap/` 中执行 `vercel link`、`vercel build --prod`、`vercel deploy --prebuilt --prod`。本地构建可直接读取课程源文件，生成的 `/sources/` 会随静态产物上传。
2. Git 集成部署：将 Vercel Root Directory 设为 `roadmap`，并在 Root Directory 设置中启用 **Include source files outside of the Root Directory in the Build Step**，然后使用默认的 `npm run build` 与 `dist` 输出目录。

绑定子域后，以 `vercel domains inspect go.jerret.me` 给出的记录为准；若 DNS 托管在外部服务商，通常需要为 `go` 添加指向 Vercel 的 CNAME。DNS 生效后，Vercel 会自动签发 HTTPS 证书。

## English quick start and data contract

Run `npm install && npm run dev`, then open <http://localhost:5173>. The map is organized as one overall route, three topic tracks, six stage clusters, and 37 Day nodes. Cross-module structure edges are animated and dashed, cross-stage Day transitions are statically dashed, and within-stage learning paths stay solid. Node details open in a half-width desktop drawer or a bottom mobile drawer. Lesson content is generated exclusively from `docs/go-learning/daily-lessons/day-00...day-36`. Progress is evaluation-driven: only `exercise/dayN/notes-eval.md` may set one of the four supported statuses or a 0–100 reference score. Lesson, notes, and evaluation links open deterministic UTF-8 copies under `/sources/`; missing optional files stay disabled. Development mode continuously resynchronizes Markdown changes, and every production build performs a fresh sync first. For Vercel, use a local prebuilt deployment or enable source files outside the `roadmap` Root Directory so the prebuild sync can read the curriculum Markdown.
