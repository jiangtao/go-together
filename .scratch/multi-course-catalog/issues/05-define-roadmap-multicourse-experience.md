# 定义 Roadmap 多课程导航与状态模型

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 02, 04

## Question

Roadmap 应如何解析 Default Course、显式 Course URL、课程切换、Canvas/Day/Reader/Zen 状态与焦点恢复，才能让现有 Go 根入口行为不变，同时保证任何交互状态都不会跨 Course 串联？

## Answer

- 浏览器 URL 是 Active Course 的唯一选择事实源；不得用 `localStorage`、最近访问或 Progress 猜测课程。`/` 固定解析为 `go-backend` 且不重定向，`/courses/<courseId>` 只按 Public Catalog 精确解析对应 Published 或 Retired Course；Draft、未知 ID、额外路径和非法编码进入明确的未找到状态，不回退 Default Course。规范 URL 不带尾斜杠，尾斜杠只用 `history.replaceState` 规范化。
- Roadmap 首先加载 `/courses/catalog.json`，再按已解析 `courseId` 并行加载同一 Course 的规范 `course.json` 与 `progress.json`；二者必须通过 v1 exact-key parser，并在 `courseId`、`courseRevision`、Lesson 集合与顺序上完全匹配。根入口也消费 `/courses/go-backend/**`，legacy `/course.json` 只服务旧客户端，不作为新应用运行时数据源。缺失 Progress、修订漂移或解析失败均显示当前 Course 的可重试错误，不把状态补成“未开始”，也不继续展示旧 Course。
- 顶部 Header 保留 Active Course 标题；当 Catalog 有至少两个可发现的 Published Course 时，在现有 `header-actions` 最前放一个 shadcn `Select`，使用 Lucide `BookOpenIcon`、当前课程标题与 Language，命名为“切换课程”。触控目标至少 44×44 px，长标题单行截断；桌面保持紧凑，390×844 与 360×800 下独占可用行且不得产生横向滚动。只有一个 Published Course 时显示静态 Language/课程身份，不呈现无效下拉框。Retired Course 只可被直接 URL 打开，Header 标示“已退役”及可选 Replacement Course；常规选项只列 Published Course。
- 选择 Course 使用 `history.pushState` 进入其规范 URL；浏览器前进/后退使用同一解析流程，面板开关不写入历史。切换请求必须中止旧 fetch，并以请求代次与 `courseId` 双重丢弃迟到结果；切换是原子事务：先令旧 surface 失效，再加载新 Course，成功后才提交对应课程、Progress 与画布。失败保留目标 URL 和错误页，不回滚或静默显示上一课。
- 运行时状态固定拆成：`RouteState`（入口种类与 `courseId`）、按 `(courseId, courseRevision)` 标识的 `CourseLoadState`、正交的 `zen: boolean`，以及互斥 `Surface`。`Surface` 仅为 `canvas`、`day { identity, trigger }`、`reader { identity, resourceHref, origin, trigger }`；其中 `identity` 必须是完整 `(courseId, lessonId)`。所有打开、返回、关闭和异步 Reader 结果都先校验 identity 与 Active Course 一致；Course 改变立即把 surface 归零为 canvas，禁止相同 `lessonId` 在不同 Course 间误复用。
- Zen 继续是应用级 CSS 聚焦状态，不并入 Course 或 Surface。正常 UI 的 Course Select 在 Zen 中隐藏，因此用户从 Select 切课时已处于普通 canvas；若浏览器历史在 Zen 中切课，保留 Zen 但关闭 Day/Reader。Zen 内仍可打开当前 Course 的 Day 与 Reader，关闭后回到同一 Course 的 Zen；Escape 始终逐层执行 Reader → Day → Zen。Reader 继续保持桌面 70vw、移动端 100% 可用宽度，Day Drawer 与 Reader 不改变画布 transform。
- React Flow transform 按 `(courseId, courseRevision, desktop|mobile)` 只在内存中隔离缓存。某组合首次进入时以 `duration: 0` 完整 `fitView`，不得默认定位推荐 Lesson；同一组合切走再返回时恢复原 transform。Course Revision 或响应式布局档变化视为新组合并重新全览。Zen 进出、Day/Reader 开关必须保持 transform；任何恢复任务一旦检测到用户拖拽或缩放立即取消，绝不抢回视口。
- Course、Track、Stage、Lesson 与 Progress 全部来自规范投影；移除运行时的 Go 标题、固定三 Track/六 Stage、Day 0–36、连续 Day、`day-*` ID 和根级 Lesson href 假设。画布只按 Course 内 Track/Stage/Lesson 顺序建图；Go 投影必须继续得到现有三主干、六阶段和 Day 0–36 体验。Lesson 有 Day 时显示 `Day N`，无 Day 时显示 `第 N 课`；搜索、选中、推荐和 Progress 均按 `lessonId` 与 manifest 顺序工作，Day 仅作课程内展示标签。
- Course Select 只在普通 canvas 可操作；Drawer/Reader 打开时由现有模态焦点陷阱隔离。Select 切换成功后焦点回到新 Header 的 Course Select；浏览器历史或深链接加载成功后聚焦可编程的页面 `h1`，错误时聚焦错误标题/重试区域。Day 关闭回原卡片，Day→Reader 初始聚焦返回按钮，canvas→Reader 初始聚焦关闭按钮，Reader/Day 关闭继续恢复原 trigger；若 trigger 因 Course 改变已销毁，则回退新 Course `h1`。
- 加载使用与现有视觉语言一致的结构骨架；错误、未知课程、空 Catalog 都提供简短原因与重试/返回 `go-backend`，不得使用全局 spinner、渐变、装饰卡片或自动跳转。切换完成与 Retired 状态通过 `aria-live="polite"` 宣告；Select 使用标准键盘行为、可见 focus ring 和可访问名称，所有动效遵守 reduced-motion。
- 该交互沿用现有 shadcn Header、React Flow、Drawer、Reader 与 Zen 词汇，状态与布局契约已足以直接实现；不制作低保真原型。后续门禁必须覆盖根入口与规范 URL 等价、双课程切换、迟到请求、history、首次全览/逐 Course transform、Day/Reader/Zen 分层、Retired/404/解析错误，以及 1440×900、1024×768、390×844、360×800 的焦点与无溢出表现。
