# 树状数组、线段树与区间查询

## 本节模型

先写清操作：静态区间求和可用前缀和；单点更新加前缀查询适合树状数组；区间更新、区间查询或自定义可合并信息时再考虑线段树。树中每个节点保存的不是“一个下标”，而是一个区间摘要；合并函数必须满足查询所需的结合关系。

TypeScript 的数组通常用一位偏移实现树状数组；Go 同理。不要混用闭区间、半开区间和零/一基下标，先把转换固定在公开函数边界。

## 阶梯题组

### 简单恢复

- [#303 区域和检索：数组不可变](https://leetcode.cn/problems/range-sum-query-immutable/)（前缀摘要）。
- [#304 二维区域和检索：矩阵不可变](https://leetcode.cn/problems/range-sum-query-2d-immutable/)（二维静态摘要）。
- [#1109 航班预订统计](https://leetcode.cn/problems/corporate-flight-bookings/)（区间更新基线）。

### 经典模板（Hot 100 优先）

- [#307 区域和检索：数组可修改](https://leetcode.cn/problems/range-sum-query-mutable/)（更新与查询）。
- [#315 计算右侧小于当前元素的个数](https://leetcode.cn/problems/count-of-smaller-numbers-after-self/)（顺序统计）。
- [#327 区间和的个数](https://leetcode.cn/problems/count-of-range-sum/)（前缀顺序统计）。
- [#493 翻转对](https://leetcode.cn/problems/reverse-pairs/)（离线区间计数）。
- [#1649 通过指令创建有序数组](https://leetcode.cn/problems/create-sorted-array-through-instructions/)（动态秩查询）。

### 深入迁移

- [#699 掉落的方块](https://leetcode.cn/problems/falling-squares/)（区间赋值与最大值）。
- [#715 Range 模块](https://leetcode.cn/problems/range-module/)（动态区间覆盖）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 35 分钟，深入迁移 60 分钟。复盘问题：节点摘要是什么，合并、查询和更新是否使用同一套区间约定？
