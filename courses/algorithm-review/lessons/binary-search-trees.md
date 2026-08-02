# 二叉搜索树的顺序约束

## 本节模型

BST 的性质是整棵子树的值域约束，不是只比较父子节点。验证时将上下界传入子树；查询第 k 小时利用中序递增；删除或替换节点时要说明后继/前驱仍保留有序关系。

出现“有序树”时，先判断能否在一次中序遍历中解决；出现“范围”时，优先考虑把范围传递下去，而不是收集全部值后再检查。

## 速刷动作

1. 上下界用开区间还是闭区间，必须与重复值规则一致。
2. 中序状态若只需要第 k 个，可以提前结束。
3. 对极小值、极大值、只有左链或右链的树验证。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先恢复有序搜索，再处理全局值域与结构修改。

### 简单恢复

- [#700 二叉搜索树中的搜索](https://leetcode.cn/problems/search-in-a-binary-search-tree/)（比较方向）。
- [#701 二叉搜索树中的插入操作](https://leetcode.cn/problems/insert-into-a-binary-search-tree/)（插入位置）。
- [#530 二叉搜索树的最小绝对差](https://leetcode.cn/problems/minimum-absolute-difference-in-bst/)（中序相邻值）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#98 验证二叉搜索树](https://leetcode.cn/problems/validate-binary-search-tree/)（全局值域）。
- Hot 100 优先队列：[#230 二叉搜索树中第 K 小的元素](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/)（中序顺序）。
- Hot 100 优先队列：[#235 二叉搜索树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-search-tree/)（大小关系）。
- [#501 二叉搜索树中的众数](https://leetcode.cn/problems/find-mode-in-binary-search-tree/)（中序游程计数）。
### 深入迁移

- 进阶延伸：[#450 删除二叉搜索树中的节点](https://leetcode.cn/problems/delete-node-in-a-bst/)（后继替换）。
- 进阶延伸：[#99 恢复二叉搜索树](https://leetcode.cn/problems/recover-binary-search-tree/)（逆序对定位）。
- 进阶延伸：[#669 修剪二叉搜索树](https://leetcode.cn/problems/trim-a-binary-search-tree/)（值域裁剪）。

## 交付

为验证题写出当前节点允许的数值区间，并说明为何局部父子比较不足以证明 BST。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 35 分钟。复盘问题：我传递的是父节点值，还是完整子树允许的值域？
