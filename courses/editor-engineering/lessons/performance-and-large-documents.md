# Day 17：性能分析与大文档预算

English title: **Performance Analysis and Large-Document Budgets**

## 学习目标

今天用 profile 而不是直觉优化。你将拆解 input-to-paint、Transaction、Plugin、React、DOM、NodeView、Decoration、序列化和协同更新成本，建立固定目标环境与大文档夹具，并完成一次正确性受保护的优化。

## 背景与问题

编辑器性能是交互尾延迟问题。平均 5ms 不能解释偶发 300ms 卡顿；空文档流畅也不能代表 5,000 blocks、长列表、数千 decorations 或多人 updates。开发工具打开、热更新和 Strict Mode 还会扭曲数据。

ProseMirror 会复用未变化 DOM，但插件全文扫描、React 上层重渲染、复杂 NodeView、频繁序列化和 Awareness 广播仍可能让每键成本随文档增长。优化前必须确定时间花在哪一层。

## 原理机制

从用户输入到下一帧可分为：浏览器事件、Transaction 构建、state.apply/plugins、view.updateState/DOM reconciliation、React commit、layout/paint。Performance marks/measures 可记录自有边界；PerformanceObserver 可收集 Long Task 与事件时序；浏览器 Performance panel 用 flame chart、layout、paint 和 heap 定位。

大文档成本与字符数、节点数、树深度、marks 碎片、decorations、NodeViews 和变化范围相关。每个 fixture 要记录这些维度。协同性能还包括 update encode/apply、state-vector diff、网络 bytes、持久化和首次恢复。

### 核心术语

- input-to-paint：用户意图到可见帧的端到端延迟。
- p50/p95：中位与尾部延迟；p95 更能暴露偶发卡顿。
- Long Task：阻塞主线程较长时间的任务观察项。
- flame chart：CPU 调用时间分布。
- layout/paint：样式布局与像素绘制成本。
- heap delta：固定操作前后堆内存变化，用于发现增长趋势。
- performance budget：绑定目标环境、夹具和统计方法的门槛。

## 架构边界与取舍

性能预算必须服务用户场景。课程目标环境由学习者记录，初始建议在 5,000 blocks/100,000 字符夹具中保持 p95 input-to-paint 小于 50ms，并避免超过 200ms 的不可解释 Long Task；这不是通用行业标准，若设备/产品不同必须用 ADR 调整。

不要先做“虚拟化整个 contenteditable”。富文本 selection、DOM mapping、浏览器输入和跨节点操作使通用虚拟化非常复杂。优先减少无关全文扫描、decorations 重建、React commits、NodeView 数量和同步序列化；超大文档需求再评估分页/分块模型。

性能优化不得绕过 Schema、Transaction 或协同事实源。缓存必须有明确 invalidation；worker 只能处理可序列化且不依赖 DOM/EditorState 实例的任务。

## 逐步实验：固定夹具与一次优化

1. 记录硬件、OS、浏览器、生产构建、功耗模式和采样脚本。
2. 建立 small、medium、large 三档文档，large 约 5,000 blocks/100,000 字符，并记录 marks、lists、decorations。
3. 为输入、删除、toggle mark、selection move、粘贴、undo、加载、保存和协同同步分段打点。
4. 每个场景预热后采样至少 30 次，报告 p50/p95、Long Task 和 heap。
5. 用 flame chart 找到一个主要瓶颈，例如字数 Plugin 每键全文扫描或搜索 Decoration 全量重建。
6. 做单一优化，再运行完整正确性套件和相同性能夹具；记录收益、代价与回退条件。

### 观察点

- 开发构建与生产构建差多少？
- transaction 快但下一 paint 慢，瓶颈在哪？
- 节点数相同但 marks 碎片不同，成本是否变化？
- 本地输入流畅但远端 update apply 卡顿，是否共用同一指标？
- 优化降低 p50 却恶化 p95 或 heap，是否接受？

## 产出物

- 可复现 fixture generator 与目标环境说明。
- 各关键路径的分段 baseline 表。
- 一份优化前后 flame chart、指标与正确性回归。
- 性能预算和超限处置规则。

## 指标与获取方法

核心指标：input-to-paint p50/p95、state.apply、view.updateState、React commit、Long Task 次数/最长时长、DOM 节点数、heap delta、load/serialize、Yjs update bytes 与 apply、首次同步/恢复。每项必须写测量边界；不同机器只比较相对趋势，不混入同一绝对门禁。

## 常见失败模式

- 只报平均值和最佳一次。
- 在开发模式、打开 DevTools 或不同功耗下混比。
- 用字符数作为唯一规模指标。
- 优化前没有 flame chart，凭感觉重写架构。
- 缓存没有 invalidation，性能改善但内容错误。
- 为减少延迟绕过 Transaction 或丢弃协同 updates。

## 课后任务

为“10 万 blocks”需求写决策：继续单文档、分页、分块 Y.Doc 或拒绝需求。依据必须包含用户操作、selection 跨页、搜索、协同、存储和预算，不要求实现。

## 能力项

- **editor-performance-model**：解释端到端交互、DOM/React、存储与协同成本。
- **performance-budget-design**：建立绑定目标环境、夹具、统计方法与处置规则的预算。
- **profile-optimization-verification**：用同夹具前后 profile 和正确性回归证明优化。

## 评测提示

评测会审查一份性能报告，要求识别采样偏差和错误归因。只给 Lighthouse 总分或一次截图不能通过。

## 定向回炉

- 边界混合：把输入到 paint 拆成可独立打点阶段。
- 夹具失真：补节点数、深度、marks、decorations 和 update 数。
- 归因不足：从最长 Long Task 进入 flame chart，找首个自有可控调用。
- 优化不可信：恢复原版本，用同脚本 AB 并跑正确性套件。

## 验证命令（按需）

npm test

npm run benchmark

npm run build

## 资料

- [Performance Timeline](https://w3c.github.io/performance-timeline/)
- [Long Tasks API](https://w3c.github.io/longtasks/)
- [Event Timing API](https://w3c.github.io/event-timing/)
- [ProseMirror Guide：Efficient updating](https://prosemirror.net/docs/guide/#view.update)

