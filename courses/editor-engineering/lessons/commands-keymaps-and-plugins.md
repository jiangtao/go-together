# Day 5：Command、Keymap 与 Plugin 扩展模型

English title: **Commands, Keymaps, and the Plugin Extension Model**

## 学习目标

今天把“加粗按钮”拆成意图、可用性判断、Transaction 和 UI 投影。你将掌握 Command 的调用契约、chainCommands、Keymap 优先级、Plugin state、PluginKey、props、decorations 和 plugin view，并设计低耦合扩展。

## 背景与问题

如果工具栏按钮直接操作 DOM，快捷键又走另一套逻辑，二者会很快产生不同的可用条件、历史行为和焦点处理。插件若直接互相读取内部变量，也会形成顺序敏感的隐式依赖。

ProseMirror 的扩展模型把编辑动作表示为 Command，把按键映射为 Command，把跨 transaction 状态放进 Plugin state，再由 decorations 或 plugin view 投影到界面。统一入口让同一意图可由键盘、菜单、命令面板或自动化调用。

## 原理机制

标准 Command 接收 state、可选 dispatch 和 view，返回 boolean。dispatch 缺省时，Command 只判断是否可执行，不产生副作用；可执行时返回 true。Keymap 按插件顺序尝试命令，第一个处理成功者停止后续处理。chainCommands 依次尝试多个 Command，常用于退格和回车等上下文行为。

Plugin 可以提供状态字段、view props、filterTransaction、appendTransaction 和 PluginView。Plugin state 应与 EditorState 一样保持不可变，通过 apply 根据 Transaction 更新。PluginKey 提供稳定访问入口并避免重复插件。DecorationSet 必须通过 transaction mapping 前移，否则高亮会漂移。

### 核心术语

- Command：把编辑意图转成可选 Transaction 的纯边界。
- dry run：不传 dispatch，只探测命令能否执行。
- Keymap：快捷键到 Command 的优先级映射。
- Plugin state：随 EditorState 演进的扩展状态。
- PluginView：需要生命周期和 DOM 副作用的视图扩展。
- Decoration：不进入文档数据的视觉投影。

## 架构边界与取舍

文档语义应进入 Schema/Transaction；临时高亮、占位符和远端光标适合 Decoration；产品弹窗与异步请求通常由 React 应用管理；Plugin 只保留编辑上下文和稳定桥接。不要为了“都在编辑器里”把网络、权限和大块 React 状态塞入 Plugin。

Command 应尽量小且可组合。一个“设置标题并保存”命令跨越了编辑与持久化边界；正确做法是 Command 只生成文档变化，应用层观察变化并触发保存。命令可用性要来自当前 state 和 Schema，而不是按钮本地状态。

## 逐步实验：统一命令注册表

1. 实现 toggle strong、set paragraph、set heading、wrap bullet list 和 lift list item。
2. 为每个命令定义 id、label、shortcut、isEnabled 和 run，但底层只保留一份 ProseMirror Command。
3. 让工具栏与 Keymap 使用同一个注册表；在选择变化时更新按钮状态。
4. 实现字数 Plugin state，只在 docChanged 时重新计算；再实现搜索命中 DecorationSet，并在 transaction 后映射。
5. 故意调换 Keymap 顺序，观察冲突快捷键；记录优先级规则。

### 观察点

- dry run 是否真的无 dispatch、无 DOM 和无网络副作用？
- 命令返回 false 后，浏览器或下一个命令发生了什么？
- Plugin state 在 selection-only transaction 中是否需要更新？
- Decoration 应何时重算，何时只 mapping？
- 同一个命令由 toolbar 触发时如何恢复 editor focus，而不覆盖 selection？

## 产出物

- Command contract 与注册表。
- 工具栏/快捷键一致性测试。
- 一个有状态 Plugin 和一个 Decoration 映射测试。
- Plugin 边界 ADR：允许与禁止的依赖。

## 指标与获取方法

质量指标包括每个 Command 的可用/不可用样例、dry run 零副作用、工具栏/快捷键等价和冲突快捷键覆盖。性能上分别测量命令判断、transaction apply 与 Decoration 更新；使用大文档重复 selection change，确认按钮状态计算和装饰重算不会随全文无条件扫描。

## 常见失败模式

- Command 在 dispatch 缺省时仍修改外部状态。
- 工具栏复制命令规则，与快捷键行为漂移。
- Plugin state 原地 mutate，破坏旧 State 可重放性。
- 每次 selectionchange 都扫描整份文档。
- 把 Decoration 写入持久 JSON，污染文档语义。

## 课后任务

设计一个“当前段落是否为空”的 Plugin。分别说明状态是否需要持久化、如何更新、UI 如何订阅、是否值得成为 Plugin。若你认为不需要 Plugin，也要给出判断依据。

## 能力项

- **command-plugin-mechanism**：解释 Command、Keymap、Plugin state、PluginView 和 Decoration 的职责。
- **extension-contract-design**：设计单一命令入口和低耦合插件边界。
- **command-behavior-verification**：用 dry run、等价场景和性能数据验证扩展行为。

## 评测提示

评测可能给出一个含网络副作用的 Command，要求指出违反的契约并定位应移动到哪一层。不会要求背 API 清单。

## 定向回炉

- Command 语义不清：重做 dry run，验证零副作用。
- Plugin 职责过大：把状态、DOM、副作用分别放回三类边界。
- 行为漂移：用同一 fixture 同时调用 toolbar 与 shortcut。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [ProseMirror Guide：Commands](https://prosemirror.net/docs/guide/#commands)
- [ProseMirror Guide：Plugins](https://prosemirror.net/docs/guide/#state.plugins)
- [ProseMirror Reference：commands](https://prosemirror.net/docs/ref/#commands)
- [ProseMirror Reference：view decorations](https://prosemirror.net/docs/ref/#view.Decoration)

