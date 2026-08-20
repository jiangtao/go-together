# 排序、分区与随机选择

## 本节模型

排序解决全局顺序，选择只保证目标秩附近正确。快速排序与快速选择共用分区：左区不大于枢轴，右区不小于枢轴，枢轴落在最终位置。随机枢轴不改变正确性，只降低坏输入持续触发极端分区的概率。

TypeScript 中避免在比较器里隐式返回布尔值；Go 的排序闭包也必须满足严格弱序。若调用方不允许原地修改，先复制数组再排序。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成；前一层的分区或排序不变量必须在下一层复用。

### 简单恢复

- [#912 排序数组](https://leetcode.cn/problems/sort-an-array/)（排序接口与比较器）。
- [#88 合并两个有序数组](https://leetcode.cn/problems/merge-sorted-array/)（归并基本操作）。

### 经典模板（Hot 100 优先）

- [#215 数组中的第 K 个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/)（选择而非全排序）。
- [#75 颜色分类](https://leetcode.cn/problems/sort-colors/)（三路分区）。
- Hot 100 优先队列：[#56 合并区间](https://leetcode.cn/problems/merge-intervals/)（排序后扫描）。
- [#179 最大数](https://leetcode.cn/problems/largest-number/)（自定义比较器）。
- Hot 100 优先队列：[#148 排序链表](https://leetcode.cn/problems/sort-list/)（链表归并）。
- Hot 100 优先队列：[#347 前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/)（桶或选择）。

### 深入迁移

- [#324 摆动排序 II](https://leetcode.cn/problems/wiggle-sort-ii/)（选择、映射与三路分区组合）。
- [#493 翻转对](https://leetcode.cn/problems/reverse-pairs/)（归并计数）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 25 分钟，深入迁移 45 分钟。复盘问题：我的分区边界是否在任意交换后仍包含了全部未分类元素？
