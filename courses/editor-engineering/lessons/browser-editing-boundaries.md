# Day 1：浏览器编辑边界——contenteditable 只是入口

English title: **Browser Editing Boundaries: contenteditable Is Only the Entry Point**

## 学习目标

今天要把“按下一个键，页面出现一个字”拆成可观察的链路。你将区分用户意图、beforeinput、composition、DOM mutation、DOM Selection、ProseMirror transaction 和产品状态，并知道哪些行为应该交给浏览器，哪些必须由编辑器接管。

## 背景与问题

普通表单控件提供单一字符串和简单 selection index；富文本编辑宿主则允许节点、样式和嵌套结构变化。浏览器需要同时服务输入法、拼写检查、自动更正、双向文本、无障碍和平台快捷键。任何“全面 preventDefault 后自己插字”的方案都会很快碰到系统能力缺失。

另一方面，完全信任浏览器产生的 DOM 也不可靠。不同输入来源可能生成不同节点，composition 期间 DOM 处于中间态，浏览器插件也可能改写内容。编辑器引擎的工作不是消灭浏览器，而是建立可验证的同步边界。

## 原理机制

一次普通输入通常从键盘或输入法产生意图，浏览器发出 beforeinput；若未取消，浏览器可能先改变 DOM，再发 input。IME 会在 compositionstart、若干 compositionupdate、compositionend 之间产生中间文本。ProseMirror View 观察事件和 DOM 变化，将有效差异解析回 Schema 文档并派发 Transaction；新 EditorState 再用于校正 View。

并非所有输入都能或应该在 beforeinput 阶段取消。官方 ProseMirror Guide 明确说明，浏览器在光标移动、拼写检查和部分输入方面拥有复杂原生能力，因此 ProseMirror 经常允许浏览器先处理，再把结果解释为状态变化。

### 核心术语

- editing host：contenteditable 生效的编辑宿主。
- beforeinput/input：用户编辑意图之前与 DOM 更新之后的输入事件。
- composition：输入法尚未提交的组合文本周期。
- DOM Selection/Range：浏览器表示页面选区和插入点的对象。
- MutationObserver：观察 DOM 结构变化，但不能单独还原用户意图。
- reconciliation：让 DOM 投影与编辑器状态重新一致。

## 架构边界与取舍

浏览器拥有排版、原生选择、IME 和辅助功能；ProseMirror 拥有结构化文档、Selection、Transaction 与插件状态；React 应用拥有文档身份、工具栏、保存和业务 UI。不要让 React render 每次重建 contenteditable，也不要让 DOM 事件直接写数据库。

接管越多，行为越一致，但原生能力和兼容成本越高；接管越少，输入更自然，但必须接受 DOM 观察和重解析。正确策略是针对具体输入类型选择拦截点，并用真实浏览器测试验证。

## 逐步实验：输入事件记录器

1. 创建一个仅含 contenteditable 的观察页，不引入 ProseMirror。
2. 监听 keydown、beforeinput、input、compositionstart/update/end、selectionchange、paste 和 DOM mutations。
3. 分别执行英文输入、中文拼音输入、候选词替换、退格、回车、撤销和粘贴。
4. 每条记录包含时间戳、inputType、isComposing、selection anchor/focus 与 DOM 摘要；不得记录真实敏感文本。
5. 再在最小 ProseMirror 编辑器中记录 dispatchTransaction，比较浏览器事件与 transaction 的对应关系。

### 观察点

- composition 期间 beforeinput 是否可取消？DOM 何时改变？
- selectionchange 与 input 的先后是否固定？
- 一个 paste 事件最终形成几个 transaction？
- 浏览器 undo 与 ProseMirror history 是否可能同时响应？
- 同一操作在 Chromium 与 WebKit/Firefox 的轨迹有何差异？

## 产出物

- 三条脱敏事件轨迹：英文、中文 IME、HTML 粘贴。
- 一张 Browser → EditorView → Transaction → EditorState 时序图。
- 一份边界说明：哪些事件观察、哪些拦截、哪些交给浏览器。

## 指标与获取方法

使用 Performance API 在输入事件起点和下一次 paint 后打点，记录至少 30 次样本的 p50/p95。使用 PerformanceObserver 收集超过 50ms 的 Long Task，并关联当时的 inputType。指标必须标注浏览器、设备、文档规模和是否开启开发工具；本日只建立基线，不根据单次样本下结论。

## 常见失败模式

- 把 keydown 当成所有文本输入来源，导致 IME、语音和粘贴缺失。
- 在 composition 中途提交业务保存，产生半成品文本。
- 监听 input 后直接读取 innerHTML 作为永久格式。
- 每次 React state 更新都重建 EditorView，导致焦点与选区丢失。
- 记录完整输入正文，制造隐私风险。

## 课后任务

选择一个真实输入异常，例如中文候选词重复、粘贴后光标跳动或撤销两次，写出“观察事实—可能层级—下一步验证”，不能直接猜修复代码。

## 能力项

- **browser-input-mechanism**：解释 beforeinput、input、composition、DOM mutation 与 transaction 的因果关系。
- **editing-boundary-design**：明确浏览器、ProseMirror 和 React 应用的数据所有权。
- **input-observation-evidence**：提交可复现事件轨迹和带环境信息的延迟基线。

## 评测提示

评测会给出一段事件轨迹，要求判断哪些是事实、哪些仍需验证；不会要求背诵固定事件顺序。轨迹、时序图与指标方法缺一不可。

## 定向回炉

- 机制混淆：回看“原理机制”，重排一条 IME 事件链。
- 边界不清：回看“架构边界与取舍”，为三层各写一个禁止事项。
- 证据不足：回做事件记录器，只保留最小可复现操作。

## 验证命令（按需）

npm run typecheck

npm test

## 资料

- [Input Events Level 2](https://w3c.github.io/input-events/)
- [ContentEditable 规范草案](https://w3c.github.io/contentEditable/)
- [Selection API](https://www.w3.org/TR/selection-api/)
- [ProseMirror Guide：View 与数据流](https://prosemirror.net/docs/guide/#view)

