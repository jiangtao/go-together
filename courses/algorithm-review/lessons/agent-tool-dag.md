# Agent 工具编排：DAG 与关键路径

## 算法映射

多工具任务不是按自然语言顺序执行，而是一个依赖图：节点是可重试的工作单元，边表示数据或副作用前置条件。拓扑排序给出合法执行序；若不存在完整序，则依赖图有环，系统必须报告而非无限重试。关键路径将并行图中的最长代价链暴露出来，帮助先优化真正拖慢任务的步骤。

幂等键、超时和失败传播不改变 DAG 的基本算法，但它们定义了节点能否安全重试。TypeScript 可用显式依赖表；Go 可用结构体和 `context` 传播取消信号，二者都不应隐式依赖调用顺序。

## 阶梯题组

### 简单恢复

- [#1971 寻找图中是否存在路径](https://leetcode.cn/problems/find-if-path-exists-in-graph/)（图的可达性）。

### 经典模板（Hot 100 优先）

- [#207 课程表](https://leetcode.cn/problems/course-schedule/)（依赖环检测）。
- [#210 课程表 II](https://leetcode.cn/problems/course-schedule-ii/)（拓扑执行序）。

### 深入迁移

- [#1203 项目管理](https://leetcode.cn/problems/sort-items-by-groups-respecting-dependencies/)（分组依赖与双层拓扑）。

## 限时与复盘

简单恢复 20 分钟，经典模板每题 30 分钟，深入迁移 55 分钟。复盘问题：边是否表示真实的前置条件，遇到环和失败时系统是否有明确且有限的路径？
