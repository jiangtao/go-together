# lesson-together

> 可复用的课程驱动学习框架。
>
> A reusable, curriculum-driven learning framework.

`lesson-together` 把课程内容、逐日练习、学习评测和进度可视化组织成一条可执行、可复盘的学习路径。框架可替换课程主题；当前参考课程是“Node.js 工程师 → Go 后端开发者”，按 Day 0–36 推进，适合用 36+ 天完成。

仓库地址保持为 [github.com/jiangtao/go-together](https://github.com/jiangtao/go-together)；本次命名只描述产品定位，不修改仓库、目录、package、部署项目或应用内品牌。

## 组成

- `docs/go-learning/daily-lessons/`：Day 0–36 课程源 Markdown。
- `exercise/dayN/`：学习者本地笔记与评测结果，不进入公开站点。
- `roadmap/`：React 路线图，展示每日课程、状态、Markdown Reader 和 Zen 画布。
- `roadmap/content/progress.public.json`：只保存可公开的 Day、状态和参考分数。
- 安全生成链：课程源和脱敏进度经过公开投影、审计、Vite 构建及 Build Output API v3 打包后发布。

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
