# 12 — 贯通规范与 Legacy 公开投影

**Parent:** [多课程学习框架与 Go 兼容迁移冻结规范](../spec.md)

**What to build:** 让同一个 Catalog-driven 生成入口可以从 Course 契约生成规范 v1 Catalog/Course/Progress/Markdown，同时为当前 Go 产生完全兼容的根级 v3 Course 与 37 个 legacy Markdown；开发服务器可通过真实 HTTP 验证两套公开入口来自同一事实。

**Blocked by:** 11 — 建立 Course 契约与安全发布快照

**Status:** resolved

- [x] 生成器从 Catalog 正向枚举 Source Course，核对登记与源集合一一对应；所有生命周期校验，只有 Published/Retired 进入 Public Projection。
- [x] 每个公开 Course 必须存在匹配 courseId/courseRevision 和完整 Lesson 集的 Release Progress Snapshot，禁止默认补状态。
- [x] 规范 v1 Public Catalog、Course、Progress、Lesson Markdown 和 public resources 严格符合冻结白名单。
- [x] Go legacy `/course.json` 保持 schema v3 exact shape、六 Stage、Day 0–36、37 Lesson、四态、分数和旧 href，不加入新字段。
- [x] 37 个 legacy Markdown 只由显式 mapping 产生，并与对应规范安全 Markdown 逐字节相同；未知 legacy 地址返回 404。
- [x] 根页面和规范 Go 页面使用同一 go-backend Course Revision；新应用运行时不消费 legacy Course JSON。
- [x] Markdown/resource 投影拒绝 internal、Learning Record、Exercise Template、答案、rubric、私有路径、危险协议、symlink 和越界引用。
- [x] 每个 Course 在独立临时目录生成，全部 Course 与 compatibility 校验通过后才替换成功输出；失败保留上一次成功输出且不修改任何源。
- [x] 为迁移期提供隔离且有删除门禁的旧 Go 输入 adapter，使当前 Go 可生成新公开契约；adapter 不进入最终运行时，也不产生双写事实源。
- [x] 通过开发 HTTP 测试证明规范数据、legacy 数据、Markdown、MIME 和不存在资源的 404 行为；现有 Go 页面仍可打开。
- [x] 当前真实 Go Lesson、旧 Roadmap 数据和私有记录未被移动或改写。

## Evidence

- 发布链：确定性生成 78/78；generated 审计 78 文件、74 篇教程；dist 审计 86 文件、81 个文本文件；prebuilt 审计 87 个精确文件。
- 静态与自动化门禁：lint、typecheck、unit 150/150、Playwright 27 passed / 41 skipped / 0 failed；8 张 E2E 截图清单通过且可幂等重建。
- 安全负例：危险 Markdown、越界/符号链接、未受 manifest 管理或缺失的 asset、动态 import、同源 JS/CSS 引用、未知数据/资源及缺失 `/assets/**` 均 fail-closed。
- Fresh review：Standards 0 findings；Spec 0 findings。
- 不变性：受保护 `roadmap/src/data/course.json` SHA-256 仍为 `a8c2e21b0e6b68adfb52ceead6cb37b2afab9f1207d4a291bf04ce7e6723322d`；用户脏文件未移动、改写、暂存或清理；未占用或替换 5173 服务。
