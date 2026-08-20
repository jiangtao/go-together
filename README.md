# lesson-together

> 可复用的课程驱动学习框架。
>
> A reusable, curriculum-driven learning framework.

`lesson-together` 把课程内容、逐日练习、学习评测和进度可视化组织成一条可执行、可复盘的学习路径。框架支持多课程共存；当前公开目录可发现“Node.js 工程师 → Go 后端开发者”与“Web 编辑器工程实战”两门课程。课程的发现性 `visibility` 与部署范围 `distribution` 相互独立；本地专用课程不会进入任何公开构建。

仓库地址保持为 [github.com/jiangtao/go-together](https://github.com/jiangtao/go-together)，Vercel 项目名为 `self-go`；仓库、目录、package 与应用内品牌保持不变。

## 组成

- `courses/<courseId>/`：规范课程源；当前默认课程 `go-backend` 保留 Day 0–36 的展示节奏。
- `learning-records/<courseId>/lessons/<lessonId>/`：学习者本地笔记、评测与练习，不进入 Git 或公开站点。
- `release-progress/<courseId>.json`：由评测记录派生的脱敏公开进度快照，不接受手工回写。
- `roadmap/`：React 路线图，展示每日课程、状态、Markdown Reader 和 Zen 画布。
- 安全生成链：Catalog、Course Source 与脱敏进度快照经过公开投影、审计、Vite 构建及 Build Output API v3 打包后发布。

## 新增课程（维护者）

先阅读[新增与学习课程操作手册](./docs/course-authoring.md)：其中提供创建 Draft、添加 Lesson、验证发布和学习评测的可复制自然语言入口。

本分支已用按课程隔离的学习记录替代旧的 `exercise/dayN` 布局；旧路径只用于迁移或兼容参考，新课程不得再写入旧 exercise 路径。要让一门新课出现在路线图，按以下顺序维护：

1. 在 `courses/catalog.json` 注册唯一 `courseId`，填写 `manifestPath: courses/<courseId>/course.json` 与 `distribution: public|local-only`；完成校验后才将生命周期设为 `published`，`draft` 不进入公开课程选择器。
2. 创建课程源：`courses/<courseId>/course.json`、`courses/<courseId>/lessons/<lessonId>.md`，以及课程自己的 `courses/<courseId>/evaluation/policy.md` 和 `courses/<courseId>/evaluation/command-profile.json`。Manifest 中的 Lesson、评测政策和命令配置共同定义稳定身份与评测范围。
3. 学习者证据写入私有 `learning-records/<courseId>/lessons/<lessonId>/notes.md` 与 `evaluation.md`；这些记录不进入公开站点。`courses/` 是课程源，`learning-records/` 是私有证据，不能互相当作第二事实源。
4. 由评测记录派生 `release-progress/<courseId>.json`，只保留安全状态和参考分数；它是公开状态快照，不手工回写，也不覆盖 Evaluation。
5. 在 `roadmap/` 生成并验证公开投影：运行 `npm run generate:public`、`npm run check:determinism`、`npm run audit:generated`，再用 `npm run build:hosting` 产出并审计 `roadmap/.vercel/output`。生成器读取 Catalog、课程源和 Release Progress，不读取私有学习记录作为公开正文。
6. 只发布已审计的 `roadmap/.vercel/output` prebuilt artifact。只有 `published + distribution: "public"` 的条目进入公开 Catalog；其中仅 `visibility: "listed"` 出现在课程选择器。`distribution: "local-only"` 的课程只能由 `npm run generate:local`/`dev` 在本地生成，公开 Catalog、`dist` 和 prebuilt 包必须零文件。发布边界和回滚流程见 [`roadmap/DEPLOYMENT.md`](./roadmap/DEPLOYMENT.md)。

## 开始学习已发布课程（学习者）

维护者新增课程与学习者开始学习是两条不同流程。学习者从路线图选择已发布课程后，使用评测 Skill 的自然语言入口，明确提供稳定身份 `(courseId, lessonId)`，并按该 Skill 请求准备当前 Lesson、开始或继续严格评测、查询掌握状态，或执行课程允许的本地验证。系统从该课程 Manifest 解析 Lesson、Policy、Command Profile 和 Learning Record 路径；Day、标题、默认课程或对话记忆不能替代身份。

准备阶段只排他创建 Notes，不创建 Evaluation、不执行命令、不代写答案。评测阶段重读当前 Lesson 的 Notes 与允许的工程证据，只更新对应 `learning-records/<courseId>/lessons/<lessonId>/evaluation.md`；不得反向改写课程源、Release Progress 或 Roadmap。缺少稳定身份、跨 Lesson、敏感内容或任意命令请求时，Skill 会停止并要求补齐安全边界。

自然语言入口示例：

- 维护者：请用 `$course-authoring` 创建 `courseId=python-backend` 的 Draft Course，提供标题、描述、语言、Track/Stage 和评测契约。
- 维护者：请用 `$course-authoring` 向 `courseId=python-backend` 添加 `lessonId=http-routing`，提供 Day（或明确 `null`）、目标、Goals、正文和评测能力项。
- 学习者：请用 `$evaluate-course-lesson`，显式提供 `courseId=go-backend`、`lessonId=why-go-after-node`，准备该 Lesson 的 Notes。
- 学习者：请用 `$evaluate-course-lesson`，显式提供同一 `courseId=go-backend`、`lessonId=why-go-after-node`，开始或继续严格评测；进入“重新学习”后仍沿用这组身份重新开始。

## 快速入口

- Production Roadmap（唯一推荐入口）：<https://self-go.vercel.app/>
- Go 后端课程：<https://self-go.vercel.app/courses/go-backend>
- Web 编辑器工程课程：<https://self-go.vercel.app/courses/editor-engineering>
- Legacy 兼容入口：<https://go-together-roadmap.vercel.app/>
- Legacy 兼容入口：<https://lession-together.vercel.app/>
- GitHub 源码：<https://github.com/jiangtao/go-together>
- 本地启动：

```bash
cd roadmap
npm ci
npm run dev
```

本地专用算法课程可访问 <http://127.0.0.1:5173/courses/algorithm>；公开站点和部署包不包含该路由的数据文件。

需要 Node.js 24.x 与 npm 11.x，默认本地地址为 <http://127.0.0.1:5173/>。完整开发、验证和安全发布命令见 [`roadmap/README.md`](./roadmap/README.md) 与 [`roadmap/DEPLOYMENT.md`](./roadmap/DEPLOYMENT.md)。

历史上曾考虑使用 `go-ahead.vercel.app`，但该域名已被另一 Vercel 项目全局占用。它只作为历史冲突记录保留，不再是本项目的目标域名或推荐入口。

## 公开边界

公开站点只包含教程的结构化安全投影和脱敏进度摘要；回答、练习笔记、评测正文、私有路径、本机信息、环境变量和 source map 均不会发布。GitHub Actions 只承担 lint 与安全 prebuilt 托管，不运行浏览器 E2E；完整测试保留为本地/人工验证。

## English summary

lesson-together is a reusable, multi-course learning framework that turns curricula into lessons, exercises, evaluations, and a visual progress roadmap. The discoverable public catalog includes [Go backend engineering](https://self-go.vercel.app/courses/go-backend) and [Web editor engineering](https://self-go.vercel.app/courses/editor-engineering). Discoverability (`visibility`) is separate from deployment scope (`distribution`): local-only courses are projected by local development commands but are absent from the public Catalog, `dist`, and deployable prebuilt artifact. The Vercel project is named `self-go`, and the sole recommended production entry is <https://self-go.vercel.app/>. <https://go-together-roadmap.vercel.app/> and <https://lession-together.vercel.app/> remain legacy compatibility aliases. Private notes and evaluation prose stay local; only sanitized public-distribution course projections and redacted progress summaries are published.
