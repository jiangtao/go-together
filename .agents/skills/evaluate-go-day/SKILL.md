---
name: evaluate-go-day
description: 用于用户显式指定 Day 0-36，并要求开始当天学习、创建或重建 exercise/dayN/notes.md、提交当天笔记进行严格评测、继续同 Day 问答或查看当天掌握状态时；禁止推断 Day、跨 Day 扩展或泄露答案。
---

# Go 日课准备与评测

只处理用户明确指定的唯一 Day，范围为 Day 0 到 Day 36。不得用“今天”“下一课”、学习进度或对话记忆猜测 Day。

## 路由

- 用户说“开始 Day 13”“创建 day13 笔记”“把 Day 13 作业带到 notes”等开始、准备、创建意图时，执行“快速准备”。
- 用户提交 `exercise/dayN/notes.md`、要求评测或查看当天掌握状态时，执行“启动或继续评测”。
- 用户继续当天问答或回炉重评时，仍要求本次请求含唯一明确 Day，再执行“启动或继续评测”。
- 同一请求同时要求创建/覆盖和评测，或出现两个不同 Day 时，停止并要求用户消除歧义。

## 快速准备

在仓库根目录运行，并传入用户的原始指令：

```bash
python3 .agents/skills/evaluate-go-day/scripts/prepare_go_day.py "开始 Day 13" --workspace .
```

脚本接受不区分大小写的 `dayN`、`dayNN`、`day-NN` 和 `Day NN`，但整条指令只能解析出一个 Day。脚本会：

1. 唯一定位 `docs/go-learning/daily-lessons/day-NN-*.md`，并核对课程 H1 的 Day。
2. 只摘录当天显式学习目标、实践列表、完成标准、建议产物、验证命令、检索问题和当天专属证据表。
3. 排除 Node.js 对照、Go 核心讲解、示例答案/代码、常见误区以及跨 Day 阶段验收。
4. 按既有学习回答格式生成 `exercise/dayN/notes.md`，不生成 `notes-eval.md`，不执行课程命令。

实际写入默认使用排他创建；目标 `notes.md` 已存在时必须停止，绝不自动合并、补写或覆盖。`--dry-run` 只输出预览，即使已有笔记也不会修改：

```bash
python3 .agents/skills/evaluate-go-day/scripts/prepare_go_day.py "Day 13" --workspace . --dry-run
```

只有用户明确说“覆盖”或“重建”现有笔记时，才允许增加 `--force`。先说明该操作会替换学习者已有回答，再运行：

```bash
python3 .agents/skills/evaluate-go-day/scripts/prepare_go_day.py "重建 Day 13 笔记" --workspace . --force
```

不得由模型补充课程未出现的答案、提示、示例解法、命令、证据要求或其他 Day 内容。

## 启动或继续评测

1. 从本次请求取得唯一明确 Day，并规范化为 `dayN`；范围只允许 `day0` 到 `day36`。
2. 在仓库根目录运行：

   ```bash
   python3 .agents/skills/evaluate-go-day/scripts/resolve_go_day.py dayN --workspace .
   ```

3. 解析脚本返回的 `course`、`notes` 和 `evaluation` 路径。脚本失败时立即停止，只报告缺失项；不得自动创建笔记替代评测提交。
4. 完整读取 [评测政策](references/evaluation-policy.md)。
5. 只读取解析出的当日课程、`notes.md`、已存在的 `notes-eval.md`，以及 `notes.md` 明确引用且位于本仓库内的当天练习产物。不得读取其他 Day、仓库外文件、环境变量或密钥文件。

## 建立当日评分表

从当日课程的学习目标、Node.js 对照、Go 核心心智、实践步骤、产物、验证命令、检索问题和常见误区中提取必修能力项。合并重复要求，按 [评测政策](references/evaluation-policy.md) 归一为 100 分。

不得加入当日课程未出现的概念、API、框架、性能要求或进阶知识。分数不能抵消未通过的必修能力项。

## 执行问答

1. 首次优先使用当日“检索问题”原文。
2. 每次只问一道题，然后停止并等待用户把回答写入 `exercise/dayN/notes.md`。
3. 继续评测时重新解析 Day，读取最新 `notes.md` 和 `notes-eval.md`，不得依赖记忆猜测上次状态。
4. 回答含糊时只要求澄清同一能力项。允许改变措辞或当天场景，不得添加新术语或暗示答案。
5. 每个能力项最多三次回答机会。第三次仍未达标时，状态改为“重新学习”，结束本次评测。

## 输出与记录

评测阶段只修改 `exercise/dayN/notes-eval.md`：更新顶部当前状态，并在末尾追加本次评测记录。不得修改 `notes.md`、课程正文、练习代码或历史评测记录。

每次面向用户只输出：当前状态、参考分数、未达标能力项、判定依据、回炉小节标题，以及下一道问题或重新学习要求。严格执行 [零答案泄露规则](references/evaluation-policy.md#零答案泄露)。

最终状态只有：

- `通过`：全部必修能力项达标。
- `定向回炉`：存在未达标项且尚有回答机会。
- `重新学习`：同一能力项三次仍未达标。

## 验证命令

只自动执行当日课程明确要求、且 `notes.md` 指定了本地练习目录的非破坏性 Go 命令：`go test`、`go test -race`、`go vet`、`go test -bench`。拒绝 shell 连接符、重定向、命令替换、环境变量注入和网络访问。

不得自动执行 `gofmt -w`、`sqlc generate`、`protoc`、migration、数据库写入、安装、删除或生成命令。只检查学习者在 `notes.md` 中提供的命令结果与产物；证据不足时判定对应能力项未验证。

## 安全停止

发现疑似 token、密钥、DSN、认证头或完整隐私数据时立即终止评测。在 `notes-eval.md` 中只记录“发现敏感信息，评测终止”，不得复述敏感内容。
