# 贪心、分治与进阶综合

## 本节模型

贪心不能只靠直觉。先提出局部选择，再用交换论证、保持领先或区间覆盖证明它不会损失全局最优。分治则要明确分割条件、子问题和合并成本。综合题常由两个模型串联：先排序再贪心、先单调栈再计算、先二分再判定。

最后一节不追求刷量：挑一题写出候选模型为何被排除、最终模型的关键不变量以及失败边界。这样才能把 Hot 100 的反射迁移到更高约束。

## 速刷动作

1. 为贪心选择写出替换另一选择的理由。
2. 为分治写出递推式和合并成本。
3. 综合题先拆成子模型，再决定接口数据结构。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先验证局部选择，再叠加区间和组合约束。

### 简单恢复

- [#455 分发饼干](https://leetcode.cn/problems/assign-cookies/)（排序后的局部选择）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#55 跳跃游戏](https://leetcode.cn/problems/jump-game/)（可达最远边界）。
- Hot 100 优先队列：[#45 跳跃游戏 II](https://leetcode.cn/problems/jump-game-ii/)（分层贪心）。
- Hot 100 优先队列：[#56 合并区间](https://leetcode.cn/problems/merge-intervals/)（排序后合并）。
- Hot 100 优先队列：[#763 划分字母区间](https://leetcode.cn/problems/partition-labels/)（最后出现位置）。
- [#452 用最少数量的箭引爆气球](https://leetcode.cn/problems/minimum-number-of-arrows-to-burst-balloons/)（端点贪心）。
- [#435 无重叠区间](https://leetcode.cn/problems/non-overlapping-intervals/)（保留最早结束区间）。
### 深入迁移

- 进阶延伸：[#239 滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/)（窗口与单调队列）。
- 进阶延伸：[#10 正则表达式匹配](https://leetcode.cn/problems/regular-expression-matching/)（高耦合状态设计）。
- 进阶延伸：[#315 计算右侧小于当前元素的个数](https://leetcode.cn/problems/count-of-smaller-numbers-after-self/)（归并分治计数）。

## 交付

任选一道进阶题，写出它由哪些基础模型组成，并给出一次失败尝试为何不满足不变量的复盘。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 50 分钟。复盘问题：局部选择能否通过交换论证保持全局最优，综合题的模型接口是否清楚？
