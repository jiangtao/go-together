import { describe, expect, it } from "vitest"

import {
  summarizeProgress,
  summarizeRoadmapProgress,
  summarizeStageProgress,
} from "@/lib/progress"
import type { CourseStage, CourseStatus } from "@/types/course"

function lesson(day: number, status: CourseStatus) {
  return { day, status }
}

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

  it("按四种状态计数并以通过数计算总进度", () => {
    const summary = summarizeProgress([
      lesson(0, "通过"),
      lesson(1, "通过"),
      lesson(2, "定向回炉"),
      lesson(3, "重新学习"),
      lesson(4, "未开始"),
    ])

    expect(summary).toEqual({
      total: 5,
      completed: 2,
      percentage: 40,
      counts: {
        未开始: 1,
        定向回炉: 1,
        重新学习: 1,
        通过: 2,
      },
      recommendedDay: 2,
    })
  })

  it("推荐按 Day 顺序遇到的第一个未通过课程", () => {
    const summary = summarizeProgress([
      lesson(3, "未开始"),
      lesson(0, "通过"),
      lesson(2, "重新学习"),
      lesson(1, "通过"),
    ])

    expect(summary.recommendedDay).toBe(2)
  })

  it("全部通过时不再推荐课程", () => {
    expect(
      summarizeProgress([lesson(0, "通过"), lesson(1, "通过")])
        .recommendedDay
    ).toBeNull()
  })

  it("空课程数据返回零进度", () => {
    const summary = summarizeProgress([])
    expect(summary.total).toBe(0)
    expect(summary.percentage).toBe(0)
  })

  it("按阶段返回分进度与阶段内推荐 Day", () => {
    const stages: CourseStage[] = [
      {
        id: "stage-1",
        order: 1,
        title: "基础",
        description: "基础阶段",
        startDay: 0,
        endDay: 1,
        lessonDays: [0, 1],
      },
      {
        id: "stage-2",
        order: 2,
        title: "服务",
        description: "服务阶段",
        startDay: 2,
        endDay: 3,
        lessonDays: [2, 3],
      },
    ]

    expect(
      summarizeStageProgress(stages, [
        lesson(0, "通过"),
        lesson(1, "重新学习"),
        lesson(2, "通过"),
        lesson(3, "通过"),
      ])
    ).toEqual([
      {
        stageId: "stage-1",
        completed: 1,
        total: 2,
        percentage: 50,
        recommendedDay: 1,
      },
      {
        stageId: "stage-2",
        completed: 2,
        total: 2,
        percentage: 100,
        recommendedDay: null,
      },
    ])
  })
})
