# 不列入目录的课程使用 Visibility，而非 Lifecycle

**Status:** superseded by ADR 0004

最初算法 Course 只要求不出现在课程选择器，因此建模为 Published + `visibility: unlisted`。后续需求明确为“不进入任何公开部署、仅本地可见”，单独的发现性已不足以表达边界；新的分发决策见 ADR 0004。

## English

The algorithm course was originally modeled as Published + `visibility: unlisted` because it only needed to be hidden from the selector. The requirement later changed to local-only distribution with zero public deployment artifacts, so ADR 0004 supersedes this discoverability-only decision.
