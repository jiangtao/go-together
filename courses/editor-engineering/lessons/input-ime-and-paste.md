# Day 6：输入、IME 与粘贴管线

English title: **Input, IME, and the Paste Pipeline**

## 学习目标

今天建立输入与粘贴的完整策略：何时信任浏览器，何时通过 View props 拦截；HTML 如何解析为 Slice；结构如何保留或降级；危险内容如何拒绝；中文 IME 如何避免重复和丢字。

## 背景与问题

粘贴是外部世界进入文档模型的最大入口。来源可能是纯文本、网页、Word、Google Docs、另一个 ProseMirror 编辑器或恶意 HTML。视觉相似的内容可能携带大量内联样式、跟踪属性、不可见节点和危险链接。

输入法则说明键盘事件不是文本。composition 期间的中间字符串会多次变化，过早转换、自动保存或命令替换可能打断候选窗口。编辑器需要统一策略，却不能用一种事件处理覆盖所有平台。

## 原理机制

ProseMirror View 通过 handleDOMEvents、handleTextInput、handlePaste 等 props 提供介入点。粘贴 HTML 经 clipboardParser 或 domParser 转成 Slice，transformPasted 可在插入前变换结构；纯文本经 clipboardTextParser 处理。复制时 serializeForClipboard 会携带能帮助 ProseMirror 恢复 Slice 开放深度的信息。

Slice 的 openStart/openEnd 让半个段落或列表片段能插入目标上下文。解析阶段的 Schema 本身会过滤未知结构，但安全策略不能只靠“未知节点丢弃”：link href、图片 URL、属性值和自定义 NodeView 仍需显式验证。

IME 中应避免在 isComposing 时执行会重建 DOM 或移动 selection 的自动规则。真实浏览器 E2E 是必要证据，jsdom 无法模拟完整输入法行为。

### 核心术语

- clipboardParser/clipboardTextParser：HTML 与文本剪贴板解析入口。
- transformPasted：Slice 插入前的结构变换。
- openStart/openEnd：Slice 两端未闭合的树深度。
- composition：IME 组合文本生命周期。
- allowlist：仅接受明确许可的标签、属性和 URL 协议。
- provenance：记录来源类别而非原始敏感内容。

## 架构边界与取舍

Schema 负责最终结构合法；Paste Policy 负责来源清理、语义映射和降级；服务端负责不信任客户端的再次验证；渲染层负责安全 DOM 属性。不要在 transformPasted 内发网络请求，也不要把粘贴原文写日志。

保真与一致性存在取舍。课程策略优先保留段落、标题、列表、引用和基础 marks，去掉来源私有样式；未知块降级为安全文本或明确拒绝。对于产品要求的 Word 高保真，应单独建设转换服务和 corpus，而不是继续扩大通用 parseDOM。

## 逐步实验：跨来源输入 corpus

1. 建立纯文本、本站编辑器、普通网页、Word/Docs 样例和恶意 HTML 五类 fixture。
2. 为每类写预期：保留哪些结构、丢弃哪些样式、危险项如何处理。
3. 实现链接协议 allowlist；拒绝 script、事件属性、javascript/data 等不允许的 href。
4. 对列表片段观察 openStart/openEnd，在段落、列表项和空文档中分别粘贴。
5. 在 Chromium 与至少一个不同内核中执行中文输入、候选替换、撤销和换行。
6. 对 1MB HTML fixture 记录解析、变换、transaction 和 paint 四段耗时。

### 观察点

- Schema 过滤后是否仍可能产生危险 DOM 属性？
- 同站复制与外站复制为什么可以采用不同路径？
- transformPasted 修改 Slice 后，open depth 是否仍合法？
- compositionend 之后产生几次 transaction？历史如何分组？
- 大粘贴卡顿发生在 HTML parse、Schema parse、transform 还是 View update？

## 产出物

- Paste Policy：来源、保留、降级、拒绝和安全理由。
- 至少 12 个脱敏 fixtures 及期望 JSON。
- 中文 IME 浏览器验证记录。
- 1MB 粘贴分段 profile。

## 指标与获取方法

质量指标包括 fixture 通过率、结构保留率、危险协议拒绝率、中文输入丢字/重复次数和 undo 分组正确率。性能必须分段打点并报告 p50/p95、Long Task 数和最终节点数；不能只测总粘贴时间，也不能用真实用户剪贴板作为固定夹具。

## 常见失败模式

- 认为 Schema 等于 HTML sanitizer。
- 只在 keydown 处理输入，破坏 IME 和辅助输入。
- 粘贴时保留全部 style，导致文档语义碎片化。
- transformPasted 返回非法 Slice，却只在某些插入点失败。
- 用 jsdom 通过的测试宣布中文输入可靠。
- 把剪贴板正文写入 telemetry。

## 课后任务

为“粘贴 Markdown 表格”写决策记录：当前课程无 table Schema，应该拒绝、降级为文本还是延后解析？给出用户体验、数据安全、未来迁移和性能依据。

## 能力项

- **input-paste-mechanism**：解释 DOM 输入、composition、clipboard parser、Slice 与 transaction。
- **paste-policy-design**：在结构保真、可预测降级和安全之间作出明确取舍。
- **input-corpus-verification**：用跨来源 corpus、真实浏览器和分段 profile 验证。

## 评测提示

评测会提供一份陌生 HTML 或 IME 轨迹，要求按层分析风险。不会要求提供可直接复制的 sanitizer 答案；你必须引用自己的 Policy 和 fixture 证据。

## 定向回炉

- Slice 不清：回到列表片段实验，画出 openStart/openEnd。
- 安全错层：重做 Schema、Paste Policy、server validation 三层表。
- IME 证据不足：在真实浏览器录制最小输入序列，不用 jsdom 替代。
- 性能归因不足：把总耗时拆成四段重新采样。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [ProseMirror Reference：EditorProps](https://prosemirror.net/docs/ref/#view.EditorProps)
- [ProseMirror Guide：DOM parsing](https://prosemirror.net/docs/guide/#doc.import_export)
- [Input Events Level 2](https://w3c.github.io/input-events/)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
