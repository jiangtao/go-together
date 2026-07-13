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
    lessonHref: `/sources/lessons/day-${String(day).padStart(2, "0")}-course.md`,
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

  it("桌面与移动的全部 Day 均包含在阶段簇内并保留课程阅读回调", () => {
    const onOpenCourse = () => undefined

    for (const isMobile of [false, true]) {
      const layout = buildRoadmapLayout({
        stages,
        lessons,
        isMobile,
        selectedDay: 0,
        recommendedDay: 1,
        onOpenCourse,
      })
      const stageNodes = new Map(
        layout.nodes
          .filter((node) => node.type === "stage")
          .map((node) => [node.id, node])
      )
      const lessonNodes = layout.nodes.filter(
        (node) => node.type === "lesson"
      )

      expect(lessonNodes).toHaveLength(37)
      for (const lessonNode of lessonNodes) {
        const stageNode = stageNodes.get(lessonNode.parentId ?? "")
        expect(stageNode, `${lessonNode.id} 应属于一个阶段簇`).toBeDefined()
        expect(lessonNode.data.onOpenCourse).toBe(onOpenCourse)
        expect(lessonNode.position.x).toBeGreaterThanOrEqual(0)
        expect(lessonNode.position.y).toBeGreaterThanOrEqual(0)
        expect(
          lessonNode.position.x + Number(lessonNode.style?.width ?? 0)
        ).toBeLessThanOrEqual(Number(stageNode?.style?.width ?? 0))
        expect(
          lessonNode.position.y + Number(lessonNode.style?.height ?? 0)
        ).toBeLessThanOrEqual(Number(stageNode?.style?.height ?? 0))
      }
    }
  })

  it("概览状态不默认选中任何 Day", () => {
    const layout = buildRoadmapLayout({
      stages,
      lessons,
      isMobile: false,
      selectedDay: null,
      recommendedDay: 1,
    })
    const lessonNodes = layout.nodes.filter((node) => node.type === "lesson")

    expect(lessonNodes.every((node) => node.selected === false)).toBe(true)
    expect(
      lessonNodes.every((node) => !node.ariaLabel?.includes("当前选中"))
    ).toBe(true)
  })
})
