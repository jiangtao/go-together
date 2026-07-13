# 冻结 Course 身份、默认课与兼容边界

Type: grilling
Status: resolved
Blocked by:

## Question

多课程框架采用什么一级学习身份、默认解析规则、公开地址边界与内部迁移原则？

## Answer

- Course 是一级学习单元；Language 仅为 Course 元数据。
- 当前 Go Course 是 Default Course。
- Day 只在 Course 内有序；稳定学习身份是 `(courseId, lessonId)`。
- `/courses/{courseId}` 是规范公开 URL 命名空间。
- `/`、`/course.json`、`/sources/lessons/**` 永久作为 Default Go Course 的公开兼容别名。
- 课程源、练习、评测与公开进度全部迁入统一的 Course 归属模型；不为 Go 保留内部存储特例，不双写。迁移方式与用户入口兼容机制由后续决策票冻结。
