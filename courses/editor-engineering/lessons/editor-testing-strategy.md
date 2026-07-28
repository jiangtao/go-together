# Day 16：编辑器测试策略与质量门禁

English title: **Editor Testing Strategy and Quality Gates**

## 学习目标

今天把 15 天的实验组织成风险驱动测试体系。你将区分模型、Command、Plugin、React、真实浏览器、协同和恢复测试，使用不变量、property-based 序列、固定 seed、fixture corpus 与 flaky 预算建立 CI 门禁。

## 背景与问题

编辑器状态空间来自文档结构、selection、输入来源、浏览器、插件顺序、历史、网络和版本组合。只写几个点击 E2E 会慢且难定位；只测纯函数又看不到 IME、focus 和 DOM reconciliation。

测试目标不是堆覆盖率，而是用最便宜且最可靠的层捕获风险。Schema 不变量应在 Node/Transaction 层快速验证；中文输入必须在真实浏览器或人工设备矩阵；网络分区应使用可控 provider/transport，而不是依赖公网。

## 原理机制

测试金字塔按反馈速度与真实度分层：

1. 模型层：Schema 正反 fixtures、Node JSON、Step apply/invert/map 和 migration。
2. 状态层：Command dry run、Transaction、Plugin state、history 序列。
3. 组件层：React 生命周期、toolbar、NodeView、focus 边界。
4. 浏览器层：beforeinput、composition、clipboard、selection、accessibility。
5. 协同层：多 Y.Doc、乱序/重复 updates、provider 状态、恢复与权限。
6. 生产门禁：固定性能夹具、bundle、遥测、安全和部署 smoke。

Property-based 测试生成合法初始文档和操作序列，检查每一步 Node.check、Selection 可解析、undo round-trip、serialization 或副本收敛。失败时必须缩小并保留 seed，才能成为可修复证据。

### 核心术语

- invariant：任何合法执行后都必须成立的性质。
- fixture/corpus：固定输入与明确期望的样本集。
- property-based testing：生成多种输入验证一般性质。
- model-based testing：按状态机生成合法事件并验证转移。
- flaky rate：相同输入重复执行时非确定失败比例。
- test oracle：判断结果是否正确的规则。

## 架构边界与取舍

jsdom 适合许多状态和 React 测试，但不实现完整 layout、Selection、IME 和 clipboard；不要用 mock 通过替代真实浏览器。反之，所有行为都放进 Playwright 会导致慢、脆且难诊断。每个风险选择最低充分层。

协同测试使用内存 transport 控制延迟、乱序和断连，真实 WebSocket 只留少量集成 smoke。性能测试在受控环境运行并使用趋势/预算，不与普通单元测试的随机机器绝对数字混合。

测试代码也遵守安全边界：fixtures 不含真实用户内容，日志使用 digest 和规模，不保存完整 updates/正文。

## 逐步实验：风险到测试矩阵

1. 列出课程最终范围的 P0/P1 风险：丢稿、非法文档、选区错位、undo 错误、越权 room、不收敛、Schema 不兼容等。
2. 为每个风险选择最小测试层、fixture、oracle 和失败证据。
3. 编写至少一个 Schema property、一个随机 Command 序列、一个 history round-trip、一个粘贴 corpus 测试。
4. 建立双 Y.Doc 随机分区测试，失败 seed 可重放。
5. 用 Playwright 覆盖真实 selection/focus/paste；IME 使用受支持的浏览器自动化或明确人工矩阵，不伪造完整 composition。
6. 将关键套件重复运行 20 轮，统计 flaky；故意注入一个竞态，验证测试能稳定发现。

### 观察点

- 每个 test oracle 是结构相等、事件数量、视觉截图还是用户结果？
- Snapshot test 是否掩盖了语义差异？
- property generator 是否只生成简单段落，造成虚假随机性？
- E2E 失败能否降到状态层最小复现？
- 测试并行是否复用 room/database，产生相互污染？

## 产出物

- 风险—测试层—fixture—oracle 矩阵。
- 模型、状态、浏览器、协同各至少一组关键测试。
- 20 轮 flaky 报告与失败 seed 保存规则。
- CI 阶段划分和目标耗时。

## 指标与获取方法

质量指标包括 P0/P1 风险映射率 100%、关键不变量覆盖率 100%、失败 seed 可重放率、20 轮 flaky 为零、真实浏览器矩阵完成率。过程指标包括单元/集成/E2E 各阶段耗时和失败定位时间。Draft CI 初始目标五分钟内完成非性能门禁；性能基准单独运行，避免污染普通 CI。

## 常见失败模式

- 用行覆盖率代表编辑器行为正确。
- Snapshot 变化后一键更新，未审查语义。
- jsdom 模拟 composition 后宣称 IME 已验证。
- 随机测试不记录 seed，失败无法重放。
- E2E 共享同一协同 room，产生顺序依赖。
- 只测 happy path，不注入 storage/network/version 故障。

## 课后任务

选一个现有 E2E，将其中能下沉的断言移到状态层，只保留浏览器真正负责的部分。比较运行时间、失败定位和覆盖风险是否改善。

## 能力项

- **editor-test-layering**：解释各测试层能证明什么、不能证明什么。
- **risk-driven-test-design**：把关键风险映射到最小充分测试与可靠 oracle。
- **quality-gate-verification**：用重复运行、seed、矩阵覆盖和 CI 时间证明门禁。

## 评测提示

评测会给出一个测试方案，要求找出错误层级或虚假 oracle。代码覆盖率数字本身不能作为通过依据。

## 定向回炉

- 层级错配：为失败场景问“最低哪层能复现真正风险”。
- oracle 含糊：把“看起来一样”改成结构/状态/收敛不变量。
- flaky：固定 seed、room、clock 和 transport，逐一取消随机环境。
- IME 伪验证：明确真实浏览器/人工矩阵，不伪造能力。

## 验证命令（按需）

npm run typecheck

npm run lint

npm test

npm run test:e2e

## 资料

- [ProseMirror test-builder](https://github.com/ProseMirror/prosemirror-test-builder)
- [Playwright Test](https://playwright.dev/docs/test-intro)
- [Vitest Guide](https://vitest.dev/guide/)

