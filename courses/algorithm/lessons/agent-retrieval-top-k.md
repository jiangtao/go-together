# Agent 检索：过滤、近邻与 Top K

## 算法映射

检索链路可以拆成三步：先用权限、时间或标签过滤候选；再按距离或相关性排序；最后保留有限的 Top K 证据。堆适合流式 Top K，排序适合候选集小或需要完整顺序，近似近邻索引用更少比较换取召回损失。向量只是距离函数的输入表示，不消除过滤、容量与可观测性问题。

不要把“相似”解释为“正确”。Agent 在引用检索结果前仍应能说明候选来源、截断规则与置信边界。

## 阶梯题组

### 简单恢复

- [#703 数据流中的第 K 大元素](https://leetcode.cn/problems/kth-largest-element-in-a-stream/)（持续 Top K）。

### 经典模板（Hot 100 优先）

- [#347 前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/)（频次过滤与 Top K）。
- [#973 最接近原点的 K 个点](https://leetcode.cn/problems/k-closest-points-to-origin/)（距离排序）。

### 深入迁移

- [#692 前 K 个高频单词](https://leetcode.cn/problems/top-k-frequent-words/)（堆比较器与稳定截断）。

## 限时与复盘

简单恢复 20 分钟，经典模板每题 30 分钟，深入迁移 45 分钟。复盘问题：候选过滤、排序函数和 Top K 截断是否被清楚分层，哪一步可能损失召回？
