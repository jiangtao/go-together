# 前缀和、差分与区间计数

## 本节模型

静态区间求和采用前缀和，批量区间更新采用差分；两者都是把区间关系改写成端点关系。子数组计数的核心公式是“当前前缀减去目标值是否在历史中出现”，因此哈希表保存的是历史前缀的出现次数，而不是单个下标。

先确认区间约定：前缀数组常把 `prefix[0]` 设为零，使 `[left, right]` 的值可由两个端点相减。差分数组的右边界通常要检查是否仍在数组内。

## 速刷动作

1. 写出区间公式，再写代码。
2. 历史前缀先查询再更新，避免把当前元素重复计入。
3. 计数可能大于 32 位时，TypeScript 与 Go 都要检查数值范围。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先写出端点关系，再推广到计数和批量更新。

### 简单恢复

- [#303 区域和检索 - 数组不可变](https://leetcode.cn/problems/range-sum-query-immutable/)（静态前缀和）。
- [#724 寻找数组的中心下标](https://leetcode.cn/problems/find-pivot-index/)（左右前缀关系）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#560 和为 K 的子数组](https://leetcode.cn/problems/subarray-sum-equals-k/)（前缀状态计数）。
- Hot 100 优先队列：[#523 连续的子数组和](https://leetcode.cn/problems/continuous-subarray-sum/)（余数状态）。
- Hot 100 优先队列：[#525 连续数组](https://leetcode.cn/problems/contiguous-array/)（差值前缀）。
- [#304 二维区域和检索 - 矩阵不可变](https://leetcode.cn/problems/range-sum-query-2d-immutable/)（二维前缀和）。
- [#974 和可被 K 整除的子数组](https://leetcode.cn/problems/subarray-sums-divisible-by-k/)（余数计数）。
- [#930 和相同的二元子数组](https://leetcode.cn/problems/binary-subarrays-with-sum/)（前缀频次）。
### 深入迁移

- 进阶延伸：[#1109 航班预订统计](https://leetcode.cn/problems/corporate-flight-bookings/)（差分恢复）。
- 进阶延伸：[#1094 拼车](https://leetcode.cn/problems/car-pooling/)（事件差分与容量约束）。

## 交付

把一道计数题的 `Map` 键和值写成文字含义，并列出空前缀为何必须预置一次。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 30 分钟。复盘问题：哈希表记录的是下标、前缀值还是前缀出现次数，为什么？
