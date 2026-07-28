# Day 10：文档 CRUD 与应用领域边界

English title: **Document CRUD and Application Domain Boundaries**

## 学习目标

今天把“编辑一份内容”放回文档产品。你将定义 Document 聚合、稳定身份、列表元数据、内容、生命周期、Repository 与 API，完成 create/read/update/delete/restore，并处理切换文档时的未保存状态。

## 背景与问题

EditorState 只描述当前编辑会话，不能承担文档列表、标题唯一性、权限、删除、版本和保存确认。若把 documentId 放进 Plugin、把列表缓存混进 Schema attrs，编辑核心会被业务生命周期污染。

反过来，应用层也不应通过 innerHTML 理解编辑内容。它接收版本化 envelope，管理身份和持久性；编辑器模块负责内容结构及变换。两者通过明确契约连接。

## 原理机制

Document 聚合至少包含 documentId、title、contentRef/content envelope、revision、createdAt、updatedAt、deletedAt 和 owner/authorization context。ID 在重命名、版本和同步中保持稳定；title 是可变属性，不能作为身份。

CRUD 不只是四个 HTTP 动词。Create 要定义幂等或重复提交行为；Read 要区分不存在、已删除和无权限；Update 要带 revision 或条件；Delete 最好先软删除并使活动编辑会话进入只读/关闭；Restore 要处理名称与权限变化。

Repository 隔离存储实现，Application Service 执行业务规则，HTTP adapter 负责协议转换。React 页面通过明确的 query/command 状态管理文档列表，不把网络对象直接塞入 EditorState。

### 核心术语

- aggregate：围绕一致性边界组织的数据与规则。
- stable identity：不随标题、路径或内容变化的 ID。
- soft delete/tombstone：保留删除事实以支持恢复和同步。
- optimistic UI：服务端确认前先显示预期结果，并有失败补偿。
- repository contract：领域层使用的持久化抽象。
- idempotency key：重复请求仍只产生一次业务效果的标识。

## 架构边界与取舍

内容标题可放在文档元数据，也可作为正文首个 heading，但只能选一个权威来源；双向同步会产生循环和冲突。课程默认 title 属于 Document 元数据，正文独立。

列表接口返回摘要，不加载所有富文本正文。读取文档时再取内容/协同 room。软删除提高恢复能力，但需要明确保留期和权限；课程实现恢复接口，不建设完整回收站治理。

单机阶段的 Update 接收版本化 ProseMirror JSON；进入协同后，内容事实源转为 Yjs updates，CRUD 仍管理文档身份与 room 元数据。API 不能假定内容存储永远是 JSON。

## 逐步实验：文档中心纵向切片

1. 写出 Document 生命周期：active → deleted → restored，定义非法转移。
2. 定义 API contract，包含成功和 not-found/forbidden/conflict/validation 失败语义。
3. 实现 in-memory Repository 与同一套 contract tests，再接一个 durable adapter。
4. 在 React 中实现列表、创建、打开、重命名、软删除和恢复。
5. 编辑后立即切换文档，验证保存中、失败和放弃修改三条路径。
6. 生成 1,000 份元数据，测量列表查询、渲染和切换，不加载正文。

### 观察点

- 重复点击 Create 是否产生多份文档？
- 无权限与不存在是否应该向客户端暴露相同信息？
- 删除中的文档仍有活动协同连接时怎么办？
- 切换文档是更新同一 EditorState，还是销毁并创建新会话？
- Repository tests 是否真的可以复用于不同 adapter？

## 产出物

- Document 领域模型与生命周期图。
- CRUD API、Repository contract 和失败语义表。
- 文档中心纵向切片与 contract tests。
- 1,000 文档列表/切换 profile。

## 指标与获取方法

质量指标包括生命周期转移覆盖、重复请求幂等、错误分类、软删除不可编辑和 Repository adapter parity。性能分离服务查询、网络模拟、React 列表渲染与 EditorView 切换；记录 p50/p95，并确认列表 payload 不随正文总量增长。

## 常见失败模式

- 以 title 或 URL slug 作为文档身份。
- 列表接口携带全部正文，放大启动成本和数据暴露。
- Delete 直接物理删除，离线客户端重连后又“复活”文档。
- 切换文档时重用旧 history/plugin/provider。
- API 把所有错误统一成 500，客户端无法恢复。

## 课后任务

为“复制文档”写契约：新 identity、内容版本、协同历史、权限和引用怎样处理？说明是复制当前投影还是完整历史，暂不实现。

## 能力项

- **document-domain-model**：区分 Document 聚合、EditorState、正文与列表摘要。
- **crud-api-contract**：设计稳定身份、生命周期、幂等和失败语义。
- **crud-state-verification**：用状态机、adapter contract tests 和列表 profile 验证。

## 评测提示

评测会给出“切换时仍在保存”或“删除时仍在线”的场景，要求按状态和所有权回答。只完成 HTTP 路由不代表能力达标。

## 定向回炉

- 身份混淆：把 ID、title、revision、roomId 分别标注生命周期。
- CRUD 缺失败语义：为每个操作补 conflict/forbidden/not-found。
- 切换泄漏：记录旧 View、Plugin、Provider 的销毁证据。
- 性能无边界：拆分查询、payload、列表 render、编辑会话创建。

## 验证命令（按需）

npm run typecheck

npm test

npm run test:e2e

npm run benchmark

## 资料

- [HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [ProseMirror Guide：Data flow](https://prosemirror.net/docs/guide/#view.data_flow)
- [Yjs FAQ：Structuring data in smaller YDocs](https://docs.yjs.dev/api/faq)

