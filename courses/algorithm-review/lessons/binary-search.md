# 二分搜索与答案空间

## 本节模型

二分不是“查数组”的技巧，而是“在有序候选中寻找边界”。先约定区间是闭区间还是半开区间，再定义循环不变量，最后让每次迭代严格缩小区间。答案二分将“是否可行”写成单调判定函数，答案本身无需提前出现在输入中。

TypeScript 的中点用 `left + Math.floor((right - left) / 2)`，Go 使用同等的差值写法；两者都避免直接相加导致的潜在整数边界问题。

## 速刷动作

1. 写下 `left`、`right` 仍可能包含什么。
2. 判定函数要独立测试临界真值。
3. 最后检查循环结束后返回的是候选、插入点还是边界外位置。

## 练习入口

- Hot 100 优先队列：[#33 搜索旋转排序数组](https://leetcode.cn/problems/search-in-rotated-sorted-array/)（分段有序）。
- Hot 100 优先队列：[#34 在排序数组中查找元素的第一个和最后一个位置](https://leetcode.cn/problems/find-first-and-last-position-of-element-in-sorted-array/)（双边界）。
- Hot 100 优先队列：[#153 寻找旋转排序数组中的最小值](https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/)（比较右界）。
- 进阶延伸：[#4 寻找两个正序数组的中位数](https://leetcode.cn/problems/median-of-two-sorted-arrays/)（分割线二分）。

## 交付

为一个答案二分题给出单调判定的真值边界，并写明循环结束的唯一合法返回位置。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 40 分钟。复盘问题：循环区间的每一个端点是否仍有清晰的候选含义？
