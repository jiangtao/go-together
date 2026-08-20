# 序列、区间与树形动态规划

## 本节模型

双序列 DP 的二维坐标通常表示两个前缀；区间 DP 的坐标表示一个闭区间，遍历必须保证小区间先于大区间；树形 DP 则让每个节点返回父节点所需的信息。三类题都先定义状态，再由依赖关系反推遍历顺序。

不要为了省空间而把二维状态压成一维，除非能证明更新方向不会破坏仍需读取的上一轮状态。区间问题尤应先画出长度递增的填表顺序。

## 速刷动作

1. 画出状态表和箭头方向。
2. 标出基础行、基础列或长度为一的区间。
3. 树形 DP 写出子节点返回结构。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先比较单一序列关系，再扩展到二维、树和区间状态。

### 简单恢复

- [#392 判断子序列](https://leetcode.cn/problems/is-subsequence/)（序列关系）。
- [#647 回文子串](https://leetcode.cn/problems/palindromic-substrings/)（区间扩展基线）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#1143 最长公共子序列](https://leetcode.cn/problems/longest-common-subsequence/)（双序列状态）。
- Hot 100 优先队列：[#72 编辑距离](https://leetcode.cn/problems/edit-distance/)（操作转移）。
- Hot 100 优先队列：[#337 打家劫舍 III](https://leetcode.cn/problems/house-robber-iii/)（树形状态）。
- [#516 最长回文子序列](https://leetcode.cn/problems/longest-palindromic-subsequence/)（区间状态）。
- [#96 不同的二叉搜索树](https://leetcode.cn/problems/unique-binary-search-trees/)（树结构计数）。
- [#1039 多边形三角剖分的最低得分](https://leetcode.cn/problems/minimum-score-triangulation-of-polygon/)（区间切分）。
### 深入迁移

- 进阶延伸：[#312 戳气球](https://leetcode.cn/problems/burst-balloons/)（区间最后一步）。
- 进阶延伸：[#968 监控二叉树](https://leetcode.cn/problems/binary-tree-cameras/)（树形多状态决策）。

## 交付

任选一类，画出状态依赖图；说明遍历顺序为什么保证依赖状态已完成。

## 限时与复盘

Hot 100 优先队列每题 30 分钟，进阶延伸 50 分钟。复盘问题：状态表的填充顺序是否严格早于所有依赖状态？
