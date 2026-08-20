# GitHub 答题 Issue 与夜间审核

`algorithm` 的学习者回答可以使用私有 GitHub 仓库中的 Issue 进行异步协作。当前课程仓库只保存协议和工具，不保存学习回答、答题仓库地址、访问令牌或审核日志。

## 边界与前提

- 答题仓库必须是学习者可访问、已启用 Issues 的私有 GitHub 仓库；当前公开 `jiangtao/go-together` 不可作为答题仓库。
- 每个 Answer Issue 只属于一个稳定学习身份 `(courseId, lessonId)`。Day、标题、路径和对话记忆都不能代替该身份。
- 学习者是回答正文的唯一作者。创建工具只生成骨架；审核工具只更新协议标签和通用审核评论。
- 本机 Evaluation Record 仍是评测、Progress 和 Release Progress 的唯一事实源。答题 Issue 审核状态不等于课程通过。
- 工具只处理 `algorithm`；其他 Course 必须先明确接入并补齐其 Course Evaluation Policy。

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

为一个明确 Lesson 创建或复用唯一答题 Issue；若唯一匹配 Issue 被手工关闭，工具会重新打开它而不新建重复 Issue：

```bash
python3 tools/learning_issues.py open \
  --config .learning-issues/answer-issues.json \
  --workspace . \
  --course-id algorithm \
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

## English Reference

`algorithm` learner answers can be handled asynchronously through Issues in a private GitHub repository. The current course repository stores only the protocol and tooling; it never stores learner answers, the answer-repository address, access tokens, or review logs.

### Boundary and prerequisites

- The answer repository must be private, accessible to the learner, and have Issues enabled. The public `jiangtao/go-together` repository must not be used for answers.
- Every Answer Issue belongs to one stable learning identity, `(courseId, lessonId)`. A Day, title, path, or conversation memory cannot replace that identity.
- The learner is the only author of the answer body. Creation writes a skeleton only; review updates protocol labels and a generic review comment only.
- The local Evaluation Record remains the sole source of evaluation, Progress, and Release Progress. An Answer-Issue review status does not mean the Course was passed.
- The tool serves `algorithm` only. Another Course must be explicitly integrated and given its own Course Evaluation Policy.

### Local configuration

Keep the configuration in a Git-ignored local location. A recommended `.learning-issues/answer-issues.json` is:

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

`targetRepository` is not shareable public Course metadata. `reviewerCommand` invokes the constrained reviewer: it runs a read-only, ephemeral Codex session and returns only `passed`, `revision-needed`, or `blocked`; it does not write answers to local logs.

Initialize the protocol labels in the private answer repository:

```bash
python3 tools/learning_issues.py init \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

Initialization verifies GitHub CLI authentication, private visibility of the configured repository, and its Issue capability, then creates protocol labels idempotently.

### Answer workflow

Create or reuse the single Answer Issue for a concrete Lesson. If its sole matching Issue was manually closed, the tool reopens it rather than creating a duplicate:

```bash
python3 tools/learning_issues.py open \
  --config .learning-issues/answer-issues.json \
  --workspace . \
  --course-id algorithm \
  --lesson-id arrays-strings-matrices
```

The learner fills in “学习者回答” and “证据链接” in that private Issue, then submits it to the review queue:

```bash
python3 tools/learning_issues.py submit \
  --config .learning-issues/answer-issues.json \
  --workspace . \
  --issue <issue-number>
```

Protocol status labels are mutually exclusive:

| Label | Meaning | Automatic next state |
| --- | --- | --- |
| `answer:open` | The learner is writing | `review:pending` |
| `review:pending` | Waiting for nightly review | `review:passed`, `review:revision-needed`, or `review:blocked` |
| `review:passed` | This Issue-review round finished | No automatic transition |
| `review:revision-needed` | The learner must revise | The learner resubmits it as `review:pending` |
| `review:blocked` | Protocol, safety, or runtime condition blocks review | A maintainer may resubmit after repair |

Without a reliable review conclusion, the tool retains `review:pending`; it must never incorrectly mark `review:passed`.

### Daily 22:00 review task

Preview the dedicated crontab entry first:

```bash
python3 tools/learning_issues.py schedule-preview \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

After confirmation, install it:

```bash
python3 tools/learning_issues.py schedule-install \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

The job runs daily at `22:00` in the local timezone, with absolute paths, a minimal `PATH`, a single-instance lock, and a minimal log under the configuration directory. Reinstalling replaces only its `go-together-answer-review` entry and preserves other crontab jobs. Uninstall also removes only that entry:

```bash
python3 tools/learning_issues.py schedule-uninstall \
  --config .learning-issues/answer-issues.json \
  --workspace .
```

Cron does not wake a sleeping or powered-off Mac; this workflow does not promise catch-up execution.

### Review discipline

- The reviewer reads only the current Course, current Lesson, current private Issue, and minimal evidence.
- It must not edit an Issue body, Course source, Notes, Evaluation Record, Progress, Release Progress, or crontab.
- Review comments are fixed workflow text and must not quote a learner answer or provide an answer key, hint, code, or derivation.
- A reviewer, GitHub CLI, protocol, or network failure never emits answer contents. The Issue remains pending for a later retry.
- Formal Course evaluation must still use `$evaluate-course-lesson` and the current Course Evaluation Policy.
