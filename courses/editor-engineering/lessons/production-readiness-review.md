# Day 21：生产就绪验收与能力答辩

English title: **Production Readiness Review and Engineering Defense**

## 学习目标

今天回答最终问题：这个编辑器是“能演示”、 “可用”，还是“可运行并可发布”？你将完成范围验收、未知故障诊断、恢复/回滚、证据审计和架构答辩，并把未达标项精确路由回对应 Lesson。

## 背景与问题

发布决策不是测试全绿的自动结果。测试可能遗漏真实风险，指标可能来自错误环境，runbook 可能没有演练，Schema rollback 可能不可逆。生产就绪要求工程师能解释系统承诺、证据边界和剩余风险，并在未知故障中保持数据优先。

本课程的 Draft 完成与学习者作品发布是两件事。Day 21 只验收学习能力和 release candidate，不会修改 Course lifecycle，也不会自动部署生产。

## 原理机制：从证据到发布判断

Production readiness 是一组相互制约的门禁：产品范围证明“做了什么”，不变量和测试证明“在已知条件下正确”，性能与可靠性证明“在目标负载和故障下仍可用”，安全与运维证明“出问题时能发现、限制影响并恢复”。Go/no-go 是这些证据的决策结果，不是个人信心或功能投票。

证据必须来自冻结的同一 release candidate，并能追溯到环境、fixture、revision 与执行时间。任何后续代码或配置变化都会使相关证据过期，需要按影响范围重验。Residual risk 只有在影响、概率、监控、owner、期限和回滚都明确时才能被接受。

## 验收层级

### 1. 产品范围

验证结构化 blocks/marks、工具栏/快捷键、selection、IME/paste、undo/redo、CRUD、保存版本、协同光标/内容、离线恢复。每项同时检查用户结果与底层不变量。

### 2. 工程质量

审计 Schema/version、Transaction 单一入口、React 生命周期、事实源、contract/property/E2E、性能预算、隐私遥测、权限与依赖锁定。没有证据的功能按未验证处理。

### 3. 运行能力

执行断网、乱序/重复、storage failure、provider 403、服务重启、Schema mismatch、错误告警、kill switch 与 rollback。优先保护 durable data，再恢复功能。

### 4. 独立解释

随机选择一项 ADR，说明背景、替代、代价、失败信号和复审条件；随机选择一个指标，现场解释采样、p95 和噪声；随机选择一个失败 seed，说明定位过程。

## 核心术语

- release readiness：范围、质量、运行和恢复证据达到发布门槛。
- P0/P1：会造成数据丢失、越权、不可用或核心体验破坏的优先风险。
- go/no-go：基于明确门槛的发布决定。
- rollback/roll-forward：恢复旧版本或通过向前修复恢复服务。
- residual risk：已知但尚未消除、被明确接受的风险。
- evidence index：把主张链接到测试、profile、runbook 与 ADR 的索引。

## 架构边界与取舍

“没有已知 bug”不是 go 标准，“有少量非关键 bug”也不必然 no-go。任何静默丢稿、越权 room、不可恢复 Schema 写入、协同不收敛或关键指标无来源都是阻断。视觉瑕疵可在影响、监控和回滚明确后作为 residual risk。

未知故障诊断遵循：保护数据 → 固定范围与时间线 → 收集脱敏事实 → 最小复现 → 定位层级 → 选择 kill switch/rollback/forward fix → 验证恢复。不得先清数据库、清本地缓存或重置文档来让演示恢复。

## 逐步实验：最终评审

1. 冻结 release candidate、依赖锁与测试夹具，记录 revision。
2. 按范围表逐项演示，链接自动证据；人工观察与自动 oracle 分开。
3. 由评测者注入一个未知故障，学习者只获得用户症状与允许的脱敏信号。
4. 执行一次断网恢复、一次服务重启恢复和一次 Schema/feature 回滚。
5. 审计 telemetry 字段、room 权限、paste/link 安全和本地缓存退出策略。
6. 在冻结环境运行性能/收敛基准，比较门槛而非历史最佳值。
7. 完成 30 分钟架构与指标答辩。
8. 作出 go/no-go，列 residual risks、owner、deadline 和复验入口。

### 观察点

- 功能演示是否与自动证据使用同一 build？
- 故障诊断是否先保护 durable data？
- 回滚后新 Schema 数据是否仍可读？
- 收敛、同步完成和 remote durable 是否被准确区分？
- no-go 时能否精确指出阻断能力，而不是笼统“还要优化”？

## 产出物

- 中文优先、含英文摘要的 README：范围、架构、运行、验证、限制。
- Production Readiness Report 与 go/no-go 结论。
- Evidence index、故障诊断记录、恢复/回滚证据。
- Residual risk 与技术债 backlog。
- 对应 Lesson 的定向回炉列表。

## 指标与获取方法

最终门禁：全部 Manifest 能力项至少达到 3；P0/P1 未关闭项为零；关键测试 20 轮零 flaky；固定 seed 收敛率 100%；无静默丢 durable update；越权访问全部拒绝；Day 17 预算在冻结环境通过；告警、kill switch 与 rollback 演练成功。任何指标必须能追溯到原始脱敏证据与采样方法。

## 常见失败模式

- 用演示视频代替可重放证据。
- 未知故障一开始就清缓存/重建文档，掩盖数据问题。
- 只会说技术选择优点，无法解释替代与代价。
- no-go 原因没有 owner、复验和回炉入口。
- README 宣称超出实际范围的安全、离线或协同能力。
- 把课程 Draft 误当已发布课程或生产批准。

## 课后任务

把评审中所有未达标项按 competencyId 排序。每次只回炉一个能力项，重做最小证据并重新评测；不要继续添加新功能。全部达标后，学习者作品是否部署由独立产品发布流程决定。

## 能力项

- **product-scope-acceptance**：证明最终编辑器满足范围，并诚实遵守非目标。
- **production-diagnosis-recovery**：独立完成未知故障的保护、定位、恢复与回滚。
- **engineering-defense**：用架构、质量、性能、协同、安全和运行证据完成答辩。

## 评测提示

评测不提供故障答案、实现建议或 go/no-go 结论。每次只评一个能力项；任何 P0/P1 证据缺口都进入定向回炉，不能用总分抵消。

## 定向回炉

- 功能/模型：Day 2–9 对应 competencyId。
- CRUD/可靠性：Day 10–12。
- 协同/收敛：Day 13–15。
- 测试/性能/运行：Day 16–18。
- 架构论证：Day 19；综合实现：Day 20。

## 验证命令（按需）

npm run typecheck

npm run lint

npm test

npm run test:e2e

npm run benchmark

npm run build

## 资料

- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)
