# 位掩码、状态压缩与子集搜索

## 本节模型

当元素数量很小、集合关系很多时，把已选择元素写成一个整数位集合，能让状态数组、哈希和转移都变得直接。关键不是会写 `1 << i`，而是先估算 `2^n` 是否可接受，并明确每一位代表什么。状态压缩可与 DP、BFS 或回溯结合，但不能消除本来就过大的状态空间。

在 TypeScript 中位运算是 32 位有符号整数；超过该边界需改用 `bigint` 或其他表示。Go 的 `uint64` 同样有明确位数上限。

## 阶梯题组

### 简单恢复

- [#191 位 1 的个数](https://leetcode.cn/problems/number-of-1-bits/)（位状态观察）。

### 经典模板（Hot 100 优先）

- [#78 子集](https://leetcode.cn/problems/subsets/)（枚举位集合）。
- [#698 划分为 k 个相等的子集](https://leetcode.cn/problems/partition-to-k-equal-sum-subsets/)（状态与剪枝）。

### 深入迁移

- [#847 访问所有节点的最短路径](https://leetcode.cn/problems/shortest-path-visiting-all-nodes/)（图搜索与掩码状态）。

## 限时与复盘

简单恢复 10 分钟，经典模板每题 35 分钟，深入迁移 60 分钟。复盘问题：一位的语义与状态数组下标是否一致，`2^n` 规模在目标语言中是否仍可承受？
