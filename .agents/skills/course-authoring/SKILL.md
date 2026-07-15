---
name: course-authoring
description: Use when a maintainer explicitly asks to create a course, add a lesson, validate a draft, or publish a course into this repository's roadmap.
---

# Course Authoring

## 适用范围

只处理维护者明确提出的课程维护意图。每次请求必须提供稳定的 `courseId`；新增 Lesson 还必须提供稳定的 `lessonId`。不得用标题、Day、目录名、默认课程或对话记忆猜测身份。

课程源是 `courses/`，评测契约来自课程自己的 `evaluation/policy.md` 与 `evaluation/command-profile.json`，学习者证据属于私有 `learning-records/`，公开状态只能由 `release-progress/` 派生。旧 `exercise/dayN` 不再是新课程入口。

## 工作流

### 创建 Draft Course

1. 要求完整元数据：`courseId`、标题、描述、语言 `id/label`，以及初始 Track、Stage、Lesson 结构。
2. 在 `courses/catalog.json` 增加唯一 Draft 声明；Manifest 固定为 `courses/<courseId>/course.json`。
3. 创建 `courses/<courseId>/course.json`、`lessons/<lessonId>.md`、`evaluation/policy.md` 和 `evaluation/command-profile.json`，并补齐 Manifest 声明的所有资源文件。
4. 使用 `roadmap/scripts/lib/course-authoring.ts` 与现有 Course Contract 校验；任何重复 ID、重复或已存在路径、缺失字段、非法相对路径或 schema 不匹配都必须停止。

### 添加 Draft Lesson

1. 要求现有 `courseId`、新 `lessonId`、所属 Track/Stage、Day（没有 Day 时明确为 `null`）、标题、目标、Goals、正文和评测能力项。
2. 只允许向 Draft Course 添加；先检查新 Lesson ID、正文路径和可选模板路径均未占用，再更新 Manifest 与 Lesson 文件。
3. 重新校验完整 Course Contract；不覆盖已有 Lesson、Policy、Command Profile 或资源，不接受隐式迁移或批量猜测。

### 验证并发布

1. 维护者明确请求发布时，确认 Draft→Published 是合法单向转换，Course/Language/Manifest 身份不变，所有 Lesson 与 authoring files 完整。
2. 从私有 Evaluation 派生 `release-progress/<courseId>.json`，不得手工编写或让 Snapshot 反向修改 Evaluation。
3. 在 `roadmap/` 运行公开生成、确定性检查、公开审计和 `build:hosting`；发布只接受审计通过的 `roadmap/.vercel/output` prebuilt artifact。
4. 只有 `courses/catalog.json` 中生命周期为 `published` 且上述生成/审计/构建全部成功的课程，才进入公开 Catalog 和路线图选择器。Draft 源永不公开；失败时保持 Draft 并报告阻断原因。

## 学习者交接

学习者评测必须交给 `$evaluate-course-lesson`，并显式使用 `(courseId, lessonId)`。该 Skill 负责准备 Notes、开始或继续严格评测、状态查询和定向回炉；Evaluation 只写入 `learning-records/<courseId>/lessons/<lessonId>/evaluation.md`。`$evaluate-go-day` 只保留为 `go-backend` 的显式 Day 兼容路由，不得恢复 `exercise/dayN` 推断。

## 必须停止的情况

- 缺少稳定 ID、元数据不完整、Course/ Lesson 重复或目标路径已存在。
- 请求覆盖已有文件、改变 Published/Retired 身份、跨课程写入或使用 symlink/越界路径。
- Draft 未完成完整 Contract、Release Progress 无法由私有 Evaluation 派生，或公开生成/审计/build 失败。
- 请求代写学习者 Notes/Evaluation、修改状态、绕过评测 Skill，或直接发布未审计 source tree。

## 回报

报告 courseId、lessonId（如适用）、当前生命周期、写入/未写入的规范路径、验证结果和阻断原因。不得输出私有 Notes、Evaluation 正文、答案、命令参数或本机路径；发布前必须明确说明公开投影与 prebuilt 审计结果。
