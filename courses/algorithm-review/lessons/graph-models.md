# 有向图、拓扑与最短路

## 本节模型

图题先建模：顶点是谁、边表示什么、边是否有方向或权重。依赖关系使用有向图和入度；连通合并使用并查集；无权最短路使用 BFS；非负权最短路使用 Dijkstra。模型选择发生在编码前，邻接表只是表示层。

拓扑排序的完成数量小于顶点数即存在环。并查集的路径压缩和按秩合并需要保持父节点语义一致，不能随意把集合大小字段当作普通数组使用。

## 速刷动作

1. 写出邻接表中每条边的方向。
2. 拓扑题检查零入度队列是否耗尽。
3. 最短路先确认边权是否允许 BFS。

## 练习入口

- Hot 100 优先队列：[#207 课程表](https://leetcode.cn/problems/course-schedule/)（环检测）。
- Hot 100 优先队列：[#210 课程表 II](https://leetcode.cn/problems/course-schedule-ii/)（拓扑序）。
- Hot 100 优先队列：[#399 除法求值](https://leetcode.cn/problems/evaluate-division/)（带权可达性）。
- 进阶延伸：[#743 网络延迟时间](https://leetcode.cn/problems/network-delay-time/)（Dijkstra）。
- 进阶延伸：[#1584 连接所有点的最小费用](https://leetcode.cn/problems/min-cost-to-connect-all-points/)（最小生成树）。

## 交付

把一个题目翻译成顶点、边、权重和目标四项；再说明为何选用拓扑、BFS 或 Dijkstra。

## 限时与复盘

Hot 100 优先队列每题 25 分钟，进阶延伸 45 分钟。复盘问题：图的边权和方向是否已在建模时固定，算法前提是否满足？
