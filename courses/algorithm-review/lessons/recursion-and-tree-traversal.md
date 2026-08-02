# 递归语义与树遍历

## 本节模型

递归函数先用一句话定义：它接收什么、返回什么、只处理哪棵子树。前序适合携带路径状态，中序适合顺序关系，后序适合从孩子聚合信息，层序适合按距离分组。把“做什么”放在正确遍历位置比选择递归或迭代更重要。

TypeScript 的递归树节点接口应允许空子节点；Go 用指针表达空子树。若树可能很深，记录递归深度风险，并准备显式栈版本。

## 速刷动作

1. 为每个递归写出基线条件。
2. 标注处理逻辑位于前、中、后哪个位置。
3. 迭代版本先定义栈内元素携带什么上下文。

## 练习入口

- Hot 100 优先队列：[#94 二叉树的中序遍历](https://leetcode.cn/problems/binary-tree-inorder-traversal/)（显式栈）。
- Hot 100 优先队列：[#102 二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/)（按层队列）。
- Hot 100 优先队列：[#104 二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/)（递归语义）。
- 进阶延伸：[#297 二叉树的序列化与反序列化](https://leetcode.cn/problems/serialize-and-deserialize-binary-tree/)（结构编码）。

## 交付

用一句话定义递归函数返回值，并将同一题改写为显式栈遍历，比较二者保存的状态。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 35 分钟。复盘问题：我的处理逻辑位于正确的遍历位置吗，返回值是否有唯一语义？
