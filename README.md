# lesson-together

> 可复用的课程驱动学习框架。
>
> A reusable, curriculum-driven learning framework.

`lesson-together` 把课程内容、逐日练习、学习评测和进度可视化组织成一条可执行、可复盘的学习路径。框架可替换课程主题；当前参考课程是“Node.js 工程师 → Go 后端开发者”，按 Day 0–36 推进，适合用 36+ 天完成。

仓库地址保持为 [github.com/jiangtao/go-together](https://github.com/jiangtao/go-together)；本次命名只描述产品定位，不修改仓库、目录、package、部署项目或应用内品牌。

## 组成

- `courses/<courseId>/`：规范课程源；当前默认课程 `go-backend` 保留 Day 0–36 的展示节奏。
- `learning-records/<courseId>/lessons/<lessonId>/`：学习者本地笔记、评测与练习，不进入 Git 或公开站点。
- `release-progress/<courseId>.json`：由评测记录派生的脱敏公开进度快照，不接受手工回写。
- `roadmap/`：React 路线图，展示每日课程、状态、Markdown Reader 和 Zen 画布。
- 安全生成链：Catalog、Course Source 与脱敏进度快照经过公开投影、审计、Vite 构建及 Build Output API v3 打包后发布。

## 新增课程（维护者）

先阅读[新增与学习课程操作手册](./docs/course-authoring.md)：其中提供创建 Draft、添加 Lesson、验证发布和学习评测的可复制自然语言入口。

本分支已用按课程隔离的学习记录替代旧的 `exercise/dayN` 布局；旧路径只用于迁移或兼容参考，新课程不得再写入旧 exercise 路径。要让一门新课出现在路线图，按以下顺序维护：

1. 在 `courses/catalog.json` 注册唯一 `courseId`，填写 `manifestPath: courses/<courseId>/course.json`；完成校验后才将生命周期设为 `published`，`draft` 不进入公开课程选择器。
2. 创建课程源：`courses/<courseId>/course.json`、`courses/<courseId>/lessons/<lessonId>.md`，以及课程自己的 `courses/<courseId>/evaluation/policy.md` 和 `courses/<courseId>/evaluation/command-profile.json`。Manifest 中的 Lesson、评测政策和命令配置共同定义稳定身份与评测范围。
3. 学习者证据写入私有 `learning-records/<courseId>/lessons/<lessonId>/notes.md` 与 `evaluation.md`；这些记录不进入公开站点。`courses/` 是课程源，`learning-records/` 是私有证据，不能互相当作第二事实源。
4. 由评测记录派生 `release-progress/<courseId>.json`，只保留安全状态和参考分数；它是公开状态快照，不手工回写，也不覆盖 Evaluation。
5. 在 `roadmap/` 生成并验证公开投影：运行 `npm run generate:public`、`npm run check:determinism`、`npm run audit:generated`，再用 `npm run build:hosting` 产出并审计 `roadmap/.vercel/output`。生成器读取 Catalog、课程源和 Release Progress，不读取私有学习记录作为公开正文。
6. 只发布已审计的 `roadmap/.vercel/output` prebuilt artifact。只有 `courses/catalog.json` 中 `lifecycle: "published"` 的条目，在公开生成、确定性检查、审计和构建全部成功后才进入公开 Catalog 与路线图课程选择器；`draft` 课程源不会出现。发布边界和回滚流程见 [`roadmap/DEPLOYMENT.md`](./roadmap/DEPLOYMENT.md)。

## 开始学习已发布课程（学习者）

维护者新增课程与学习者开始学习是两条不同流程。学习者从路线图选择已发布课程后，使用评测 Skill 的自然语言入口，明确提供稳定身份 `(courseId, lessonId)`，并按该 Skill 请求准备当前 Lesson、开始或继续严格评测、查询掌握状态，或执行课程允许的本地验证。系统从该课程 Manifest 解析 Lesson、Policy、Command Profile 和 Learning Record 路径；Day、标题、默认课程或对话记忆不能替代身份。

准备阶段只排他创建 Notes，不创建 Evaluation、不执行命令、不代写答案。评测阶段重读当前 Lesson 的 Notes 与允许的工程证据，只更新对应 `learning-records/<courseId>/lessons/<lessonId>/evaluation.md`；不得反向改写课程源、Release Progress 或 Roadmap。缺少稳定身份、跨 Lesson、敏感内容或任意命令请求时，Skill 会停止并要求补齐安全边界。

自然语言入口示例：

- 维护者：请用 `$course-authoring` 创建 `courseId=python-backend` 的 Draft Course，提供标题、描述、语言、Track/Stage 和评测契约。
- 维护者：请用 `$course-authoring` 向 `courseId=python-backend` 添加 `lessonId=http-routing`，提供 Day（或明确 `null`）、目标、Goals、正文和评测能力项。
- 学习者：请用 `$evaluate-course-lesson`，显式提供 `courseId=go-backend`、`lessonId=why-go-after-node`，准备该 Lesson 的 Notes。
- 学习者：请用 `$evaluate-course-lesson`，显式提供同一 `courseId=go-backend`、`lessonId=why-go-after-node`，开始或继续严格评测；进入“重新学习”后仍沿用这组身份重新开始。

## 快速入口

- Production Roadmap：<https://go-together-roadmap.vercel.app>
- GitHub 源码：<https://github.com/jiangtao/go-together>
- 本地启动：

```bash
cd roadmap
npm ci
npm run dev
```

需要 Node.js 24.x 与 npm 11.x，默认本地地址为 <http://127.0.0.1:5173/>。完整开发、验证和安全发布命令见 [`roadmap/README.md`](./roadmap/README.md) 与 [`roadmap/DEPLOYMENT.md`](./roadmap/DEPLOYMENT.md)。

## 公开边界

公开站点只包含教程的结构化安全投影和脱敏进度摘要；回答、练习笔记、评测正文、私有路径、本机信息、环境变量和 source map 均不会发布。GitHub Actions 只承担 lint 与安全 prebuilt 托管，不运行浏览器 E2E；完整测试保留为本地/人工验证。

## English summary

lesson-together is a reusable learning framework that turns a curriculum into daily lessons, exercises, evaluations, and a visual progress roadmap. The current reference curriculum guides Node.js engineers toward Go backend development over 36+ days. Private notes and evaluation prose stay local; only a sanitized course projection and redacted progress summary are published.
