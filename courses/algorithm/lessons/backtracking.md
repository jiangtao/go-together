# 回溯与组合枚举

## 本节模型

回溯就是在决策树上进行受控 DFS：选择、递归、撤销。路径是当前选择序列，候选集合是下一层可选项，终止条件决定何时收集结果。去重应在同一层进行，避免误删不同层的合法重复选择。

复杂度通常与输出规模相关；因此先用剪枝减少无效枝，而非对递归写法做微小语法优化。每次递归返回后必须恢复被共享修改的状态。

## 速刷动作

1. 写清递归层数代表什么。
2. 明确路径是复制传递还是原地 push/pop。
3. 对空候选、重复候选、最深叶子验证撤销对称性。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先枚举受限组合，再增加剪枝与约束集合。

### 简单恢复

- [#77 组合](https://leetcode.cn/problems/combinations/)（起始下标）。
- [#17 电话号码的字母组合](https://leetcode.cn/problems/letter-combinations-of-a-phone-number/)（固定层数选择）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#46 全排列](https://leetcode.cn/problems/permutations/)（已选集合）。
- Hot 100 优先队列：[#78 子集](https://leetcode.cn/problems/subsets/)（选择或跳过）。
- Hot 100 优先队列：[#39 组合总和](https://leetcode.cn/problems/combination-sum/)（起始下标与剪枝）。
- Hot 100 优先队列：[#22 括号生成](https://leetcode.cn/problems/generate-parentheses/)（合法前缀约束）。
- [#40 组合总和 II](https://leetcode.cn/problems/combination-sum-ii/)（同层去重）。
- Hot 100 优先队列：[#79 单词搜索](https://leetcode.cn/problems/word-search/)（网格选择与撤销）。
### 深入迁移

- 进阶延伸：[#51 N 皇后](https://leetcode.cn/problems/n-queens/)（约束集合）。
- 进阶延伸：[#37 解数独](https://leetcode.cn/problems/sudoku-solver/)（候选约束传播）。

## 交付

画出前三层决策树，标记每次选择与撤销；说明去重为何必须发生在同一递归层。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 45 分钟。复盘问题：每次递归返回后，所有共享状态是否都恢复到了进入前？
