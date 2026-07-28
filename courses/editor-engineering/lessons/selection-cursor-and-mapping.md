# Day 4：选区、光标、位置与映射

English title: **Selections, Carets, Positions, and Mapping**

## 学习目标

今天要能解释“光标为什么跳了”。你将区分 DOM Selection/Range 与 ProseMirror Selection，掌握树中 position、ResolvedPos、anchor/head、from/to、TextSelection、NodeSelection、AllSelection 和 StepMap，并用边界实验验证映射。

## 背景与问题

光标不是文档中的字符，而是两个内容位置之间的可视化插入点；折叠选区只是 Selection 的一种状态。DOM 用节点加 offset 表示位置，offset 对文本节点和元素节点含义不同。ProseMirror 则用文档树中的整数 position，并通过 resolve 得到路径、父节点和深度。

当文档在光标前插入或删除内容，旧整数会失效。异步上传、远端协同、插件 decorations 和历史都需要把旧位置映射到新文档。如果忘记映射，功能在简单段落可用，却会在列表、嵌套节点和并发操作中错位。

## 原理机制

ProseMirror position 计数节点边界和文本内容。ResolvedPos 提供当前深度、父节点、父内 offset、nodeBefore/nodeAfter 等上下文。Selection 至少有 anchor/head，保留用户选择方向；from/to 是排序后的范围边界，不能替代方向。

TextSelection 的端点必须位于 inline content 中；NodeSelection 选择一个可选节点；AllSelection 用于整份文档。每个 Step 产生 StepMap，Mapping 串联多个 map。mapResult 除新位置外还能告诉你位置是否被删除；assoc 决定边界插入时位置偏向左侧还是右侧。

DOM 与 ProseMirror 之间由 EditorView 的 posAtDOM、domAtPos、coordsAtPos 和 posAtCoords 等接口桥接。映射失败时应先确认你处理的是模型位置、DOM 节点 offset 还是屏幕坐标。

### 核心术语

- caret：折叠选区在可编辑区域中的可视插入点。
- anchor/head：选择开始与当前活动端，表达方向。
- from/to：按文档顺序排列的范围。
- ResolvedPos：带树路径上下文的位置。
- assoc：映射或解析边界位置的关联方向。
- bookmark：可映射、可在新文档中恢复的轻量 Selection 表示。

## 架构边界与取舍

浏览器负责绘制与移动 DOM Selection，EditorState 保存语义 Selection，View 负责两者同步。工具栏打开时，React focus 变化可能让 DOM Selection 消失，但业务操作仍应基于已保存且映射过的 EditorState Selection，而不是随意缓存 Range。

同步单机 transaction 使用 StepMap；Yjs 协同中的长生命周期位置不能只保存 ProseMirror 整数，Day 14 会改用 RelativePosition。评论锚点等长期业务数据也必须明确采用文档内节点、映射日志或 CRDT 相对位置，不能存裸 index。

## 逐步实验：位置与选区可视化器

1. 创建含段落、加粗文本、列表和原子节点的固定文档。
2. 遍历合法 position，显示整数、depth、parentOffset、nodeBefore/nodeAfter。
3. 同时显示 DOM Selection 的 anchorNode/offset 与 ProseMirror anchor/head。
4. 对选区前插入、选区内删除、节点包裹、列表提升和原子节点删除，记录每个 StepMap。
5. 使用不同 assoc 映射同一边界位置，解释差异。
6. 测试正向、反向、折叠、NodeSelection 和整文档选择。

### 观察点

- 文本长度相同的两个 DOM，ProseMirror position 是否必然相同？
- anchor 大于 head 时，from/to 如何变化？
- 删除恰好覆盖光标位置时，map 与 mapResult 给出什么信息？
- coordsAtPos 的视觉坐标能否作为持久位置？
- 双向文本中“视觉左侧”是否总等于较小 position？

## 产出物

- 可视化器截图或录屏，以及对应的固定文档 JSON。
- 至少 8 个 selection mapping 场景测试。
- 一页“位置类型选择表”：DOM、ProseMirror、屏幕坐标、Yjs RelativePosition 的用途和生命周期。

## 指标与获取方法

对包含多层列表和大量 marks 的固定文档执行 1,000 次 mapping，分别记录 map 与 mapResult 的耗时。性能不是本课主要瓶颈，但要建立回归基线。质量指标包括映射后 Selection 可解析率、被删除位置显式处理率和正反向选择覆盖率。

## 常见失败模式

- 把 DOM offset 直接当 ProseMirror position。
- 只保存 from/to，丢失 anchor/head 方向。
- 异步回调继续使用创建时的裸 position。
- 删除节点后无视 mapResult.deleted，悄悄把锚点移到错误内容。
- 通过强制 focus 修复工具栏，反而破坏用户当前选择。

## 课后任务

设计一个异步链接预览：用户选中文本后请求元数据，请求返回前文档可能继续编辑。只写位置生命周期、映射和取消策略，不实现网络。说明何时应放弃结果。

## 能力项

- **selection-position-mechanism**：解释四类位置与 Selection 方向、类型和约束。
- **selection-mapping-design**：正确使用 StepMap、Mapping、assoc 和删除语义。
- **cursor-debugging-evidence**：用可视化和边界测试定位光标问题。

## 评测提示

评测会给出一次删除与插入后的旧 selection，要求说明需要哪些证据才能恢复，而不是让你猜最终数字。双向文本和 focus 仅考边界意识，不要求自研光标绘制。

## 定向回炉

- 位置混淆：回到可视化器逐个对照 DOM offset 与 model position。
- 方向丢失：重做反向选择场景，比较 anchor/head 和 from/to。
- 映射错误：只保留一个 Step，检查 assoc 与 deleted，再扩展到 Mapping。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [Selection API](https://www.w3.org/TR/selection-api/)
- [ProseMirror Guide：Selection](https://prosemirror.net/docs/guide/#state.selection)
- [ProseMirror Reference：Selection](https://prosemirror.net/docs/ref/#state.Selection)
- [Web 编辑器中的光标原理](https://zhuanlan.zhihu.com/p/407713779)

