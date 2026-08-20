# 链表指针重连

## 本节模型

链表错误大多不是算法错误，而是丢失后继。局部变换使用四个角色：`dummy` 统一头部、`prev` 固定前缀、`current` 表示当前节点、`next` 保护尚未处理的后继。反转、合并和分组都可以在这个角色集内描述。

快慢指针的关键不是速度本身，而是二者在有限环上的相对距离变化。遇到“第 k 个”“倒数第 k 个”时，先让一个指针领先固定距离，再同步前进。

## 速刷动作

1. 写出每轮循环后 `prev` 和 `current` 所代表的区间。
2. 删除或插入头节点时一律先考虑哨兵。
3. 反转前先缓存 `next`，再改连接。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先建立节点连接语义，再组合局部变换。

### 简单恢复

- [#21 合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/)（哨兵与尾指针）。
- [#876 链表的中间结点](https://leetcode.cn/problems/middle-of-the-linked-list/)（快慢指针基线）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#206 反转链表](https://leetcode.cn/problems/reverse-linked-list/)（局部重连）。
- Hot 100 优先队列：[#141 环形链表](https://leetcode.cn/problems/linked-list-cycle/)（快慢指针）。
- Hot 100 优先队列：[#160 相交链表](https://leetcode.cn/problems/intersection-of-two-linked-lists/)（路径长度对齐）。
- Hot 100 优先队列：[#234 回文链表](https://leetcode.cn/problems/palindrome-linked-list/)（中点、反转与恢复）。
- Hot 100 优先队列：[#19 删除链表的倒数第 N 个结点](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/)（固定间距）。
- Hot 100 优先队列：[#142 环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/)（入环点推导）。
### 深入迁移

- 进阶延伸：[#25 K 个一组翻转链表](https://leetcode.cn/problems/reverse-nodes-in-k-group/)（分段边界）。
- 进阶延伸：[#23 合并 K 个升序链表](https://leetcode.cn/problems/merge-k-sorted-lists/)（分治或受限堆）。

## 交付

为分组翻转写出“组不足时不改动”的保护条件，并说明 TypeScript 类型定义与 Go 指针字段如何表达空节点。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 30 分钟。复盘问题：我在改写指针前是否保存了唯一需要保留的后继？
