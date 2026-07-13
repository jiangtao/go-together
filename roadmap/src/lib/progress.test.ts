import { describe, expect, it } from "vitest"

import {
  summarizeRoadmapProgress,
} from "@/lib/progress"

describe("学习进度统计", () => {
  it("按 Curriculum 顺序推荐 Lesson，并排除 Retired Lesson", () => {
    expect(
      summarizeRoadmapProgress([
        { lessonId: "done", lifecycle: "active", status: "通过" },
        { lessonId: "retired", lifecycle: "retired", status: "未开始" },
        { lessonId: "next", lifecycle: "active", status: "重新学习" },
      ])
    ).toMatchObject({
      total: 2,
      completed: 1,
      percentage: 50,
      recommendedLessonId: "next",
    })
  })

})
