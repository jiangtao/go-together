# 动态规划：状态、转移与初始化

## 本节模型

动态规划要求可复用的子问题。先从暴力递归找状态，再写出状态含义、转移、初始化和遍历顺序。状态定义必须完整：如果未来决策还依赖某个历史信息，它就不能被省略。空间压缩只有在当前状态不会覆盖未来所需旧状态时才成立。

在 TypeScript 中用数组前先填充默认值以避免稀疏数组误读；Go 切片的零值是否就是合法初始状态，也必须显式判断。

## 速刷动作

1. 用一句话定义 `dp[i]` 或 `dp[i][j]`。
2. 先写最小规模输入的初始状态。
3. 用两个相邻状态手算一次转移。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先手算线性递推，再引入容量和二分优化。

### 简单恢复

- [#509 斐波那契数](https://leetcode.cn/problems/fibonacci-number/)（最小递推）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#70 爬楼梯](https://leetcode.cn/problems/climbing-stairs/)（线性递推）。
- Hot 100 优先队列：[#198 打家劫舍](https://leetcode.cn/problems/house-robber/)（相邻互斥）。
- Hot 100 优先队列：[#322 零钱兑换](https://leetcode.cn/problems/coin-change/)（最优化状态）。
- Hot 100 优先队列：[#300 最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence/)（状态与二分优化）。
### 深入迁移

- 进阶延伸：[#416 分割等和子集](https://leetcode.cn/problems/partition-equal-subset-sum/)（容量状态与遍历方向）。

## 交付

选择一个一维 DP，写下状态含义、初始化、转移和遍历方向，再证明一维压缩没有覆盖旧依赖。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 40 分钟。复盘问题：我的状态是否遗漏了未来转移仍需要的历史信息？
