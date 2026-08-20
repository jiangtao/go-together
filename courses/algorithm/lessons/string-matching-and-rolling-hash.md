# 字符串匹配与滚动哈希

## 本节模型

字符串匹配先区分“逐位比较”“复用已知前后缀”和“维护窗口摘要”。KMP 的前缀函数保存模式串内部可复用的匹配长度；滚动哈希保存窗口摘要并在滑动时增量更新。哈希相等只是候选相等，冲突敏感场景仍需额外确认或采用双哈希。

在 TypeScript/JavaScript 中要明确字符与 UTF-16 码元的差异；Go 的 `range` 迭代 rune，而按字节索引则需要主动选择。题目若限定小写字母，才能安全使用定长数组。

## 阶梯题组

### 简单恢复

- [#28 找出字符串中第一个匹配项的下标](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/)（朴素匹配边界）。
- [#459 重复的子字符串](https://leetcode.cn/problems/repeated-substring-pattern/)（周期判断）。
- [#796 旋转字符串](https://leetcode.cn/problems/rotate-string/)（拼接后的模式匹配）。

### 经典模板（Hot 100 优先）

- [#242 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/)（频次摘要）。
- [#49 字母异位词分组](https://leetcode.cn/problems/group-anagrams/)（规范化键）。
- [#686 重复叠加字符串匹配](https://leetcode.cn/problems/repeated-string-match/)（跨边界匹配）。
- [#214 最短回文串](https://leetcode.cn/problems/shortest-palindrome/)（前缀函数迁移）。
- [#1392 最长快乐前缀](https://leetcode.cn/problems/longest-happy-prefix/)（KMP 前缀表）。

### 深入迁移

- [#187 重复的 DNA 序列](https://leetcode.cn/problems/repeated-dna-sequences/)（窗口编码与哈希状态）。
- [#1044 最长重复子串](https://leetcode.cn/problems/longest-duplicate-substring/)（二分长度与滚动哈希）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 20 分钟，深入迁移 40 分钟。复盘问题：当前状态是完整字符串、可复用前缀还是窗口摘要，碰撞或编码边界如何处理？
