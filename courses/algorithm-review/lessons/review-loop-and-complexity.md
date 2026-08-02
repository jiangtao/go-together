# 复习循环、复杂度与语言基线

## 本节模型

先分类，后编码。每道题只记录四项：输入规模、候选模型、不变量、复杂度。若十五分钟仍没有明确的不变量，立刻降级为纸面推导，不把试错代码当成进度。

TypeScript 主实现优先使用 `Map`、`Set`、数组和显式的接口；JavaScript 要留意 `number` 的语义与对象键转换；Go 对照时明确切片扩容、`map` 的零值和队列的头指针。三种语言应保持同一模型，而不是逐行翻译。

## 速刷动作

1. 写出 `O(...)` 与额外空间来源。
2. 列出空输入、单元素、重复值和极值四类边界。
3. 用三个自拟小例验证不变量；不要依赖平台样例。
4. 完成后记录“为什么这个模型可行”，而非只记录通过状态。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先让容器选择和复杂度表达恢复稳定。

### 简单恢复

- [#242 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/)（频次摘要与线性扫描）。
- [#1480 一维数组的动态和](https://leetcode.cn/problems/running-sum-of-1d-array/)（单次扫描与空间取舍）。
- [#88 合并两个有序数组](https://leetcode.cn/problems/merge-sorted-array/)（输入规模与写入方向）。

### 经典模板（Hot 100 优先）

本节先做两道结构热身：

- Hot 100 优先队列：[#1 两数之和](https://leetcode.cn/problems/two-sum/)（哈希补数）。
- Hot 100 优先队列：[#217 存在重复元素](https://leetcode.cn/problems/contains-duplicate/)（集合与线性扫描）。
- [#121 买卖股票的最佳时机](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/)（一次遍历维护最优前缀）。
- [#349 两个数组的交集](https://leetcode.cn/problems/intersection-of-two-arrays/)（集合选择）。
- [#36 有效的数独](https://leetcode.cn/problems/valid-sudoku/)（约束映射）。
### 深入迁移

- 进阶延伸：[#128 最长连续序列](https://leetcode.cn/problems/longest-consecutive-sequence/)（只从序列起点扩展）。
- 进阶延伸：[#49 字母异位词分组](https://leetcode.cn/problems/group-anagrams/)（规范化键与复杂度）。

## 交付

为其中一题写一页推导：不变量、复杂度、TypeScript 主实现的容器选择，以及一条 Go 对照注意点。

## 限时与复盘

Hot 100 优先队列每题 15 分钟，进阶延伸 25 分钟。复盘问题：我是在识别模型前开始编码，还是先写出了可验证的不变量？
