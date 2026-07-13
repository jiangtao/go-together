# 统一评测 Skill 与课程进度语义

Type: grilling
Status: resolved
Assignee: Codex (/root)
Blocked by: 02, 03

## Question

评测核心、课程专属政策、允许命令、Exercise/Evaluation/Progress 关系以及现有 `evaluate-go-day` 用户入口应如何分层，才能复用四态进度语义、支持不同语言工具链并保持 Go 学习流程兼容？

## Answer

- 建立唯一通用入口与核心 `$evaluate-course-lesson <courseId> <lessonId>`，统一承担准备、评测、继续问答和状态查询。调用必须显式提供稳定学习身份；只有 Course manifest 能把该 Course 内唯一的 Day 别名解析为 `lessonId`，核心禁止从默认课、最近进度、目录名或对话记忆猜测身份。
- 现有 `$evaluate-go-day dayN` 永久保留为兼容适配器：它固定 `courseId = go-backend`，继续要求唯一显式 Day 0–36，通过 Catalog 与 Go Course manifest 解析 `lessonId` 后调用同一核心。它不得保留独立评分逻辑、Go 旧目录解析或第二份评测政策。
- 通用 Evaluation Core 固定以下跨 Course 不变量：每次只处理一个 Lesson、一次只问一道题、只依据该 Lesson 明示要求、禁止跨 Lesson 补充、零答案泄露、每个必修能力项最多三次有效回答、五级诊断分 0–4、全部必修项至少 3 级才通过，参考分数按 `等级总和 / (能力项数 × 4) × 100` 四舍五入。高分不能抵消任一必修项不通过。
- 四态是全部 Course 共用的 Progress 语义：没有有效 Evaluation 为“未开始”；存在未达标项且仍有回答机会为“定向回炉”；同一能力项三次仍低于 3 级为“重新学习”；全部必修项达标为“通过”。系统失败、安全停止和缺少材料不是第五种学习状态，不得伪造或覆盖上一次有效状态。
- 状态转换固定为：`未开始 → 定向回炉 | 通过`，`定向回炉 → 定向回炉 | 重新学习 | 通过`，`重新学习` 只有在学习者显式重新开始新评测周期后才能再次进入评测，旧周期历史与尝试次数不得删除；同一 Lesson 内容修订内的“通过”保持终态。内容修订导致的重评规则由 Course 生命周期决策冻结。
- 通用核心只定义评测协议和安全上限；Course Evaluation Policy 定义该 Course 的课程栏目、证据要求、允许的工具链 Command Profile 和必要的课程专属措辞。政策规范位置为 `courses/<courseId>/resources/internal/evaluation-policy.md`，并由 Course manifest 显式引用；Lesson 只声明自身能力与证据，不复制全局政策。
- Course Policy 只能收紧通用安全边界，不能关闭显式身份、单 Lesson 读取、三次上限、零泄露、敏感信息停止或单写者规则。未来 Python Course 通过新增政策与受审 Command Profile 接入，不复制 Evaluation Core，也不创建平行状态体系。
- Command Profile 由预审的参数数组模板组成，不接受任意 shell 字符串。执行目录锁定到当前 Exercise Workspace，使用最小环境、禁止网络、凭据和环境注入，设置超时，并拒绝连接符、管道、重定向、命令替换、安装、生成、格式化写入、migration、数据库写入及工作区外写入。
- Go Command Profile 保持现有兼容能力：仅允许课程明确要求的 `go test`、`go test -race`、`go vet`、`go test -bench` 模板；即使匹配模板，可能访问数据库、网络或外部服务的命令仍不自动执行。Python 等未来 Profile 必须以同样方式逐模板审计，不能通过放开 shell 获得兼容性。
- 准备模式只读取 Lesson 与 Course Policy，排他创建 `learning-records/<courseId>/lessons/<lessonId>/notes.md`，并仅在显式请求时从 Exercise Template 初始化尚不存在的 Exercise Workspace；覆盖 Notes 或 Exercise 必须获得本次请求的明确授权。准备模式不得创建 Evaluation、执行课程命令或填写学习者答案。
- 评测模式只读取指定 Lesson、Course Policy、Notes、既有 Evaluation，以及 Notes 明确引用且位于当前 Exercise Workspace 内的证据；只原子更新当前 `evaluation.md` 快照并追加历史，不修改 Notes、Exercise、Course Source 或历史事件。Evaluation Record 必须显式绑定 `courseId` 与 `lessonId`，路径与文件内身份不一致时停止。
- 发现 token、密钥、DSN、认证头或完整隐私数据时立即停止；只允许在 Evaluation 历史追加不含原文的安全终止事件，当前有效状态、等级与参考分数保持不变。解析失败、工具缺失、命令超时或政策无效同样不得被解释为学习失败。
- Progress 由 Course manifest 中的有序 Lesson 与各 Lesson 最新有效 Evaluation 快照确定；总进度、Stage 进度和“下一课”按 Curriculum 的 Lesson 顺序计算，不按 Day 数值、文件名或数组偶然位置计算。Day 仅用于兼容展示；没有 Day 的 Course 仍必须完整工作。
- Evaluation Skill 不写 Public Progress、Roadmap 数据或部署制品。公开状态由生成器从派生 Progress 进行白名单投影；`referenceScore` 仍是诊断值，不能被 UI、发布或兼容层重新解释为通过门槛。
- Go 兼容验收必须证明：原有 `$evaluate-go-day dayN` 话术与四态判定保持可用；所有读写已落到 `go-backend` 的规范 Course/Learning Record；旧 `exercise/dayN`、`notes-eval.md`、`docs/go-learning` 和人工 `progress.public.json` 不再被运行时读取或写入。
