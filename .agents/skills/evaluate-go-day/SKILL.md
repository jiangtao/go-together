---
name: evaluate-go-day
description: 用于用户显式指定 Day 0–36，并要求准备当天学习、创建或重建旧 Go Notes、开始或继续当天评测、查询掌握状态时；缺失或存在多个 Day 时必须停止。
---

# Go Day 兼容路由

本 Skill 只做永久兼容路由：固定 `courseId = go-backend`，把唯一显式 `dayN` 通过受控映射解析为 `lessonId`，随后完全执行 `$evaluate-course-lesson`。不得扫描文件名/H1、猜 Day、维护独立评分、状态机、Policy 或命令白名单。

## 路由

评测、继续问答或状态查询先运行：

```bash
python3 .agents/skills/evaluate-go-day/scripts/resolve_go_day.py dayN --workspace .
```

只接受规范 `day0`–`day36`；脚本返回 `go-backend`、稳定 `lessonId`、`adapter` 及共享 Core 解析的读写边界。随后以返回的稳定身份执行 `$evaluate-course-lesson`，并把返回的 `adapter` 作为 `--adapter` 原样传给 Core；不得丢失该解析上下文或尝试改走尚不存在的 Catalog。安全停止、单问题、四态、三次机会、0–4 评分、零答案泄露和 Command Profile 契约拥有唯一权威。

```bash
python3 .agents/skills/evaluate-course-lesson/scripts/evaluation_core.py status go-backend <lessonId> --workspace . --adapter <adapter>
```

迁移事务完成前，旧 `notes-eval.md` 只允许 `status` 读取；`start`、`outcome` 或安全事件写入必须停止且保持原字节。迁移后仍由同一 Core 继续，不在 Router 内转换或双写。

## 准备

用户说“开始/创建 Day N Notes”时运行：

```bash
python3 .agents/skills/evaluate-go-day/scripts/prepare_go_day.py "<用户原始指令>" --workspace .
```

默认排他创建。只有本次明确说“覆盖/重建”才加 `--force`；只有明确要求初始化 Exercise 才加 `--initialize-exercise`。`--dry-run` 只预览、不写入。

## 停止条件

没有唯一 Day、映射缺失、Notes 缺失、Course/Lesson 退役或共享 Core 拒绝时，只报告缺失条件。不得回退到 `docs/go-learning` glob、`exercise/dayN` 推断、旧独立评测逻辑或其他 Day。
