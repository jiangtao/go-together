# Day 9：序列化、导入导出与 Schema 迁移

English title: **Serialization, Import/Export, and Schema Migrations**

## 学习目标

今天让文档能跨会话、版本和系统边界生存。你将区分 ProseMirror JSON、HTML、协同二进制 updates 和产品 envelope，设计版本迁移、未知内容降级、round-trip 与回滚证据。

## 背景与问题

能调用 doc.toJSON 不等于拥有稳定存储格式。JSON 中的 type、attrs 和 marks 都依赖当前 Schema；删除节点类型、重命名属性或收紧约束会让旧数据无法 fromJSON。HTML 又可能丢失产品语义或引入不受控结构。

序列化是兼容契约。数据寿命通常长于 UI 组件和依赖版本，因此每次 Schema 改动都必须回答：旧数据如何读、新数据何时写、失败如何回滚、协同文档是否还能加入同一 room。

## 原理机制

ProseMirror Node.toJSON/fromJSON 提供结构化表示；DOMParser.fromSchema 与 DOMSerializer.fromSchema 连接 HTML。产品存储应增加 envelope，至少含 documentId、schemaVersion、content、revision 和必要元数据，避免把文档 JSON 与业务身份混为一体。

Migration 是纯、确定、幂等的版本变换：输入旧 envelope，输出下一版本，逐级执行。它应操作结构化数据而不是字符串替换 HTML，并为不可识别内容定义失败或显式降级策略。

协同阶段的 Y.Doc 二进制 updates 才保留 CRDT 历史。y-prosemirror 官方明确提醒：把协同内容转成 ProseMirror JSON 再还原会丢失协同历史，因此 JSON 可做导入、导出、只读投影或版本展示，但不能替代协同主存储。

### 核心术语

- storage envelope：包裹文档内容与身份、版本、revision 的持久格式。
- schemaVersion：产品文档格式版本，不等同 npm package version。
- migration：确定性的相邻版本变换。
- round-trip：编码再解码后保持约定语义。
- canonicalization：把等价输入规范为稳定输出。
- projection：从主事实源派生的可丢弃表示。

## 架构边界与取舍

编辑器模块负责 Node 与 JSON/DOM 转换；应用存储层负责 envelope、revision 和 durable write；migration 模块负责版本转换；协同存储负责 Yjs updates 与快照。不要让 React 组件在加载时偷偷修补 JSON，也不要让每个 API endpoint 各写一套迁移。

HTML 适合交换与展示，结构化 JSON 适合单机产品存储和测试，Yjs updates 适合协同事实源。选择格式取决于要保留的语义，不存在一个格式同时最适合全部用途。

## 逐步实验：版本矩阵

1. 定义 v1 envelope 和固定 fixtures，包含所有节点、marks、边界嵌套与空文档。
2. 设计 v2：例如 link attrs 增加 normalizedHref，heading level 范围收紧。
3. 编写 v1→v2 纯 migration，并证明重复执行不会再次改变数据。
4. 对 JSON 与 HTML 做 round-trip，先定义允许的规范化差异。
5. 注入未知 node、缺失 attrs、超前 schemaVersion 和损坏 JSON，验证失败语义。
6. 对 1MB/5,000 blocks 固定夹具测量编码、解码、migration 和 DOM parse/serialize。

### 观察点

- fromJSON 的运行时错误是否包含足够诊断但不泄露正文？
- HTML round-trip 是否能保留所有产品 attrs？若不能，是否符合交换契约？
- migration 失败后是否保留原始 durable 数据？
- 同一文档的 canonical JSON 是否稳定，适合 digest 与测试？
- 协同 Y.Doc 转 JSON 再转回为何不能作为主备份？

## 产出物

- Storage Envelope 与 Format Contract。
- v1/v2 fixtures、migration 和版本矩阵。
- JSON/HTML round-trip 差异说明。
- 编码、迁移和解析性能 profile。

## 指标与获取方法

质量指标包括各版本可读率、migration 幂等率、未知版本安全失败率、round-trip 语义相等率和原始数据保留率。性能要分别采样 JSON、HTML 和 migration，不用字符串大小替代节点数；报告 p50/p95 与峰值内存。

## 常见失败模式

- 把 npm 版本当 schemaVersion。
- 原地覆盖旧文档后才发现 migration 失败。
- 用正则替换 JSON 或 HTML 迁移结构。
- 将 HTML 视为完全可信的内部格式。
- 协同文档只保存 ProseMirror JSON，丢失 CRDT 历史。
- 对未知未来版本“尽力解析”，产生静默损坏。

## 课后任务

设计“删除一种已发布 node type”的迁移方案。比较硬失败、降级为 paragraph、保留 unknown wrapper 三种策略，说明用户数据、协同兼容和回滚影响。

## 能力项

- **serialization-mechanism**：解释 JSON、DOM parser/serializer、envelope 与协同 update 的语义差异。
- **migration-contract-design**：设计纯、幂等、逐版本且可回滚的 migration。
- **roundtrip-matrix-verification**：用版本矩阵、故障 fixture 和性能数据证明格式契约。

## 评测提示

评测会给出一次 Schema 变更，要求选择事实源和迁移策略。不会接受“fromJSON 能跑”作为兼容证据。

## 定向回炉

- 格式混淆：重做 JSON、HTML、Yjs updates 用途表。
- 迁移不安全：为原始数据保留、幂等和回滚各补一个测试。
- round-trip 假设不清：先定义语义相等，再比较输出。
- 性能无归因：拆分 encode/decode/migrate/DOM 四段。

## 验证命令（按需）

npm run typecheck

npm test

npm run benchmark

## 资料

- [ProseMirror Guide：Import and export](https://prosemirror.net/docs/guide/#doc.import_export)
- [ProseMirror Reference：Node JSON](https://prosemirror.net/docs/ref/#model.Node.toJSON)
- [y-prosemirror Utilities and persistence warning](https://github.com/yjs/y-prosemirror#utilities)
- [Yjs Document Updates](https://docs.yjs.dev/api/document-updates)

