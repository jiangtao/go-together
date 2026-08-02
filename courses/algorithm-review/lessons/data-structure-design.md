# 数据结构设计与缓存淘汰

## 本节模型

设计题的第一步是把操作逐条列出，再为每个操作分配一个结构责任。哈希表负责定位，双向链表负责顺序，数组负责随机索引，栈/队列负责访问时序。任何一次更新都必须同步修改所有相关结构，否则复杂度承诺会被隐性状态破坏。

缓存淘汰不是背诵 LRU：它要求明确“最近”的定义、更新时机、容量为零和键覆盖等边界。Go 中可用 `container/list` 配合映射；TypeScript 中应封装节点连接，避免让业务逻辑直接改前后指针。

## 阶梯题组

### 简单恢复

- [#232 用栈实现队列](https://leetcode.cn/problems/implement-queue-using-stacks/)（操作责任拆分）。

### 经典模板（Hot 100 优先）

- [#146 LRU 缓存](https://leetcode.cn/problems/lru-cache/)（哈希与双向链表协作）。
- [#380 O(1) 时间插入、删除和获取随机元素](https://leetcode.cn/problems/insert-delete-getrandom-o1/)（数组与索引映射）。

### 深入迁移

- [#460 LFU 缓存](https://leetcode.cn/problems/lfu-cache/)（频次分层与访问顺序）。

## 限时与复盘

简单恢复 15 分钟，经典模板每题 30 分钟，深入迁移 55 分钟。复盘问题：每个结构分别保证哪个操作，任何更新是否遗漏同步关系？
