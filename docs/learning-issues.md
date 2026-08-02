# GitHub 答题 Issue 与夜间审核

`algorithm-review` 的学习者回答可以使用私有 GitHub 仓库中的 Issue 进行异步协作。当前课程仓库只保存协议和工具，不保存学习回答、答题仓库地址、访问令牌或审核日志。

## 边界与前提

- 答题仓库必须是学习者可访问、已启用 Issues 的私有 GitHub 仓库；当前公开 `jiangtao/go-together` 不可作为答题仓库。
- 每个 Answer Issue 只属于一个稳定学习身份 `(courseId, lessonId)`。Day、标题、路径和对话记忆都不能代替该身份。
- 学习者是回答正文的唯一作者。创建工具只生成骨架；审核工具只更新协议标签和通用审核评论。
- 本机 Evaluation Record 仍是评测、Progress 和 Release Progress 的唯一事实源。答题 Issue 审核状态不等于课程通过。
- 工具只处理 `algorithm-review`；其他 Course 必须先明确接入并补齐其 Course Evaluation Policy。

## 本机配置

配置文件必须位于 Git 忽略的本机位置。建议创建 `.learning-issues/answer-issues.json`：

```json
{
  "schemaVersion": 1,
  "targetRepository": "owner/private-learning-answers",
  "reviewerCommand": [
    "/usr/bin/python3",
    "/absolute/path/to/go-together/tools/codex_issue_reviewer.py",
    "--workspace",
    "/absolute/path/to/go-together"
  ]
}
```

`targetRepository` 不是可公开分享的课程元数据。`reviewerCommand` 调用受限审核器；它使用只读、临时 Codex 会话，最终只返回 `passed`、`revision-needed` 或 `blocked`，不会将回答写进本机日志。

先初始化私有答题仓库的协议标签：

```bash
python3 tools/learning_issues.py init \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

初始化会验证 GitHub CLI 认证、目标仓库的私有可见性和 Issue 能力，并幂等创建协议标签。

## 作答流程

为一个明确 Lesson 创建或复用唯一答题 Issue：

```bash
python3 tools/learning_issues.py open \
  --config .learning-issues/answer-issues.json \
  --workspace . \
  --course-id algorithm-review \
  --lesson-id arrays-strings-matrices
```

学习者在该私有 Issue 的“学习者回答”和“证据链接”栏目中自行填写内容。完成后将 Issue 提交到审核队列：

```bash
python3 tools/learning_issues.py submit \
  --config .learning-issues/answer-issues.json \
  --workspace . \
  --issue <issue-number>
```

状态标签是互斥的：

| 标签 | 含义 | 可转入 |
| --- | --- | --- |
| `answer:open` | 学习者正在作答 | `review:pending` |
| `review:pending` | 等待夜间审核 | `review:passed`、`review:revision-needed`、`review:blocked` |
| `review:passed` | 本轮 Issue 审核完成 | 无自动转换 |
| `review:revision-needed` | 学习者需继续修订 | 由学习者重新提交为 `review:pending` |
| `review:blocked` | 协议、安全或运行条件阻断 | 修复后由维护者重新提交 |

没有可靠审核结论时，工具保留 `review:pending`，绝不错误标记 `review:passed`。

## 每日 22:00 审核任务

先预览会写入 crontab 的专属条目：

```bash
python3 tools/learning_issues.py schedule-preview \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

确认后安装：

```bash
python3 tools/learning_issues.py schedule-install \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

安装的任务在本机时区每天 `22:00` 执行，使用绝对路径、最小 `PATH`、单实例锁和配置目录中的最小日志。重复安装只替换本工具带 `go-together-answer-review` 标记的条目，不影响已有 crontab 任务。卸载同样只删除该专属条目：

```bash
python3 tools/learning_issues.py schedule-uninstall \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

Cron 不会唤醒处于休眠或关机状态的 Mac；本流程不承诺漏跑后的补偿执行。

## 审核纪律

- 审核器只读取当前 Course、当前 Lesson、当前私有 Issue 和其最小证据。
- 审核器不得编辑 Issue 正文、课程源、Notes、Evaluation Record、Progress、Release Progress 或 crontab。
- 审核评论为固定的流程性文本，不能引用学习者回答、给出标准答案、提示、代码或推导。
- 审核器、GitHub CLI、协议或网络失败时不输出回答内容；该 Issue 保持待审核，供下一次任务重试。
- 真正的课程评测仍必须通过 `$evaluate-course-lesson` 和当前 Course Evaluation Policy 完成。
