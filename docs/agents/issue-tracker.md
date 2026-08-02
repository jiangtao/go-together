# Issue tracker: GitHub Issues

工程规格与实现票据发布在 [jiangtao/go-together Issues](https://github.com/jiangtao/go-together/issues)，使用 `gh issue` 创建、读取与更新。规格与票据必须使用标准 triage 标签，并在正文中声明真实阻塞边。

## Conventions

- 先发布规格，再发布或关联每个实施票据；票据正文包含 What to build、Acceptance criteria 与 Blocked by。
- 使用 `ready-for-agent` 表示规格完整、可由代理实施；不以 Issue 关闭状态代替 triage 标签。
- 所有对 GitHub 的写操作先读取目标 Issue，避免覆盖维护者的正文、评论、标签或阻塞关系。
- 历史 `.scratch/` 文件是既有本地记录，不再作为新工程票据的发布位置。

## When a skill says "publish to the issue tracker"

使用 `gh issue create --repo jiangtao/go-together` 发布 Issue，并应用 `ready-for-agent`，除非工作流明确要求其他状态。

## When a skill says "fetch the relevant ticket"

使用 `gh issue view <number> --repo jiangtao/go-together` 读取完整正文和评论。用户提供 URL 时先解析出所属仓库和编号。

## Learning Answer Issues

课程学习回答不是工程票据，不能创建在当前公开仓库。首个接入的 `algorithm-review` Course 使用本机配置指定的私有 GitHub 答题仓库；协议、命令和 22:00 审核流程见 `docs/learning-issues.md`。
