# 并查集与离线连通性

## 本节模型

并查集只回答两类问题：两个元素是否属于同一连通分量，以及把两个分量合并。路径压缩与按秩（或按大小）合并让一串操作的均摊成本接近常数。它不擅长删除边；遇到带删除的动态连通性，应先判断能否倒序处理或按时间分段离线化。

TypeScript 使用数组保存父节点和大小，避免递归 `find` 过深；Go 也用整数切片，并把 `find` 的路径压缩集中封装。合并后只维护根节点的统计值。

## 阶梯题组

### 简单恢复

- [#1971 寻找图中是否存在路径](https://leetcode.cn/problems/find-if-path-exists-in-graph/)（连通性查询）。

### 经典模板（Hot 100 优先）

- [#200 岛屿数量](https://leetcode.cn/problems/number-of-islands/)（连通分量建模）。
- [#547 省份数量](https://leetcode.cn/problems/number-of-provinces/)（矩阵中的合并关系）。

### 深入迁移

- [#1202 交换字符串中的元素](https://leetcode.cn/problems/smallest-string-with-swaps/)（分量内重排）。
- [#803 打砖块](https://leetcode.cn/problems/bricks-falling-when-hit/)（删除操作逆序离线化）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 25 分钟，深入迁移 45 分钟。复盘问题：这个问题只有合并和查询吗；若有删除操作，离线化的时间方向是否正确？
