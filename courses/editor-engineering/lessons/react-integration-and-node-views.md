# Day 7：React 集成、NodeView 与编辑器 UI

English title: **React Integration, NodeViews, and Editor UI**

## 学习目标

今天把 ProseMirror 嵌入 React，而不是把 ProseMirror 改造成受控 textarea。你将建立 EditorView 的创建、更新和销毁边界，处理工具栏、浮层、focus、NodeView、Decoration 与 React rendering 的协作。

## 背景与问题

React 倾向于“状态变化后重新渲染 DOM”，ProseMirror View 也维护一棵与 EditorState 同步的可编辑 DOM。若两者同时拥有同一子树，React reconciliation 可能删除浏览器正在 composition 的节点，或让 ProseMirror 的 DOM observer 误以为用户修改了文档。

正确集成不是把每次输入同步到 React state 再传回，而是让 EditorView 拥有编辑宿主，React 拥有外围产品 UI。二者通过 transaction、selection snapshot 和命令注册表通信。

## 原理机制

React effect 创建 EditorView，并在组件卸载或文档身份变化时 destroy。普通 React render 不应销毁 View。编辑器配置变化分两类：可以通过 view.setProps/updateState 更新的运行时变化，以及需要重建 State 或 View 的结构变化。必须显式区分。

NodeView 允许为某个 NodeType 自定义 DOM、contentDOM、update、selectNode、ignoreMutation 和 destroy。contentDOM 是 ProseMirror 管理子内容的入口；没有 contentDOM 的 NodeView 通常表现为叶子或原子 UI。用 React portal 渲染 NodeView 时仍需保证生命周期和 DOM 所有权单一。

Decoration 适合临时视觉状态。浮动工具栏通常读取 view.coordsAtPos 或 selection 坐标定位，但定位值只能作为当前 frame 的 UI 数据，文档改变后要重新计算。

### 核心术语

- mount element：React 留给 EditorView 管理的空 DOM 容器。
- NodeView/contentDOM：自定义节点外壳与 ProseMirror 管理的内容入口。
- portal：把 React 子树渲染到 NodeView DOM 的方式。
- focus boundary：编辑宿主与按钮、弹窗、表单之间的焦点规则。
- updateState/setProps：不重建 View 的两类更新入口。
- destroy：释放 DOM observer、事件监听与插件视图资源。

## 架构边界与取舍

EditorState 是否进入全局 React store 不是原则问题，关键是不要产生两个可写事实源。小型应用可让 EditorView 持有 State并上报派生信息；需要时间旅行或集中调试时可把 State 放到宿主循环，但 transaction 必须保持同步且 View 每次拿到对应的新 State。

NodeView 适合复杂块交互，不适合把每个 paragraph 都包装成重型 React 组件。大量 NodeView 会增加组件生命周期和 DOM 成本。简单语义节点优先使用 toDOM；需要局部控件、异步状态或隔离编辑区时再采用 NodeView。

工具栏鼠标按下可能夺走 selection。应明确哪些按钮阻止默认 focus 转移，哪些弹窗保存 Selection bookmark 后再恢复；不能全局强制 focus。

## 逐步实验：产品 UI 纵向切片

1. 创建 useEditorView 边界：挂载时创建，卸载时销毁，记录创建/销毁次数。
2. 把 Day 5 Command 注册表接入 React 工具栏；按钮状态来自当前 EditorState dry run。
3. 实现链接浮层：打开时保存可映射 selection，确认后派发 Command，取消时不改文档。
4. 实现一个可选择的 callout NodeView；外壳由 React 渲染，正文由 contentDOM 管理。
5. 增加临时搜索 Decoration，而不是写入文档。
6. 使用 React Profiler 和 Performance marks 对 100 次输入采样。

### 观察点

- 父组件重渲染是否重建 EditorView？
- 点击工具栏后 DOM Selection 与 EditorState Selection 如何变化？
- NodeView update 返回 false 时发生什么？
- React 能否修改 contentDOM 子树？为什么不能？
- destroy 后是否仍有 selectionchange、resize 或 provider 回调？

## 产出物

- React/EditorView 所有权图与生命周期测试。
- 工具栏、链接浮层和 callout NodeView。
- focus/selection 场景表。
- React commit、View update 和 input-to-paint profile。

## 指标与获取方法

质量指标包括 View 创建/销毁配对、卸载后零回调、工具栏与快捷键等价、NodeView 更新/销毁覆盖和 selection 恢复成功率。性能记录每次输入的 React commit 数、commit duration、view.updateState 和下一 paint；文档增长时 commit 数不应因外围状态订阅而线性增长。

## 常见失败模式

- 把 EditorState JSON 每键写入 React state，再重建 View。
- effect 依赖不稳定对象，导致每次 render destroy/create。
- React 修改 contentDOM，和 ProseMirror 抢 DOM 所有权。
- NodeView 忘记 destroy portal 或事件监听。
- 弹窗打开后使用过期裸 position。

## 课后任务

为“嵌入式代码块编辑器”写 NodeView ADR：外层与内层谁处理箭头键、undo、focus、clipboard 和序列化？只设计边界，不必真的嵌入另一编辑器。

## 能力项

- **react-editor-lifecycle**：解释 React 与 ProseMirror 的状态、DOM 和生命周期所有权。
- **node-view-ui-boundary**：为 NodeView、浮层、工具栏和 Decoration 选择正确边界。
- **focus-render-verification**：用生命周期、focus/selection 和 profile 证据验证集成。

## 评测提示

评测会审查一个常见 useEffect 集成，要求定位重建、stale state 或资源泄漏。只展示 UI 无法证明生命周期正确。

## 定向回炉

- 双事实源：重画 React、EditorView、EditorState 的写入箭头。
- 焦点错误：最小化为一个按钮和一个 selection，逐事件观察。
- NodeView 泄漏：记录 constructor/update/destroy 次数并配对。
- 性能证据不足：分离 React commit 与 ProseMirror update 再采样。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [ProseMirror Guide：Node views](https://prosemirror.net/docs/guide/#view.node_views)
- [ProseMirror Reference：NodeView](https://prosemirror.net/docs/ref/#view.NodeView)
- [React：Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [ProseMirror Embedded code editor example](https://prosemirror.net/examples/codemirror/)

