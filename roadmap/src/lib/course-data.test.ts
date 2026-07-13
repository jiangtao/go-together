import { describe, expect, it } from "vitest"

import { parseCourseData } from "@/lib/course-data"

function validCourse() {
  const stageRanges = [
    [0, 6],
    [7, 12],
    [13, 18],
    [19, 22],
    [23, 28],
    [29, 36],
  ] as const
  const stages = stageRanges.map(([startDay, endDay], index) => ({
    id: `stage-${index + 1}`,
    order: index + 1,
    title: `阶段 ${index + 1}`,
    description: `阶段 ${index + 1} 描述`,
    startDay,
    endDay,
    lessonDays: Array.from(
      { length: endDay - startDay + 1 },
      (_, offset) => startDay + offset
    ),
  }))
  return {
    schemaVersion: 3,
    title: "Go 36 天学习路线图",
    dayRange: { start: 0, end: 36 },
    stages,
    lessons: Array.from({ length: 37 }, (_, day) => ({
      id: `day-${String(day).padStart(2, "0")}`,
      day,
      dayLabel: `Day ${day}`,
      title: `课程 ${day}`,
      englishTitle: null,
      objective: `目标 ${day}`,
      goals: [`标准 ${day}`],
      stageId: stages.find(
        (stage) => day >= stage.startDay && day <= stage.endDay
      )!.id,
      status: "未开始",
      referenceScore: null,
      lessonHref: `/sources/lessons/day-${String(day).padStart(2, "0")}-lesson.md`,
    })),
  }
}

describe("course schema v3", () => {
  it("接受完整且最小的公开课程 DTO", () => {
    expect(parseCourseData(validCourse()).lessons).toHaveLength(37)
  })

  it("拒绝旧 schema、额外字段与非课程 sources URL", () => {
    expect(() =>
      parseCourseData({ ...validCourse(), schemaVersion: 2 })
    ).toThrow("schemaVersion")

    const withPrivateField = validCourse()
    Object.assign(withPrivateField.lessons[0], {
      evaluationPath: "private/evaluation.md",
    })
    expect(() => parseCourseData(withPrivateField)).toThrow("非白名单字段")

    const withUnsafeHref = validCourse()
    withUnsafeHref.lessons[0].lessonHref = "/sources/other/day-00.md"
    expect(() => parseCourseData(withUnsafeHref)).toThrow("安全同源课程地址")
  })
})
