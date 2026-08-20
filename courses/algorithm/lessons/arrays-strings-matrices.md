# 数组、字符串与矩阵原地变换

## 本节模型

数组题优先问“读指针与写指针谁先移动”。原地修改通常依赖一个尚未覆盖的区域：从右往左适合扩容写入，从左往右适合压缩保留项。矩阵题把二维坐标当作不变量的一部分，先标明层、边、方向和终止条件。

字符串在 TypeScript/JavaScript 中不可原地改写，若算法需要频繁位置写入，应转换成字符数组。Go 中 `[]byte` 可以承接可变字符操作，但要明确 Unicode 场景是否仍按字节处理。

## 速刷动作

1. 在纸上画出未读区、已处理区和待写区。
2. 若有两层循环，判断内层总次数是否仍为线性。
3. 矩阵循环先用 `top/right/bottom/left` 写出边界更新顺序。

## 阶梯题组

按“简单恢复 → 经典模板 → 深入迁移”完成，先固定读写边界，再处理多维变换。

### 简单恢复

- [#283 移动零](https://leetcode.cn/problems/move-zeroes/)（读写指针）。
- [#27 移除元素](https://leetcode.cn/problems/remove-element/)（覆盖写入）。
- [#26 删除有序数组中的重复项](https://leetcode.cn/problems/remove-duplicates-from-sorted-array/)（有序读写边界）。

### 经典模板（Hot 100 优先）

- Hot 100 优先队列：[#238 除自身以外数组的乘积](https://leetcode.cn/problems/product-of-array-except-self/)（前后缀分解）。
- Hot 100 优先队列：[#73 矩阵置零](https://leetcode.cn/problems/set-matrix-zeroes/)（原地标记）。
- Hot 100 优先队列：[#48 旋转图像](https://leetcode.cn/problems/rotate-image/)（分层交换）。
- [#189 轮转数组](https://leetcode.cn/problems/rotate-array/)（三次翻转）。
- [#54 螺旋矩阵](https://leetcode.cn/problems/spiral-matrix/)（收缩边界）。
### 深入迁移

- 进阶延伸：[#41 缺失的第一个正数](https://leetcode.cn/problems/first-missing-positive/)（索引定位与受限空间）。
- 进阶延伸：[#289 生命游戏](https://leetcode.cn/problems/game-of-life/)（原地状态编码）。

## 交付

选一道原地题，标出每次写入前仍受保护的数据区；再用 Go 说明是否需要预分配切片容量。

## 限时与复盘

Hot 100 优先队列每题 20 分钟，进阶延伸 30 分钟。复盘问题：我的读写区间是否在每次迭代后仍覆盖了全部未处理元素？
