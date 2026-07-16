# 14 — 交付多 Course Roadmap 体验

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让学习者在同一 Roadmap 中通过 URL 和课程选择器安全切换 Published Course，并在桌面、平板和移动端稳定使用 Canvas、Day、Reader 与 Zen；任何状态、焦点、异步结果和画布 transform 都不能跨 Course 串联。

**Blocked by:** 12 — 贯通规范与 Legacy 公开投影

**Status:** resolved

- [x] URL 唯一决定 Active Course；根入口固定 go-backend，规范 Course URL 精确解析，尾斜杠规范化，未知/Draft/非法 ID 不静默回退。
- [x] 应用先加载 Public Catalog，再配对加载目标 Course/Progress；迟到请求被 abort/request generation/courseId 防线丢弃，错误不展示旧 Course。
- [x] 至少两个 Published Course 时显示 44×44 以上的 shadcn Course Select；只有一个时显示静态身份；Retired 直达时显示退役与 Replacement 提示。
- [x] Course Select 使用 pushState，浏览器前进/后退走相同解析；成功、历史、深链和错误状态的焦点落点符合规范。
- [x] Surface 只允许 canvas/day/reader，Day/Reader 携带完整稳定学习身份；Course 变化关闭面板，Reader 异步结果无法写入新 Course。
- [x] zen 与 Surface 正交；Escape 每次只退 Reader→Day→Zen 一层；Zen 内关闭面板返回同 Course Zen。
- [x] React Flow transform 按 Course Revision 与布局档隔离；首次完整 fitView，不默认聚焦推荐 Lesson，返回恢复视口，用户交互取消待恢复。
- [x] 画布完全由 Track/Stage/Lesson/Progress 数据构建，支持任意结构和无 Day Lesson；Go 仍呈现三主干、六阶段和 Day 0–36。
- [x] Day Drawer 只呈现当前 Lesson；Reader 使用安全同源 Markdown，桌面约 70vw、移动全宽；两者均不改变画布 transform。
- [x] Drawer/Reader autoFocus、返回按钮、关闭按钮、trigger 恢复和 trigger 销毁后的 h1 fallback 全部可测试。
- [x] 加载、空 Catalog、not-found、解析失败和 retry 使用克制 shadcn 视觉、结构骨架、aria-live、visible focus 和 reduced-motion。
- [x] 1440×900、1024×768、390×844、360×800 下无横向溢出、遮挡、焦点丢失或 console/page/network error。

## 完成证据

- `npm run build:release`：生成、确定性与三段产物审计通过；lint、typecheck、162 个单测及 25 个评测脚本测试通过。
- `npm run test:e2e`：42 passed、50 skipped、0 failed，覆盖四视口、课程切换/竞态、transform、Day/Reader/Zen 与焦点恢复。
- Impeccable 静态检测：0 findings。
- Ticket 15 继续负责冻结的 12 张截图清单与 release receipt，不在本票重复收口。
