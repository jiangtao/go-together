# 统一课程源、练习与进度的规范归属

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 02

## Question

在所有 Course 使用同一逻辑且 Go 全量迁移的前提下，课程源、私有 Exercise、Evaluation、公开 Progress 与相关参考材料应由哪个领域对象拥有，规范位置和引用边界是什么，以及如何禁止双写和路径反向成为身份？

## Answer

- Course 是课程源与编写参考材料的归属根，Lesson 是具体教学内容的归属单元；学习者的 Notes、Exercise Workspace 与 Evaluation Record 均且只均归属于稳定学习身份 `(courseId, lessonId)`。Catalog、Language、Track、Stage、Day 和文件路径都不得拥有学习记录。
- 规范源布局固定为：

  ```text
  courses/
    catalog.json
    <courseId>/
      course.json
      lessons/<lessonId>.md
      resources/public/**
      resources/internal/**
      exercise-templates/<lessonId>/**

  learning-records/
    <courseId>/
      lessons/<lessonId>/
        notes.md
        evaluation.md
        exercise/**
  ```

- `courses/catalog.json` 是 Catalog 唯一真相源；`courses/<courseId>/course.json` 是该 Course 的结构与本地资源引用唯一真相源。Track、Stage、Lesson、Day、标题及资源引用不得再由生成脚本、Roadmap 常量或目录扫描补造。
- `lessons/<lessonId>.md` 只保存教学正文；课程提供的可复用练习起始材料放在 `exercise-templates/<lessonId>`，学习者实际修改的练习放在对应 Learning Record 的 `exercise/`，两者不可混写。
- `resources/public` 只放允许进入安全公开投影的补充教学材料；rubric、答案、评测政策、课程设计记录及其他仅供编写或评测使用的材料放在 `resources/internal`。`internal` 默认不可发布，不能依赖内容扫描将其“清洗后公开”。
- 所有本地引用必须由 Course manifest 以稳定 ID 关联，值采用仓库相对 POSIX 路径，并限制在对应 Course 根目录或 Learning Record 根目录内；拒绝绝对路径、`..`、符号链接逃逸和从文件名反推身份。外部资料必须作为显式 HTTPS 资源元数据存在，不能伪装成本地路径或身份。
- 路径是稳定身份的存储投影，不是身份来源。消费者必须先取得 `courseId` 与 `lessonId`，再由 Catalog、Course manifest 和规范布局解析路径；禁止 glob Day 文件、解析目录名或读取 Markdown 标题来决定记录归属。
- Evaluation Record 是评测历史、当前评测状态与参考分数的唯一私有事实源，并保留追加历史；Progress 是由 Course manifest 与最新有效 Evaluation 派生的当前状态视图。没有 Evaluation 时状态为“未开始”，不得另建可人工编辑的私有 Progress 真相源。
- Public Progress 不是源数据，而是只含后续公开白名单字段的生成投影；它必须由派生 Progress 生成并接受安全审计。`roadmap/content/progress.public.json` 在迁移后停止作为人工维护源，任何 `public`、`.generated`、`dist` 或 prebuilt 文件都不得反向写回课程源或 Learning Record。
- 写入职责固定为单写者：课程编写流程只改 `courses`；学习者只改对应 `notes.md` 与 `exercise/`；评测 Skill 只改对应 `evaluation.md`；生成器只写可删除重建的生成目录。任何状态或内容不得要求同时更新旧路径、新路径与公开制品。
- 现有 `docs/go-learning/**`、`exercise/dayN/**`、`roadmap/content/progress.public.json` 与受保护的 `roadmap/src/data/course.json` 都只是 Go 迁移输入，不是长期兼容存储。迁移必须基于显式 Day-to-`lessonId` 映射一次性复制并校验，随后在同一切换点让全部消费者改读新模型；禁止长期双读、双写、符号链接或文件级兼容副本。旧公开 URL 的永久兼容由生成层提供，不由保留旧源目录实现。
- `docs/learning-records/**` 当前记录的是课程设计决策，不是学习者 Learning Record；迁移时应归入 `go-backend` 的 internal authoring references 或仓库治理文档，不能因目录名被 Progress 或评测逻辑摄取。精确迁移顺序、哈希清单、回滚与删除门禁由最终迁移决策票冻结。
