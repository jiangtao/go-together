# 哈希、栈、队列与单调栈

## 本节模型

哈希适合“见过什么”；栈适合“最近未完成什么”；队列适合“下一层或下一批什么”。单调栈额外维护一个顺序，使每个元素只在入栈和出栈时被处理一次。遇到“下一个更大/更小”“可见范围”“柱形面积”时，先问能否让违反单调性的元素立刻结算。

TypeScript 不要对数组频繁 `shift` 来模拟大队列；用头下标或专门队列。Go 同理，维护头下标后按需压缩底层切片。

## 速刷动作

1. 写出栈底到栈顶的单调关系。
2. 为每个出栈动作说明它结算了哪一个问题。
3. 队列标记访问状态的时机固定为入队时。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先确定访问时序，再维护单调约束。

### 简单恢复

- [#232 用栈实现队列](https://leetcode.cn/problems/implement-queue-using-stacks/)（双栈转移）。
- [#225 用队列实现栈](https://leetcode.cn/problems/implement-stack-using-queues/)（访问顺序重排）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#20 有效的括号](https://leetcode.cn/problems/valid-parentheses/)（匹配栈）。
- Hot 100 优先队列：[#739 每日温度](https://leetcode.cn/problems/daily-temperatures/)（单调栈）。
- Hot 100 优先队列：[#155 最小栈](https://leetcode.cn/problems/min-stack/)（辅助状态）。
- Hot 100 优先队列：[#394 字符串解码](https://leetcode.cn/problems/decode-string/)（嵌套状态栈）。
- [#496 下一个更大元素 I](https://leetcode.cn/problems/next-greater-element-i/)（单调栈恢复）。
- Hot 100 优先队列：[#239 滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/)（单调队列）。
### 深入迁移

- 进阶延伸：[#84 柱状图中最大的矩形](https://leetcode.cn/problems/largest-rectangle-in-histogram/)（哨兵与边界结算）。
- 进阶延伸：[#85 最大矩形](https://leetcode.cn/problems/maximal-rectangle/)（逐行柱状图转化）。

## 交付

选择一个单调栈题，写下栈中每个元素尚未确定的关系，并给出摊还线性复杂度理由。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 35 分钟。复盘问题：每一次出栈究竟结算了哪个元素的哪个关系？
