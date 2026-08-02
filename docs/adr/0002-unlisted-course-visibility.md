# 不列入目录的课程使用 Visibility，而非 Lifecycle

算法复习 Course 需要能通过 `/courses/{courseId}` 手动进入，但不能出现在课程选择器。我们将其建模为 Published + `visibility: unlisted`：Lifecycle 继续表达发布可用性，Visibility 只表达界面发现；Draft 会阻止公开投影，无法满足直接访问。静态公开投影没有认证边界，因此 Unlisted 不是私有或保密访问控制，知道 URL 的人仍可访问。
