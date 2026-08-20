# 滑动窗口与频次状态

## 本节模型

窗口题的四件套是：窗口边界、状态容器、有效条件、收缩条件。固定窗口只需稳定地加入右端并移除左端；可变窗口则要区分“满足条件后尽可能收缩”与“违反条件后必须收缩”。频次数组只适合有限字符集，通用输入优先 `Map`。

一个可靠的检查方式：任意时刻都能用一句话说清 `left..right` 表示什么，以及计数器为什么与该区间一致。

## 速刷动作

1. 把加入元素和移除元素写成对称函数。
2. 用 `valid` 计数时，注明它代表满足了多少种约束。
3. 对空窗口、重复字符、条件从未满足做测试。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先维护固定窗口，再处理满足条件后的收缩。

### 简单恢复

- [#219 存在重复元素 II](https://leetcode.cn/problems/contains-duplicate-ii/)（固定范围窗口）。
- [#209 长度最小的子数组](https://leetcode.cn/problems/minimum-size-subarray-sum/)（正数窗口收缩）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#3 无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/)（重复约束）。
- Hot 100 优先队列：[#438 找到字符串中所有字母异位词](https://leetcode.cn/problems/find-all-anagrams-in-a-string/)（固定窗口频次）。
- Hot 100 优先队列：[#76 最小覆盖子串](https://leetcode.cn/problems/minimum-window-substring/)（满足后收缩）。
- [#713 乘积小于 K 的子数组](https://leetcode.cn/problems/subarray-product-less-than-k/)（乘积约束）。
- [#1004 最大连续 1 的个数 III](https://leetcode.cn/problems/max-consecutive-ones-iii/)（替换预算）。
- [#424 替换后的最长重复字符](https://leetcode.cn/problems/longest-repeating-character-replacement/)（窗口内主频）。
- [#1658 将 x 减到 0 的最小操作数](https://leetcode.cn/problems/minimum-operations-to-reduce-x-to-zero/)（补集窗口）。
### 深入迁移

- 进阶延伸：[#480 滑动窗口中位数](https://leetcode.cn/problems/sliding-window-median/)（窗口与双堆）。

## 交付

画出一次扩张和一次收缩的状态变化；解释为什么 JavaScript 的对象键不如 `Map` 适合通用字符键。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 35 分钟。复盘问题：窗口何时有效、何时必须收缩，两个条件是否被我混淆？
