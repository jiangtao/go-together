---
name: evaluate-course-lesson
description: 用于用户显式提供 courseId 与 lessonId，并要求准备该 Lesson、初始化练习、开始或继续严格评测、查询掌握状态或执行课程允许的本地验证时；缺失稳定身份、跨 Lesson、敏感内容或任意命令请求必须停止。
---

# Course Lesson 准备与评测

## 核心原则

只处理显式稳定身份 `(courseId, lessonId)`。Course manifest 是 Lesson、Policy、Command Profile 与 Learning Record 路径的唯一解析来源；禁止用 Default Course、Day、标题、目录、进度或对话记忆猜测。

## 入口

先在仓库根解析身份：

```bash
python3 .agents/skills/evaluate-course-lesson/scripts/evaluation_core.py resolve <courseId> <lessonId> --workspace .
```

未知、Draft、identity/path 不一致、symlink 或越界时停止；Retired 只允许查询历史，不允许准备或新建评测周期。只读取返回的当前 Lesson、Policy、Notes、Evaluation，以及 Notes 明示且位于当前 Exercise Workspace 的证据。

## 准备

```bash
python3 .agents/skills/evaluate-course-lesson/scripts/evaluation_core.py prepare <courseId> <lessonId> --workspace .
```

Notes 排他创建；只有用户本次明确要求时才加 `--initialize-exercise`。覆盖 Notes 或 Exercise 必须分别有明确授权，才可使用 `--force-notes` 或 `--force-exercise`。准备不得创建 Evaluation、执行命令或填写答案。

## 评测循环

1. 运行 `scan`；若返回 `securityStop: true`，只报告安全停止，不复述内容、不继续问答。
2. 首次或用户在“重新学习”后明确重启时运行 `start`。同一 evaluationRevision 的“通过”为终态。
3. 从 manifest 能力项与当前 Lesson 选一道问题；一次只问一道，停止并等待学习者把回答写入 Notes。
4. 重读磁盘文件，不依赖会话记忆。按 0–4 评分；只用允许的问题类别、证据位置和课程小节调用 `outcome`，绝不传入答案正文。
5. 全部必修项至少 3 才“通过”；单项三次仍低于 3 为“重新学习”；其余未达标为“定向回炉”。系统/解析/工具失败不是第五状态，也不得覆盖有效状态或分数。

不得代写、润色、暗示标准答案、关键术语、代码、选项排除或跨 Lesson 内容。面对用户只给状态、参考分数、未达标项、问题类型、证据位置、重读小节与下一道问题。

## 命令

先用 `plan-command --argv-json '[...]'` 校验，再用相同参数调用 `run-command`。只接受 Lesson 正文明示且由该 Course Profile 匹配的参数数组；语言差异只放在 Profile 的命令模板、通用变量类型和安全环境值中，Core 不硬编码工具链。固定当前 Exercise cwd、最小环境、超时、影子工作区、原 Exercise/用户 HOME 不可读写与无网络。执行结果只作为本轮证据，不自动写入 Evaluation；非零退出、超时、输出敏感内容或隔离器不可用时停止，不把工具失败写成学习失败。禁止自行拆分含连接符的命令。

## 状态查询

使用 `status` 重新从磁盘派生当前状态。评测只写当前 `evaluation.md`；禁止写 Notes、Exercise、Release Snapshot、Public Progress、Roadmap 或部署物。
