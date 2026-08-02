# 堆、优先队列与 Top K

## 本节模型

Top K 的关键是堆顶保存“当前最该被替换的元素”。保留最大的 K 个值时使用最小堆，保留最小的 K 个值时使用最大堆。流式问题不应先收集全部数据；中位数问题常由两个大小平衡的堆共同维护。

TypeScript 需要自己封装二叉堆或使用受控实现，比较器必须稳定定义。Go 的 `container/heap` 要实现接口并维护元素索引时，索引更新也属于不变量。

## 速刷动作

1. 写出堆顶在任意时刻代表什么。
2. 每次插入后判断是否需要弹出。
3. 检查 `k=0`、`k` 等于元素数、重复频次的情况。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先保持单个堆，再协调多个动态有序结构。

### 简单恢复

- [#703 数据流中的第 K 大元素](https://leetcode.cn/problems/kth-largest-element-in-a-stream/)（受限最小堆）。
- [#1046 最后一块石头的重量](https://leetcode.cn/problems/last-stone-weight/)（堆操作恢复）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#215 数组中的第 K 个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/)（受限堆）。
- Hot 100 优先队列：[#347 前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/)（频次与堆）。
- Hot 100 优先队列：[#295 数据流的中位数](https://leetcode.cn/problems/find-median-from-data-stream/)（双堆平衡）。
- Hot 100 优先队列：[#973 最接近原点的 K 个点](https://leetcode.cn/problems/k-closest-points-to-origin/)（受限候选集）。
- [#692 前 K 个高频单词](https://leetcode.cn/problems/top-k-frequent-words/)（多关键字比较）。
- [#373 查找和最小的 K 对数字](https://leetcode.cn/problems/find-k-pairs-with-smallest-sums/)（多路合并）。
### 深入迁移

- 进阶延伸：[#502 IPO](https://leetcode.cn/problems/ipo/)（双堆与可达项目）。
- 进阶延伸：[#23 合并 K 个升序链表](https://leetcode.cn/problems/merge-k-sorted-lists/)（多路归并）。

## 交付

为 Top K 题写下堆大小、堆顶语义和替换条件；用 Go 的 `heap.Interface` 列出需要实现的角色。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 40 分钟。复盘问题：堆顶保存的是当前最优还是当前最容易被替换的元素？
