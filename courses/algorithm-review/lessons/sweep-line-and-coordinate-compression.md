# 扫描线、事件排序与离散化

## 本节模型

扫描线把二维或连续问题投影为一维有序事件流：进入、离开、查询在坐标轴上排序，然后维护活跃集合。离散化只保留相对次序，把大坐标映射为紧凑索引；它不能代替区间长度本身，涉及真实长度时应保留原值。

边界最容易出错：闭区间与半开区间决定同坐标的开始事件和结束事件谁先处理。先写事件排序表，再选堆、平衡结构或线段树保存活跃状态。

## 阶梯题组

### 简单恢复

- [#56 合并区间](https://leetcode.cn/problems/merge-intervals/)（排序后的区间边界）。

### 经典模板（Hot 100 优先）

- [#452 用最少数量的箭引爆气球](https://leetcode.cn/problems/minimum-number-of-arrows-to-burst-balloons/)（端点贪心）。
- [#435 无重叠区间](https://leetcode.cn/problems/non-overlapping-intervals/)（事件顺序与选择）。

### 深入迁移

- [#218 天际线问题](https://leetcode.cn/problems/the-skyline-problem/)（事件与活跃高度）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 25 分钟，深入迁移 60 分钟。复盘问题：同一坐标的事件顺序由哪一种区间语义决定，离散索引与原坐标是否被混用？
