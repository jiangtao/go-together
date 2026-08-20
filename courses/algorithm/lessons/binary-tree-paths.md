# 二叉树路径、直径与公共祖先

## 本节模型

树形题常在回溯点完成合并：左右子树已给出足够信息，当前节点再计算本节点的结果。路径题要区分“路径数组”与“全局最优”；路径数组进入子树前写入，离开子树后撤销。公共祖先题则把命中目标视为一种向上返回的信号。

不要把树的高度、路径和、是否平衡混成一个无名数字。返回结构应有明确字段，必要时同时携带多个值。

## 速刷动作

1. 列出左右子树分别贡献什么信息。
2. 明确全局变量何时更新。
3. 对单链树、根即目标、左右各命中一个目标验证。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先比较局部结构，再聚合跨子树路径信息。

### 简单恢复

- [#100 相同的树](https://leetcode.cn/problems/same-tree/)（双子树同步递归）。
- [#112 路径总和](https://leetcode.cn/problems/path-sum/)（根到叶路径基线）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#543 二叉树的直径](https://leetcode.cn/problems/diameter-of-binary-tree/)（高度聚合）。
- Hot 100 优先队列：[#124 二叉树中的最大路径和](https://leetcode.cn/problems/binary-tree-maximum-path-sum/)（负贡献截断）。
- Hot 100 优先队列：[#236 二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/)（目标信号上返）。
- [#257 二叉树的所有路径](https://leetcode.cn/problems/binary-tree-paths/)（路径选择与撤销）。
- [#113 路径总和 II](https://leetcode.cn/problems/path-sum-ii/)（路径收集）。
- [#129 求根节点到叶节点数字之和](https://leetcode.cn/problems/sum-root-to-leaf-numbers/)（路径状态压缩）。
### 深入迁移

- 进阶延伸：[#437 路径总和 III](https://leetcode.cn/problems/path-sum-iii/)（树遍历与前缀状态组合）。
- 进阶延伸：[#687 最长同值路径](https://leetcode.cn/problems/longest-univalue-path/)（向下贡献与全局答案）。

## 交付

为路径题定义返回结构和全局更新时机；说明为什么进入与退出节点都要处理路径数组。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 40 分钟。复盘问题：左右子树返回的信息是否足以让当前节点完成合并？
