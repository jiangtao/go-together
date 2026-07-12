import { describe, expect, it } from "vitest"

import { buildRoadmapLayout } from "@/components/roadmap/layout"
import type { CourseLesson, CourseStage } from "@/types/course"

const STAGE_RANGES = [
  [0, 6],
  [7, 12],
  [13, 18],
  [19, 22],
  [23, 28],
  [29, 36],
] as const

const stages: CourseStage[] = STAGE_RANGES.map(([startDay, endDay], index) => ({
  id: `stage-${index + 1}`,
  order: index + 1,
  title: `阶段 ${index + 1}`,
  description: `Day ${startDay}–${endDay}`,
  startDay,
  endDay,
  lessonDays: Array.from(
    { length: endDay - startDay + 1 },
    (_, offset) => startDay + offset
  ),
}))

const lessons: CourseLesson[] = Array.from({ length: 37 }, (_, day) => {
  const stage = stages.find(
    (candidate) => day >= candidate.startDay && day <= candidate.endDay
  )!
  return {
    id: `day-${String(day).padStart(2, "0")}`,
    day,
    dayLabel: `Day ${day}`,
    title: `课程 ${day}`,
    englishTitle: null,
    objective: `完成 Day ${day}`,
    goals: [`完成 Day ${day}`],
    stageId: stage.id,
    lessonPath: `docs/day-${day}.md`,
    exercisePath: `exercise/day${day}`,
    evaluationPath: `exercise/day${day}/notes-eval.md`,
    evaluationSourceExists: false,
    resources: [
      {
        kind: "lesson",
        label: "课程 Markdown",
        path: `docs/day-${day}.md`,
        href: `/sources/docs/day-${day}.md`,
        exists: true,
      },
      {
        kind: "notes",
        label: "学习笔记",
        path: `exercise/day${day}/notes.md`,
        href: `/sources/exercise/day${day}/notes.md`,
        exists: false,
      },
      {
        kind: "evaluation",
        label: "评测文件",
        path: `exercise/day${day}/notes-eval.md`,
        href: `/sources/exercise/day${day}/notes-eval.md`,
        exists: false,
      },
    ],
    status: day === 0 ? "通过" : "未开始",
    referenceScore: null,
  }
})

function topLevelRectangles(layout: ReturnType<typeof buildRoadmapLayout>) {
  return layout.nodes
    .filter((node) => node.type !== "lesson")
    .map((node) => ({
      id: node.id,
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + Number(node.style?.width ?? 0),
      bottom: node.position.y + Number(node.style?.height ?? 0),
    }))
}

describe("总分结构化路线布局", () => {
  it("建立一个总节点、三条主干和六个非纵向堆叠阶段簇", () => {
    const layout = buildRoadmapLayout({
      stages,
      lessons,
      isMobile: false,
      selectedDay: 0,
      recommendedDay: 1,
    })
    const overviewNodes = layout.nodes.filter(
      (node) => String(node.type) === "overview"
    )
    const stageNodes = layout.nodes.filter((node) => node.type === "stage")

    expect(overviewNodes).toHaveLength(4)
    expect(stageNodes).toHaveLength(6)
    expect(new Set(stageNodes.map((node) => node.position.x)).size).toBe(3)
    expect(new Set(stageNodes.map((node) => node.position.y)).size).toBe(2)

    const structuralEdges = layout.edges.filter(
      (edge) =>
        (edge.data as { kind?: string } | undefined)?.kind === "structure"
    )
    const learningEdges = layout.edges.filter(
      (edge) =>
        (edge.data as { kind?: string } | undefined)?.kind === "learning"
    )
    expect(structuralEdges).toHaveLength(9)
    expect(learningEdges).toHaveLength(36)
    expect(structuralEdges.every((edge) => edge.animated)).toBe(true)
    expect(learningEdges.some((edge) => edge.animated)).toBe(false)

    const crossStageEdges = learningEdges.filter(
      (edge) => edge.className === "roadmap-cross-stage-edge"
    )
    expect(crossStageEdges.map((edge) => edge.id)).toEqual([
      "path-6-7",
      "path-12-13",
      "path-18-19",
      "path-22-23",
      "path-28-29",
    ])
    expect(
      learningEdges.filter((edge) => edge.className === undefined)
    ).toHaveLength(31)
  })

  it("桌面与移动布局的总节点、主干和阶段簇均不互相重叠", () => {
    for (const isMobile of [false, true]) {
      const rectangles = topLevelRectangles(
        buildRoadmapLayout({
          stages,
          lessons,
          isMobile,
          selectedDay: 0,
          recommendedDay: 1,
        })
      )

      for (let left = 0; left < rectangles.length; left += 1) {
        for (let right = left + 1; right < rectangles.length; right += 1) {
          const first = rectangles[left]
          const second = rectangles[right]
          const overlapWidth =
            Math.min(first.right, second.right) -
            Math.max(first.left, second.left)
          const overlapHeight =
            Math.min(first.bottom, second.bottom) -
            Math.max(first.top, second.top)
          expect(
            overlapWidth > 0 && overlapHeight > 0,
            `${first.id} 与 ${second.id} 不应重叠`
          ).toBe(false)
        }
      }
    }
  })
})
