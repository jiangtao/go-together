# 新增与学习课程操作手册

本手册只使用自然语言 Skill 入口。维护课程与学习已发布课程是两条流程：课程源在 `courses/`，学习证据仅保留在私有 `learning-records/`，Roadmap 只渲染经审计的公开投影。

## 1. 创建 Draft Course

维护者必须一次提供：唯一 kebab-case `courseId`、标题、描述、语言 `id/label`、初始 Track 与 Stage、至少一个 Lesson，以及课程的评测政策和命令配置。每个初始 Lesson 都要给出唯一 `lessonId`、Day（没有则明确为 `null`）、标题、目标、Goals、正文和评测能力项。

复制并补全：

```text
请用 $course-authoring 创建 Draft Course：
courseId=<course-id>
标题=<标题>
描述=<描述>
语言 id/label=<language-id>/<语言名称>
初始 Track=<track-id、标题、描述>
初始 Stage=<stage-id、标题、描述>
初始 Lesson=<lessonId、Day 或 null、标题、目标、Goals、正文、评测能力项>
评测契约=<课程自己的评测政策与命令配置>
请校验完整性；信息缺失、ID 或路径重复时停止，不覆盖已有内容。
```

创建结果必须是 Draft。不要用标题、Day、默认课程或对话记忆代替稳定 ID。

## 2. 添加 Lesson

只能向 Draft Course 添加一个明确的新 Lesson。必须提供现有 `courseId`、新 `lessonId`、所属 Track/Stage、Day（或 `null`）、标题、目标、Goals、正文和评测能力项。

复制并补全：

```text
请用 $course-authoring 向 Draft Course 添加 Lesson：
courseId=<course-id>
lessonId=<lesson-id>
Track/Stage=<track-id>/<stage-id>
Day=<数字或 null>
标题=<标题>
目标=<objective>
Goals=<goals>
正文=<课程正文>
评测能力项=<competencies>
请确认不覆盖已有 Lesson、Policy、Command Profile 或资源，并重新校验完整 Course Contract。
```

## 3. 验证并发布

发布前必须完整校验 Draft→Published 转换、课程资源、私有评测派生的 `release-progress`，以及公开生成、确定性、公开审计和 hosting build。

复制并补全：

```text
请用 $course-authoring 验证并发布 courseId=<course-id>：
仅在 Draft→Published 合法、课程契约完整、Release Progress 可由私有 Evaluation 派生，且公开生成、确定性检查、审计与 hosting build 全部通过时发布。
请报告公开投影与 prebuilt 审计结果；任何失败都保持 Draft，不公开、不覆盖内容。
```

只有 `courses/catalog.json` 中为 `published`，且上述门禁全部通过的课程，才会进入 Roadmap 课程选择器。Draft 永远不可见。

## 4. 学习与评测已发布课程

学习者必须显式给出 `(courseId, lessonId)`。准备 Notes、开始或继续严格评测、查询状态和定向回炉都使用同一组身份。

```text
请用 $evaluate-course-lesson，显式提供 courseId=<course-id>、lessonId=<lesson-id>，准备该 Lesson 的 Notes。
```

```text
请用 $evaluate-course-lesson，显式提供 courseId=<course-id>、lessonId=<lesson-id>，开始严格评测。
```

```text
请用 $evaluate-course-lesson，显式提供 courseId=<course-id>、lessonId=<lesson-id>，继续严格评测；如为定向回炉或重新学习，请基于当前未达标项给出下一步学习与重新评测入口。
```

Notes 和 Evaluation 仅写入当前 Lesson 的私有学习记录，不进入 Git 或公开站点；评测不会代写答案、修改课程源、公开进度或 Roadmap。

## 常见阻断

- 缺少 `courseId`、`lessonId`、必填元数据或评测数据时，Skill 会停止，不猜测。
- ID、路径或资源已存在时，不能重复或覆盖。
- Lesson 只能添加到 Draft；Published/Retired 身份不能任意改写。
- Contract、Release Progress、公开生成或审计失败时，课程保持 Draft，Roadmap 不显示它。
