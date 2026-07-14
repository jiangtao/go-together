# 每个 Course 固定一个主语言

**Status:** accepted

Course 是一级学习单元，Language 是分类元数据。每个 Course 恰有一个 Primary Language；其他语言、运行时、框架和工具仅为 Supporting Technology。这样保留一个 Language 下多个 Course 的能力，同时避免多主语言使 Catalog 分类、评测路由和课程发现失去确定性；Course 的稳定身份仍只由 `courseId` 决定。
