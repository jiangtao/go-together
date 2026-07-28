# Day 3：EditorState、EditorView 与 Transaction 数据流

English title: **EditorState, EditorView, and the Transaction Data Flow**

## 学习目标

今天建立 ProseMirror 最重要的数据流心智：View 展示 State，交互产生 Transaction，旧 State 应用 Transaction 得到新 State，View 再更新。你要理解 Transform、Step、StepMap、transaction metadata 和 dispatchTransaction，并能用轨迹解释每次变化。

## 背景与问题

命令直接改 DOM 看起来简单，但它把状态、历史、协同、保存和 UI 通知拆成多条隐式路径。某个功能可能更新了 DOM 却没进入 undo，另一个功能保存了 JSON 却没映射选区。系统越大，旁路越多。

Transaction 把变化集中到单一检查点。它不仅包含新文档，还记录 Steps、selection、stored marks、scroll 请求和 metadata。插件可以在 apply 阶段更新自己的状态，应用层可以在 dispatchTransaction 观察是否 docChanged，再决定保存和遥测。

## 原理机制

EditorState 是持久不可变值。state.tr 创建基于当前状态的 Transaction；Transaction 继承 Transform，通过一个或多个 Step 逐步形成新 doc。每个 Step 产生 StepMap，用于把旧位置映射到新文档。state.apply 或 applyTransaction 计算新 State，并允许插件追加 transaction。

EditorView 持有当前 State 的视图投影。默认 dispatch 会应用 transaction；自定义 dispatchTransaction 可接入 React 或应用状态循环，但必须按顺序应用全部 transactions，并调用 view.updateState。它不是异步保存回调，也不应等待网络后才更新本地输入。

### 核心术语

- Transform：在一份文档上累积 Steps 的变换器。
- Step：可应用、可映射、通常可反转的原子结构变化。
- StepMap/Mapping：旧位置到新位置的转换。
- Transaction：带编辑状态信息和 metadata 的 Transform。
- dispatchTransaction：View 向宿主提交 transaction 的边界。
- appendTransaction/filterTransaction：插件过滤或追加变换的能力。

## 架构边界与取舍

编辑器必须先本地应用输入以保持响应；持久化和协同是 transaction 之后的异步消费者。不要把服务端确认塞进 dispatchTransaction。应用可以订阅 docChanged 生成保存信号，但 selection-only transaction 不应触发正文保存。

Transaction metadata 适合携带当前变换的来源、是否进入历史和插件信号，不适合作为长期业务事件库。Step 也不是默认的永久审计格式；Schema 与插件版本变化会影响可重放性。

filterTransaction 能阻止变化，但滥用会让输入“无反应”。能在 Command 层判断的业务规则优先在那里返回不可用状态；真正保护状态不变量时再使用过滤。

## 逐步实验：Transaction Inspector

1. 用已完成的 Schema 创建 EditorState 与 EditorView。
2. 自定义 dispatchTransaction，记录时间、docChanged、selectionSet、steps 类型、metadata key 和新旧文档摘要。
3. 执行输入、删除、toggle mark、改变 selection、粘贴和 undo，比较轨迹。
4. 为每个 Step 保存 toJSON，并立即 fromJSON 后在相同初始文档重放；验证结果相等。
5. 添加一个只统计 docChanged 次数的 Plugin state，再添加 appendTransaction 实验，观察一次 dispatch 可能产生多条 transaction。

### 观察点

- Transaction 创建后，tr.doc 与起始 state.doc 有何关系？
- selection 如何随每个 Step 自动映射？何时必须 setSelection？
- selection-only transaction 是否有 Steps？
- appendTransaction 怎样避免无限追加？
- React state 更新与 view.updateState 的先后如何影响 stale state？

## 产出物

- 一张完整数据流图，标注同步与异步边界。
- Transaction Inspector 输出的六类操作轨迹。
- 一个 Step 重放测试与一个 appendTransaction 防循环测试。

## 指标与获取方法

对固定文档分别测量 transaction 构建、state.apply 和 view.updateState，不能把三者合成一个数字。至少采样 100 次并报告 p50/p95；记录 Steps 数、受影响范围与文档节点数。保存与网络不进入本日交互基线。

## 常见失败模式

- 直接修改 View DOM 或 Node attrs，绕过 Transaction。
- 在 dispatchTransaction 内等待 autosave，阻塞输入。
- 只调用 state.apply 却忘记 view.updateState。
- 用旧 state 创建命令，导致 mismatched transaction。
- appendTransaction 每次都追加同类 metadata，形成循环。

## 课后任务

实现一个“输入来源”metadata 约定，区分 keyboard、toolbar、paste 和 system。说明哪些消费者可以依赖它、它为什么不能替代持久审计日志，并为未知来源定义降级行为。

## 能力项

- **state-transaction-mechanism**：解释 State、View、Transform、Step、StepMap 和 Transaction 的关系。
- **dispatch-data-flow**：设计本地同步更新、应用通知和异步副作用的边界。
- **transaction-trace-verification**：用轨迹、重放测试和分段性能数据证明理解。

## 评测提示

评测会给出一段 dispatchTransaction 伪流程，要求找出状态旁路或阻塞点。只会调用 API 而不能解释映射与数据流，不能通过。

## 定向回炉

- 关系混淆：回看“原理机制”，从一个 Step 手推新 doc 与 map。
- 副作用错层：回看“架构边界”，把本地更新与网络保存拆开。
- 轨迹不足：重做 Inspector，只保留一种输入直到因果清楚。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [ProseMirror Guide：Transactions](https://prosemirror.net/docs/guide/#state.transactions)
- [ProseMirror Guide：Data flow](https://prosemirror.net/docs/guide/#view.data_flow)
- [ProseMirror Reference：state](https://prosemirror.net/docs/ref/#state)
- [ProseMirror Reference：transform](https://prosemirror.net/docs/ref/#transform)

