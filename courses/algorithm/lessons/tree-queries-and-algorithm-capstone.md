# 树上查询与算法综合

## 本节模型

树上查询的核心是让递归返回足够的子树语义。最近公共祖先可以自底向上汇合目标节点；若查询次数很多，则比较一次 DFS、父指针预处理和倍增的时间空间取舍。今天也是经典算法主线的收束：先用约束选择模型，再写不变量和复杂度，最后才落到实现细节。

TypeScript 与 Go 都应避免把节点值误当节点身份；存在重复值时必须根据题目给出的引用或索引建立映射。递归深度过大时，要明确是否改为显式栈。

## 阶梯题组

### 简单恢复

- [#104 二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/)（子树返回值）。
- [#235 二叉搜索树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-search-tree/)（有序树查询）。

### 经典模板（Hot 100 优先）

- [#236 二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/)（向上汇合）。
- [#437 路径总和 III](https://leetcode.cn/problems/path-sum-iii/)（路径状态与前缀摘要）。
- [#1123 最深叶节点的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-deepest-leaves/)（深度与祖先聚合）。
- [#865 具有所有最深节点的最小子树](https://leetcode.cn/problems/smallest-subtree-with-all-the-deepest-nodes/)（子树摘要）。

### 深入迁移

- [#968 监控二叉树](https://leetcode.cn/problems/binary-tree-cameras/)（树形状态决策）。
- [#1483 树节点的第 K 个祖先](https://leetcode.cn/problems/kth-ancestor-of-a-tree-node/)（倍增预处理与多次查询）。
- [#2458 移除子树后的二叉树高度](https://leetcode.cn/problems/height-of-binary-tree-after-subtree-removal-queries/)（预处理与查询分离）。
- [#834 树中距离之和](https://leetcode.cn/problems/sum-of-distances-in-tree/)（换根动态规划）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 30 分钟，深入迁移 55 分钟。复盘问题：递归返回值代表何种子树事实，若查询数量增长，预处理成本何时值得支付？
