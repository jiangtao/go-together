# Go Learning Curriculum Context

This context defines the language for the Go learning curriculum. The curriculum is a learning system first; runnable code exists to prove understanding, not to become a product roadmap.

## Language

**Course（课程）**:
The first-class learning unit with a coherent learning goal and an ordered set of lessons. Each Course has a stable `courseId` and remains distinct even when multiple Courses share one Language.
_Avoid_: Track, Language, 课程主题

**Course Catalog（课程目录）**:
注册所有 Course 并声明 Default Course 的唯一领域索引；其中的顺序只用于发现和展示，不构成 Course 身份。
_Avoid_: 课程内容仓库, Language 列表, 最近访问记录

**Language（语言）**:
描述 Course 主语言的元数据。Language 用于分类但不标识 Course；一个 Language 可对应多个 Course，而每个 Course 恰有一个 Primary Language。
_Avoid_: Course, Track, 课程身份, 多个同等主语言

**Primary Language（主语言）**:
一个 Course 唯一的主要编程语言，用于表达该 Course 的教学焦点与语言分类。辅助语言、运行时、框架和工具只能作为辅助技术元数据，不能形成第二个主语言或 Course 身份。
_Avoid_: Course ID, 多主语言, 辅助工具即主语言

**Supporting Technology（辅助技术）**:
Course 教学中使用但不构成其主语言的语言、运行时、框架、库或工具；它补充教学语境，不改变 Course 的语言分类或稳定身份。
_Avoid_: Primary Language, 第二 Course, 第二主语言

**Default Course（默认课程）**:
The Course selected when no Course has been explicitly chosen. The current Go Course is the Default Course; default is a selection role, not a different kind of Course.
_Avoid_: 最近打开的课程, 默认语言

**Active Course（当前课程）**:
Roadmap 当前通过公开 URL 精确解析并呈现的唯一 Course；所有 Curriculum、Progress、Reader 内容与临时交互身份都必须属于它。
_Avoid_: Default Course, 最近访问课程, 当前 Day

**Curriculum（课程体系）**:
一个 Course 独占的有序教学结构，由 Track、Stage 与 Lesson 组成；它不能脱离所属 Course 成为独立学习身份。
_Avoid_: Course, 内容目录, 全局课程版本

**Track（学习主干）**:
Course 内用于组织相近 Stage 的主题主干；它只表达课程结构，不标识 Course 或学习记录。
_Avoid_: Course, Language, 学习记录归属

**Stage（学习阶段）**:
Track 内按学习深度组织 Lesson 的课程阶段；调整阶段顺序不改变其中 Lesson 的稳定身份。
_Avoid_: Day, Lesson, 全局阶段

**Lesson（课次）**:
Stage 内最小的可学习、练习和评测单元；每个 Lesson 只属于一个 Course，其稳定身份来自所属 Course 与自身 Lesson 身份。相似内容出现在另一 Course 时仍是独立 Lesson，不共享学习记录。
_Avoid_: Day, Markdown 文件, 全局课次, 跨 Course 共享 Lesson 身份

**Course Lifecycle（课程生命周期）**:
Course 的发布可用性阶段，与 Lesson 的学习状态相互独立；生命周期变化不改变 Course 身份或历史学习记录的归属。
_Avoid_: 学习进度, Lesson 状态, 内容排序

**Course Revision（课程修订）**:
一个 Course 在某次发布中的确定性内容快照身份；修订变化不会创建或替换 Course 身份。
_Avoid_: Course ID, Schema Version, 手工版本号

**Content Revision（内容修订）**:
一个 Lesson 完整教学内容的确定性快照身份，用于内容一致性与缓存验证，不直接决定学习状态。
_Avoid_: Lesson ID, Evaluation Revision, 发布时间

**Evaluation Revision（评测修订）**:
一个 Lesson 的能力、证据与评测政策契约快照；只有与当前评测修订匹配的 Evaluation Record 才构成当前 Progress。
_Avoid_: Content Revision, Evaluation Cycle, Progress 状态

**Replacement Course（替代课程）**:
Retired Course 明示推荐的后继 Course；它保持独立身份，且不会自动接管原 Course 的 URL 或学习记录。
_Avoid_: URL 重定向, Course 重命名, 自动进度迁移

**Recommended Prerequisite Course（建议先修课程）**:
一个 Course 可将另一 Course 声明为可选的学习准备建议；该关系不阻断访问、不改变 Course 身份，也不转移、继承或合并 Progress 与 Learning Record。
_Avoid_: 强制先修门槛, Replacement Course, 跨 Course Progress 依赖

**Retired Lesson（退役课次）**:
已退出当前 Curriculum 但仍保留身份、内容与历史 Learning Record 的 Lesson；它不再参与当前学习顺序或进度统计。
_Avoid_: Deleted Lesson, Archived File, 新 Lesson 身份

**Course Source（课程源）**:
Course 拥有的规范教学内容、结构与资源集合；它是编写输入，不包含学习者回答、评测记录或生成制品。
_Avoid_: Public Projection, Learning Record, Roadmap 数据副本

**Authoring Reference（编写参考材料）**:
归属于 Course、仅用于课程设计或评测的内部材料；它不是 Lesson 正文，也不是学习者记录。
_Avoid_: Public Resource, Learning Record, Lesson 正文

**Exercise Template（练习模板）**:
Course 为一个 Lesson 提供的只读练习起始材料；学习者基于它产生的文件属于 Exercise Workspace。
_Avoid_: Exercise Workspace, 标准答案, 评测结果

**Exercise Workspace（练习工作区）**:
学习者针对一个稳定学习身份创建或修改的练习产物集合；它属于 Learning Record，而不是 Course Source。
_Avoid_: Exercise Template, Course Source, 跨 Lesson 工作区

