# Day 20：独立综合实现与故障注入

English title: **Independent Integration Build and Fault Injection**

## 学习目标

今天按 Day 19 的设计独立完成 release candidate。课程不再逐 API 指导；你要证明结构化编辑、CRUD、保存、协同、离线、测试和性能由同一组边界一致支撑，而不是把演示功能临时拼在一起。

## 背景与问题

综合实现最容易出现“局部都对、连接处丢数据”：EditorView 切换后旧 provider 仍在线；JSON autosave 与 Y.Doc 双写；删除文档但 IndexedDB 仍可恢复；feature flag 隐藏新节点却不能读取；测试使用和生产不同的数据路径。

本日重点不是代码量，而是 tracer-bullet：从用户输入一直穿过 Transaction、Y.Doc、local persistence、provider、server durable storage，再回到另一个客户端和可观测信号。每个关键状态都应有证据。

## 实现契约

Release candidate 必须在课程范围内完成：

- 结构化 blocks/marks、工具栏、快捷键、selection、IME/paste 和 undo/redo。
- 文档列表、create/read/rename/soft-delete/restore。
- 明确的 local/durable/synced 状态，不静默丢写。
- Yjs + y-prosemirror 内容同步、Awareness 远端光标、本地意图 undo。
- y-indexeddb 或等价成熟 provider 的离线恢复；服务端 update 持久化策略。
- Schema/version 门禁、受限输入、服务端 room 授权。
- 风险驱动测试、固定性能夹具、脱敏 telemetry 和部署配置。

允许使用官方库、成熟 provider 和基础脚手架；禁止手写 ProseMirror 核心、CRDT、通用 HTML sanitizer 或把课程示例整体复制成答案。

## 原理机制的集成检查

Transaction 是本地编辑入口；Y.Doc 是协同正文事实源；Document service 管理身份、元数据和权限；IndexedDB/remote storage 各自给出明确 durable 状态；Awareness 只表达临时 presence；React 不拥有 contentDOM；telemetry 只记录规模、版本、状态和耗时。

如果实现偏离 Day 19 ADR，必须先更新 ADR，说明新证据，而不是让文档失真。若发现设计错误，减少功能范围也比增加旁路更符合课程目标。

### 核心术语

- tracer bullet：先贯通最薄端到端路径，用真实接口暴露集成风险。
- release candidate：功能冻结、依赖和证据可复现的候选版本。
- fault injection：主动制造网络、存储、权限或版本故障以验证恢复。
- boundary integrity：实现仍遵守设计中的状态所有权与依赖方向。
- evidence index：从验收主张指向测试、profile、ADR 和 runbook 的索引。

## 架构边界与取舍

综合阶段允许删减非核心功能，不允许通过双写、绕过 Transaction、关闭权限或跳过持久化来换取演示成功。若成熟 provider 与自建服务边界冲突，优先保持明确事实源和可恢复路径，再记录能力缺口；若性能预算与可靠性检查冲突，先保护数据和正确性，再通过 profile 缩小瓶颈。

Release candidate 的前端、provider 和 storage adapter 必须能独立替换，但替换点不能改变文档语义。测试 adapter 可以控制故障，生产 adapter 负责真实 durable contract；二者共享 contract tests，而不是共享内部实现。

## 逐步实验：实现与证据闭环

1. 先跑最薄路径：创建文档 → 输入 → 本地 durable → 第二客户端同步 → 刷新恢复。
2. 增加 Schema、Commands、history、paste 和 React UI，每加入一层运行对应测试。
3. 接入 CRUD/权限，验证删除、恢复、切换时 View/provider/storage 生命周期。
4. 接入 Yjs provider/Awareness/y-indexeddb，移除单机 JSON 主写路径。
5. 建立服务端 update durable acknowledgement 与重启恢复。
6. 执行故障矩阵：断网、乱序、重复、刷新、storage failure、403、Schema mismatch、服务重启。
7. 在 production build 跑 small/medium/large 性能夹具与安全 smoke。
8. 生成 release candidate 证据索引，不包含正文、密钥或真实身份。

### 观察点

- 每个 document switch 是否销毁旧 View、provider、Awareness 和 listener？
- UI“已同步”由哪个 durable acknowledgement 驱动？
- 断网 24 小时的积压是否可恢复且不会阻塞首次可编辑？
- 删除/撤权后本地缓存和重连如何处理？
- 所有测试是否经过与生产相同的 binding 和 storage path？
- 性能超限时是否按预算降级，而不是删除可靠性检查？

## 产出物

- Release candidate 与可复现启动说明。
- 需求—不变量—实现—测试—指标追踪表。
- 故障注入报告、失败 seed 与恢复证据。
- production build 性能、安全和 bundle 报告。
- 未完成项与明确风险，不得伪装通过。

## 指标与获取方法

质量要求 P0/P1 contract/E2E 全部通过，关键 property tests 可重放，重复 20 轮零 flaky。协同要求随机分区最终收敛，重复 updates 无副作用；可靠性要求刷新/断网/重启无静默丢 durable update；性能执行 Day 17 同环境预算；安全要求越权 room、危险 paste/link 和敏感 telemetry tests 通过。

## 常见失败模式

- 为赶进度恢复 JSON/Y.Doc 双写。
- 只做两个窗口演示，不执行随机分区和服务重启。
- 把未实现权限写成“生产再做”。
- 性能测试运行开发构建或换了夹具。
- 失败后改测试 oracle，而不是修边界。
- Release evidence 含真实正文、token 或 provider URL 密钥。

## 课后任务

冻结功能。只根据失败证据修 P0/P1，记录每次修复影响的不变量、测试和指标。新增“好看但非验收”的功能视为范围漂移。

## 能力项

- **independent-editor-implementation**：无逐步答案独立实现课程范围内的可用编辑器。
- **integration-boundary-integrity**：保持编辑、React、Document、Y.Doc、storage 与 provider 事实源一致。
- **fault-performance-evidence**：用自动测试、故障注入、收敛、安全和性能证据证明实现。

## 评测提示

评测不会修代码或提供实现。它会从一个失败 seed、状态机或性能报告追问证据；任何 P0 单项缺失都不能由其他功能抵消。

## 定向回炉

- 编辑核心失败：回炉 Day 2–9 对应能力项。
- CRUD/保存/离线失败：回炉 Day 10–12，先恢复单一事实源。
- 协同/undo/收敛失败：回炉 Day 13–15，最小化 seed。
- 测试/性能/安全失败：回炉 Day 16–18，重建 oracle 或预算证据。

## 验证命令（按需）

npm run typecheck

npm run lint

npm test

npm run test:e2e

npm run benchmark

npm run build

## 资料

- [ProseMirror Examples](https://prosemirror.net/examples/)
- [Yjs Collaborative Editor](https://docs.yjs.dev/getting-started/a-collaborative-editor)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)
