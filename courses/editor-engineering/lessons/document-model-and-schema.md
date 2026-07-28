# Day 2：结构化文档模型与 Schema

English title: **Structured Documents and Schema Design**

## 学习目标

今天把“页面长什么样”转成“哪些语义结构可以存在”。你要能从产品约束推导 NodeSpec、MarkSpec 和 content expression，解释 Node、Fragment 与 Slice 的不同，并用正反 fixtures 证明 Schema 的边界。

## 背景与问题

HTML 能表达非常多结构，但产品通常只允许其中一小部分。如果持久化任意 HTML，样式、脚本、浏览器纠错节点和历史遗留标签会进入数据层。后续搜索、迁移、协同和渲染都必须处理不可控组合。

结构化文档将“允许什么”变成可执行契约。代价是每个新节点都会带来命令、粘贴、序列化、迁移、协同和测试责任，因此 Schema 不是功能清单，而是长期数据模型。

## 原理机制

ProseMirror Document 是不可变 Node 树。Node 可以包含 Fragment；文本也是 Node。Schema 用 NodeSpec 和 MarkSpec 注册类型，并通过 content expression 约束子节点，例如块容器只能含一个或多个 block，paragraph 只能含 inline。marks 附着在行内内容上，不应滥用为块结构。

Slice 表示可插入的开放片段。复制半个段落时，片段的外层结构并不完整，openStart/openEnd 描述两端开放深度，插入算法据此寻找能与目标结构拼接的位置。理解 Slice 是解释复杂粘贴和 replace 的前提。

### 核心术语

- NodeType/MarkType：由 Schema 产生的类型对象。
- NodeSpec/MarkSpec：类型声明，包括 content、group、attrs、parseDOM 和 toDOM。
- content expression：合法子内容的语法约束。
- Fragment：有序子节点序列。
- Slice：带开放深度的文档片段。
- atom/isolating/defining：影响选择、替换和结构行为的重要节点语义。

## 架构边界与取舍

Schema 负责结构合法性，不负责所有业务规则。标题长度、权限、资源是否存在等可能需要 Command、应用服务或服务端验证。若把易变业务规则硬编码进 Schema，旧文档可能突然无法加载；若 Schema 过松，又会把无效组合扩散到每一层。

本课程的最小范围包含 doc、paragraph、heading、blockquote、ordered_list、bullet_list、list_item、code_block、text，以及 strong、em、code、link。图片、表格、mention 和嵌套页面不是初始范围；它们可作为后续 ADR，而不是今天预留万能节点。

链接 href 不因为 Schema 接受字符串就自动安全。解析与渲染还要执行协议 allowlist，服务端也不得信任客户端 JSON。

## 逐步实验：从产品规则推导 Schema

1. 写出十条产品不变量，例如文档至少有一个 textblock、list_item 必须含 paragraph、code_block 不允许 marks。
2. 为每条不变量标注执行层：Schema、Command、输入转换、应用层或服务端。
3. 实现最小 Schema，并为每种节点定义可预测的 parseDOM/toDOM。
4. 创建至少 6 个合法 JSON fixtures 和 6 个非法 fixtures；非法项要说明违反哪条不变量。
5. 对 100KB 固定文档执行 fromJSON、toJSON、DOM parse/serialize，多次采样建立基线。

### 观察点

- Node.check 或创建 API 在何时发现非法结构？
- parseDOM 的优先级和 getAttrs 会不会接受超出预期的 HTML？
- 相同视觉效果能否由不同语义树产生？你选择哪一种，为什么？
- 新增属性时，旧 JSON 缺失该属性如何处理？
- 列表包裹、提升和合并需要哪些结构前提？

## 产出物

- Schema ADR：范围、非目标、不变量和演进策略。
- 节点/mark 表：语义、允许位置、属性、DOM 映射和安全要求。
- 正反 fixtures 与 round-trip 测试。

## 指标与获取方法

质量指标包括非法 fixtures 拒绝率、合法 fixtures round-trip 成功率和不变量覆盖表。性能指标使用相同 JSON/HTML 夹具分别测量解析与序列化，先预热，再记录至少 20 次 p50/p95；同时记录文档节点数而不只记录字节数，因为深度和节点碎片会改变成本。

## 常见失败模式

- 用一个 attrs 巨大的 generic block 逃避 Schema 设计。
- 把视觉样式当语义节点，导致同义结构碎片化。
- parseDOM 过于宽松，把未知标签和危险 URL 带入文档。
- 修改 Schema 后只测新文档，不加载旧 fixtures。
- 认为 TypeScript 类型能替代运行时 Schema 验证。

## 课后任务

新增一个产品需求“引用块可以包含多个段落但不能嵌套引用”。先写 ADR 和正反 fixtures，再修改 Schema。记录对命令、粘贴、序列化和迁移的影响，不必实现全部后续功能。

## 能力项

- **structured-document-model**：解释 Node、Fragment、Slice、NodeSpec、MarkSpec 和 content expression。
- **schema-boundary-design**：把产品不变量放到正确层，并保持初始 Schema 最小。
- **schema-fixture-verification**：用正反 fixtures、round-trip 和解析基线验证设计。

## 评测提示

评测可能给出一个看似合法但违反嵌套规则的 JSON，要求定位应由哪一层拒绝。只展示编辑器画面不能证明 Schema 正确。

## 定向回炉

- 模型混淆：回看“原理机制”，手画 Node/Fragment/Slice 关系。
- 约束错层：回做不变量执行层表。
- 验证不足：为每个 NodeSpec 至少补一正一反 fixture。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [ProseMirror Guide：Document](https://prosemirror.net/docs/guide/#doc)
- [ProseMirror Reference：model](https://prosemirror.net/docs/ref/#model)
- [ProseMirror Schema from scratch](https://prosemirror.net/examples/schema/)