**Evaluation Record（评测记录）**:
一个稳定学习身份的评测历史与当前判定事实；它只记录该 Lesson 的评测，且不包含可公开的课程正文副本。
_Avoid_: Progress, Public Progress, Answer Key

**Evaluation Core（评测核心）**:
所有 Course 共用的单 Lesson 评测协议，统一四态、评分纪律与安全边界；它不包含任何语言专属工具链或课程内容。
_Avoid_: Course Evaluation Policy, Language Evaluator, Day Evaluator

**Course Evaluation Policy（课程评测政策）**:
一个 Course 对能力证据、课程栏目与工具链适配的内部规则；它可以收紧但不能放宽 Evaluation Core 的安全和零泄露边界。
_Avoid_: Evaluation Core, Answer Key, Public Rubric

**Command Profile（命令档案）**:
Course Evaluation Policy 引用的一组受审工具命令模板，用于验证当前 Lesson 的 Exercise Workspace；它不是任意 shell 权限。
_Avoid_: Shell Script, 用户命令字符串, Language 身份

**Evaluation Cycle（评测周期）**:
学习者针对一个 Lesson 发起的一轮连续评测尝试；重新学习后可以显式开始新周期，但既有周期历史不得删除或重写。
_Avoid_: Evaluation Record, 会话记忆, Progress 快照

**Progress（学习进度）**:
由 Curriculum 与最新有效 Evaluation Record 派生的当前学习状态；它是视图，不是可独立编辑的第二事实源。
_Avoid_: Evaluation Record, 手工进度副本, Day 状态表

**Public Catalog（公开课程目录）**:
Course Catalog 面向公开学习入口的安全投影，只暴露可解析的 Published 与 Retired Course 元数据，不包含 Draft 或私有编写信息。
_Avoid_: Course Catalog 源文件, 发现界面状态, 私有课程清单

**Public Projection（公开投影）**:
从 Course Source 与派生 Progress 生成的严格白名单制品；它可随时重建，绝不反向成为课程或学习记录的事实源。
_Avoid_: Course Source, Learning Record, 手工发布副本

**Public Progress（公开进度）**:
Progress 面向公开 Roadmap 的最小安全投影，只表达稳定 Lesson 身份、四态和诊断分数。
_Avoid_: Evaluation Record, Notes, 手工状态表

**Release Progress Snapshot（发布进度快照）**:
在公开 CI 无法读取私有 Evaluation Record 时，用于运输待发布 Progress 的确定性脱敏快照；它由私有事实源生成，不能手工编辑或反向成为学习事实。
_Avoid_: Evaluation Record, Public Progress, 手工进度源

**Compatibility Projection（兼容投影）**:
从当前规范事实源生成、用于维持既有公开路径或数据形状的只读表示；它不拥有独立身份，也不得回流规范模型。
_Avoid_: 第二真相源, 永久旧存储, 内部双写

**Canonical Course URL（规范课程 URL）**:
The permanent public namespace of a Course is `/courses/{courseId}`. `/`, `/course.json`, and `/sources/lessons/**` are permanent compatibility aliases for the Default Course, which is currently the Go Course.
_Avoid_: 将根路径作为所有课程的规范身份, 将兼容别名用于非默认课程

**Course Cadence（课程节奏）**:
一个 Course 将有序 Lesson 安排为学习节奏的方式；每个 Course 自行定义节奏并可以使用或省略 Day，但必须保持明确的 Lesson 顺序。当前 Go Course 保留既有 Day 0–36 语义，其他 Course 无须套用固定天数。
_Avoid_: 全局 30–40 天模板, 无序 Lesson 集合, 用节奏标签充当学习身份

**Day（日次）**:
A Course-local sequence label for learning cadence. A Course may omit Day; when present, it is unique only within that Course and may change without changing Lesson identity.
_Avoid_: 全局 Day 身份, 跨课程课次 ID

**稳定学习身份**:
The durable identity of a learning unit is the pair (`courseId`, `lessonId`). Day may describe order or cadence but does not replace that identity.
_Avoid_: Day 单独作为身份, Language 与 Day 的组合

**Course-scoped Learning Record（课程域学习记录）**:
Every Exercise, Evaluation, and Progress record belongs to exactly one stable learning identity. Records for the Default Course follow the same ownership model as records for every other Course.
_Avoid_: 全局 Day 记录, Default Course 存储特例, 双重归属

**学习主线**:
The ordered path of concepts, practice, verification, and reflection used to move a Node.js backend developer into Go. It is organized by learning depth, not by product delivery.
_Avoid_: 项目路线, 产品路线

**练习切片**:
A small, focused artifact used to prove one concept or one group of concepts. It may connect to earlier work, but it remains a learning artifact.
_Avoid_: 完整项目, 业务项目

**贯穿案例**:
A stable example domain used to keep exercises coherent across days. It gives names and scenarios to practice with, but it is not the goal of the curriculum.
_Avoid_: 产品项目, 创业项目

**Trip 贯穿案例**:
The shallow-to-middle learning case used to practice Go backend fundamentals such as package design, HTTP, JSON, errors, database access, transactions, gRPC, streaming, concurrency, and observability.
_Avoid_: Trip 产品, 旅行系统

**Agent 扩展案例**:
The advanced learning case introduced near the end of the curriculum to practice tool interfaces, model abstraction, memory, progress streaming, hardening, and shutdown.
_Avoid_: Agent 产品, LLM 平台

**最终验收切片**:
A runnable learning artifact that demonstrates the learner can connect Go backend concepts end to end. It proves competence; it does not define a production product.
_Avoid_: 最终产品, 完整系统
