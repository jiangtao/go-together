# 随机化算法、抽样与概率边界

## 本节模型

随机化可用于打散坏输入、从均匀候选中取样，或按权重选择候选。正确性不能只靠“多跑几次”：应说明每个结果的概率分布、独立性假设和期望复杂度。加权选择通常把权重转为前缀区间，再对随机目标做二分。

测试随机逻辑时验证不变量、范围和可复现实验，而不是断言某一次随机结果。不要用取模替代不均匀范围采样，也不要把随机种子当业务决策。

## 阶梯题组

### 简单恢复

- [#384 打乱数组](https://leetcode.cn/problems/shuffle-an-array/)（均匀置换的状态隔离）。
- [#382 链表随机节点](https://leetcode.cn/problems/linked-list-random-node/)（蓄水池抽样基线）。

### 经典模板（Hot 100 优先）

- [#380 O(1) 时间插入、删除和获取随机元素](https://leetcode.cn/problems/insert-delete-getrandom-o1/)（均匀索引抽样）。
- [#398 随机数索引](https://leetcode.cn/problems/random-pick-index/)（蓄水池抽样）。
- [#470 用 Rand7() 实现 Rand10()](https://leetcode.cn/problems/implement-rand10-using-rand7/)（拒绝采样）。
- [#497 非重叠矩形中的随机点](https://leetcode.cn/problems/random-point-in-non-overlapping-rectangles/)（面积权重）。
- [#478 在圆内随机生成点](https://leetcode.cn/problems/generate-random-point-in-a-circle/)（连续空间抽样）。

### 深入迁移

- [#528 按权重随机选择](https://leetcode.cn/problems/random-pick-with-weight/)（前缀权重与二分）。
- [#710 黑名单中的随机数](https://leetcode.cn/problems/random-pick-with-blacklist/)（稀疏重映射）。
- [#519 随机翻转矩阵](https://leetcode.cn/problems/random-flip-matrix/)（无放回抽样映射）。

## 限时与复盘

简单恢复 20 分钟，经典模板每题 30 分钟，深入迁移 45 分钟。复盘问题：每种输出的概率为何相同或按权重成比例，数据更新后抽样状态是否仍然有效？
