# 字典树与前缀状态

## 本节模型

Trie 将公共前缀变成共享路径。节点至少需要子节点表和词尾标记；如果题目需要计数、最短前缀或剪枝，可增加相应状态。Trie 往往不单独出现，而是与 DFS、回溯或动态规划组合，用前缀不存在这一事实提前终止搜索。

固定小字符集可以用数组子节点，稀疏或 Unicode 字符集优先 `Map`。TypeScript 递归访问时注意对象共享；Go 中节点指针和映射初始化都需明确。

## 速刷动作

1. 定义节点字段和词尾状态。
2. 插入、查询、前缀查询分别写成独立操作。
3. 组合搜索时，让 Trie 失败尽早剪掉分支。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先确认公共前缀，再把节点状态接入搜索。

### 简单恢复

- [#14 最长公共前缀](https://leetcode.cn/problems/longest-common-prefix/)（前缀关系）。
- [#720 词典中最长的单词](https://leetcode.cn/problems/longest-word-in-dictionary/)（逐层前缀可达）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#208 实现 Trie（前缀树）](https://leetcode.cn/problems/implement-trie-prefix-tree/)（基础操作）。
- Hot 100 优先队列：[#139 单词拆分](https://leetcode.cn/problems/word-break/)（前缀集合与状态）。
- [#211 添加与搜索单词 - 数据结构设计](https://leetcode.cn/problems/design-add-and-search-words-data-structure/)（通配符分支）。
- [#677 键值映射](https://leetcode.cn/problems/map-sum-pairs/)（前缀聚合）。
- [#1268 搜索推荐系统](https://leetcode.cn/problems/search-suggestions-system/)（有序前缀候选）。
### 深入迁移

- 进阶延伸：[#212 单词搜索 II](https://leetcode.cn/problems/word-search-ii/)（Trie 与网格 DFS）。
- 进阶延伸：[#648 单词替换](https://leetcode.cn/problems/replace-words/)（最短前缀终止）。
- 进阶延伸：[#421 数组中两个数的最大异或值](https://leetcode.cn/problems/maximum-xor-of-two-numbers-in-an-array/)（二进制 Trie）。

## 交付

为节点接口写出字段语义，并说明在网格搜索中为什么前缀失败应立即返回。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 40 分钟。复盘问题：节点字段中哪些属于结构，哪些是为了提前终止搜索？
