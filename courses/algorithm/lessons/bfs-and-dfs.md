# BFS、DFS 与网格搜索

## 本节模型

BFS 保证第一次到达节点时的边数最小，适合无权最短步数；DFS 适合连通性、结构遍历和回溯。网格只是隐式图，四方向或八方向移动、边界检查和访问标记就是邻接表规则。

访问标记应在入队或进入递归时完成，避免同一节点被重复调度。BFS 的层数要么按队列长度分层，要么将距离随节点携带，二者不可混用。

## 速刷动作

1. 明确节点、边和访问状态。
2. BFS 每层开始前固定当前队列长度。
3. 网格恢复现场时区分是否允许修改原数组。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先建立网格访问，再处理多源与隐式图最短路。

### 简单恢复

- [#733 图像渲染](https://leetcode.cn/problems/flood-fill/)（网格访问标记）。
- [#695 岛屿的最大面积](https://leetcode.cn/problems/max-area-of-island/)（分量聚合）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#200 岛屿数量](https://leetcode.cn/problems/number-of-islands/)（连通分量）。
- Hot 100 优先队列：[#994 腐烂的橘子](https://leetcode.cn/problems/rotting-oranges/)（多源 BFS）。
- Hot 100 优先队列：[#207 课程表](https://leetcode.cn/problems/course-schedule/)（依赖图可达性）。
- Hot 100 优先队列：[#542 01 矩阵](https://leetcode.cn/problems/01-matrix/)（多源距离）。
- [#752 打开转盘锁](https://leetcode.cn/problems/open-the-lock/)（隐式状态图）。
- [#1091 二进制矩阵中的最短路径](https://leetcode.cn/problems/shortest-path-in-binary-matrix/)（八方向 BFS）。
### 深入迁移

- 进阶延伸：[#127 单词接龙](https://leetcode.cn/problems/word-ladder/)（隐式图最短路）。
- 进阶延伸：[#417 太平洋大西洋水流问题](https://leetcode.cn/problems/pacific-atlantic-water-flow/)（反向多源遍历）。

## 交付

为多源 BFS 写下初始队列如何形成，说明为什么标记访问发生在入队而非出队。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 40 分钟。复盘问题：我是在求最短步数、连通性还是枚举路径，这个目标是否匹配 BFS/DFS？
