# Day 19：独立架构设计与技术决策

English title: **Independent Architecture Design and Technical Decisions**

## 学习目标

今天不新增 API。你将面对一份带冲突约束的产品需求，独立完成范围、文档不变量、模块边界、数据事实源、协同、离线、指标和发布决策。课程只给问题与评审标准，不给参考架构。

## 背景与问题

前 18 天按主题拆解了编辑器。真实工作不会告诉你“今天该用 Plugin，明天该用 Yjs”；需求通常把 UI、数据、权限、性能和时间压在一起。独立能力体现在能否识别哪些约束属于 Schema、Command、应用、服务端或运维，并拒绝互相矛盾的假设。

## 综合设计题

为一个小团队知识库设计编辑器：

- 支持课程范围内的 blocks/marks、快捷键和粘贴。
- 文档可创建、重命名、软删除、恢复并保留版本。
- 最多 20 人同时编辑，另有 80 人只读观看。
- 用户可离线 24 小时后重连；服务端可能短暂不可用。
- 文档目标规模 5,000 blocks，偶尔达到 100,000 字符。
- 新 Schema 能力需要灰度，旧客户端可能仍在线。
- 文档内容敏感，遥测不得采集正文；room 必须服务端授权。
- 团队只有普通 TypeScript/React 经验，不维护自研 CRDT。

这不是实现清单。你必须先提出仍缺失的问题，并明确无法同时满足的目标或需要产品确认的风险。

## 原理机制的综合使用

设计至少要连接这些机制：Schema 不变量决定内容边界；Transaction/Command/Plugin 决定本地变化；React/NodeView 决定 UI 所有权；Document 聚合与 revision 决定元数据；Y.Doc/y-prosemirror/provider 决定正文协同；y-indexeddb 与 update storage 决定离线恢复；test/performance/telemetry 决定上线证据。

任何机制都不能只写名称。每条决策要说明输入、输出、所有者、失败状态、验证方法和替代方案。

### 核心术语

- requirement/invariant：可协商需求与不可破坏性质。
- context boundary：模块或系统对状态与行为负责的边界。
- source of truth/projection：权威数据与可再生表示。
- ADR：记录背景、决策、替代、后果和触发复审条件。
- failure budget：系统允许的故障量及超过后的行动。
- rollout invariant：新旧版本共存时仍必须成立的约束。

## 架构边界与取舍方法

先从用户场景写不变量，再选择机制；不要从“我想用 Yjs”反推需求。每个外部库同时列出它解决与不解决的问题。把产品元数据与正文协同分开时，要解释一致性体验；把它们放入同一 Y.Doc 时，要解释权限、列表加载和生命周期成本。

性能预算必须绑定目标设备与夹具；可靠性必须有故障注入；安全必须在服务端执行。任何声称“自动”“实时”“不会丢”的地方都要有确认条件。

## 逐步实验：无参考答案设计评审

1. 写至少 10 个澄清问题，并按“阻断/可假设/可延后”分类。
2. 定义最终范围、非目标和 8–12 条系统不变量。
3. 画 context、数据流和部署图，标出同步/异步、durable/ephemeral。
4. 完成至少三份 ADR：编辑器内核、协同/持久化、Schema rollout；可再增加文档元数据边界。
5. 为 P0/P1 风险建立 threat/failure model 与测试矩阵。
6. 定义质量、性能、可靠性、收敛、安全和运维预算，并写获取方法。
7. 进行 20 分钟自我反方评审：逐条尝试推翻自己的决定。

### 观察点

- 是否出现两个可写正文事实源？
- offline、remote durable 与 UI“已同步”是否混用？
- 旧客户端遇到新节点会发生什么？
- 只读观众是否真的需要完整 Awareness？
- 文档删除、权限撤销与离线缓存是否有闭环？
- 每个预算是否能在 Day 20 自动或半自动验证？

## 产出物

- 中文优先、含英文摘要的架构设计文档。
- Context/data/deployment diagrams。
- 至少三份 ADR 和 rejected alternatives。
- 风险矩阵、指标表与 Day 20 验证计划。

## 指标与获取方法

本日过程指标是决策可追溯率：每个 P0/P1 需求必须映射到不变量、组件、验证和运行信号。质量以 rubric 审查，达到 80% 只是进入实现的必要条件，任何事实源冲突、越权风险或不可恢复写入都是单项阻断。性能指标不实际跑数，但每项必须写环境、夹具、采样和门槛来源。

## 常见失败模式

- 画了技术组件图，却没有用户场景和失败路径。
- 把 ProseMirror、Yjs、provider 能力混为一体。
- 写“支持离线”但没有 local durable 与重连状态机。
- 安全只写“需要鉴权”，没有 room/Document 执行点。
- 指标只有目标数字，没有环境和采样方法。
- ADR 只有最终选择，没有替代与后果。

## 课后任务

邀请另一位工程师只阅读你的文档，不看实现，让其指出三个无法回答的问题。记录问题和设计修订；如果无人可评审，用故障清单逐条进行书面反方评审。

## 能力项

- **requirements-to-invariants**：从新需求独立推导范围、非目标和系统不变量。
- **architecture-decision-quality**：用 ADR 解释模块、数据、协同、部署和替代方案。
- **verification-plan-quality**：把风险映射到质量、性能、可靠性、安全和运行验证。

## 评测提示

评测只检查设计证据与答辩，不提供参考架构。每次只追问一个决策的背景、替代、失败与验证；组件数量和图的美观不计分。

## 定向回炉

- 需求到不变量断裂：回炉 Day 0、2、10，重新写事实源与生命周期。
- 协同边界错误：回炉 Day 13–15，重画 update 与 provider 路径。
- 质量计划空泛：回炉 Day 16–18，为每个 P0 风险补 oracle 与运行信号。
- 性能预算伪精确：回炉 Day 17，绑定环境、夹具和统计方法。

## 验证命令（按需）

npm run typecheck

npm run lint

## 资料

- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)

