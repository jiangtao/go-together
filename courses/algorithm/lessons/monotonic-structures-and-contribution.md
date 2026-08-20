# 单调结构、贡献法与答案二分

## 本节模型

单调栈记录尚未找到边界的元素，单调队列维护滑动窗口的候选极值。贡献法则反转视角：不枚举每个子数组，而是计算某个元素作为最小值或最大值时能覆盖的边界组合。相等元素必须统一规定由左侧还是右侧负责，否则会重复计数。

TypeScript 中队列不要反复 `shift`；用数组加头尾下标。Go 可用切片加 head 索引。任何“二分答案”都先证明可行性随答案单调。

## 阶梯题组

### 简单恢复

- [#496 下一个更大元素 I](https://leetcode.cn/problems/next-greater-element-i/)（最近边界）。
- [#503 下一个更大元素 II](https://leetcode.cn/problems/next-greater-element-ii/)（循环数组单调栈）。

### 经典模板（Hot 100 优先）

- [#739 每日温度](https://leetcode.cn/problems/daily-temperatures/)（单调栈）。
- [#239 滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/)（单调队列）。
- [#875 爱吃香蕉的珂珂](https://leetcode.cn/problems/koko-eating-bananas/)（可行性与答案二分）。
- [#402 移掉 K 位数字](https://leetcode.cn/problems/remove-k-digits/)（单调选择）。
- Hot 100 优先队列：[#84 柱状图中最大的矩形](https://leetcode.cn/problems/largest-rectangle-in-histogram/)（左右结算边界）。
- [#1011 在 D 天内送达包裹的能力](https://leetcode.cn/problems/capacity-to-ship-packages-within-d-days/)（容量答案二分）。

### 深入迁移

- [#907 子数组的最小值之和](https://leetcode.cn/problems/sum-of-subarray-minimums/)（贡献归属）。
- [#85 最大矩形](https://leetcode.cn/problems/maximal-rectangle/)（二维转柱状图）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 30 分钟，深入迁移 55 分钟。复盘问题：每个元素何时入、何时出、何时结算；相等值的归属规则是否前后一致？
