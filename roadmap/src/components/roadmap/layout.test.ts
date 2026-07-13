import { describe, expect, it } from "vitest"

import { buildRoadmapLayout } from "@/components/roadmap/layout"
import type {
  RoadmapLesson,
  RoadmapStage,
  RoadmapTrack,
} from "@/types/course"

const STAGE_RANGES = [
  [0, 6],
  [7, 12],
  [13, 18],
  [19, 22],
  [23, 28],
  [29, 36],
] as const

const tracks: RoadmapTrack[] = Array.from({ length: 3 }, (_, index) => ({
  id: `track-${index + 1}`,
  order: index + 1,
  title: `主干 ${index + 1}`,
  description: `主干 ${index + 1}`,
  stageIds: [`stage-${index * 2 + 1}`, `stage-${index * 2 + 2}`],
}))

const stages: RoadmapStage[] = STAGE_RANGES.map(([startDay, endDay], index) => ({
  id: `stage-${index + 1}`,
  trackId: `track-${Math.floor(index / 2) + 1}`,
  order: (index % 2) + 1,
  title: `阶段 ${index + 1}`,
  description: `Day ${startDay}–${endDay}`,
  lessonIds: Array.from(
    { length: endDay - startDay + 1 },
    (_, offset) => `day-${String(startDay + offset).padStart(2, "0")}`
  ),
}))

const lessons: RoadmapLesson[] = Array.from({ length: 37 }, (_, day) => {
  const lessonId = `day-${String(day).padStart(2, "0")}`
  const stage = stages.find((candidate) => candidate.lessonIds.includes(lessonId))!
  return {
    courseId: "go-backend",
    lessonId,
    lifecycle: "active",
    day,
    label: `Day ${day}`,
    title: `课程 ${day}`,
    objective: `完成 Day ${day}`,
    goals: [`完成 Day ${day}`],
    trackId: stage.trackId,
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
  it("从任意 Track/Stage/Lesson 结构生成无 Day 路线", () => {
    const genericTracks: RoadmapTrack[] = [
      {
        id: "language-model",
        order: 1,
        title: "语言模型",
        description: "理解 Python 语义",
        stageIds: ["functions", "objects"],
      },
    ]
    const genericStages: RoadmapStage[] = [
      {
        id: "functions",
        trackId: "language-model",
        order: 1,
        title: "函数",
        description: "函数与装饰器",
        lessonIds: ["functions", "decorators"],
      },
      {
        id: "objects",
        trackId: "language-model",
        order: 2,
        title: "对象",
        description: "对象模型",
        lessonIds: ["data-model"],
      },
    ]
    const genericLessons: RoadmapLesson[] = genericStages.flatMap((stage) =>
      stage.lessonIds.map((lessonId, index) => ({
        courseId: "python-core",
        lessonId,
        lifecycle: "active",
        day: null,
        label: `课次 ${index + 1}`,
        title: lessonId,
        objective: "掌握语义",
        goals: ["解释行为"],
        trackId: stage.trackId,
        stageId: stage.id,
        status: "未开始",
        referenceScore: null,
        lessonHref: `/courses/python-core/sources/lessons/${lessonId}.md`,
      }))
    )

    const layout = buildRoadmapLayout({
      courseTitle: "Python Core",
      courseDescription: "Python 语言基础",
      tracks: genericTracks,
      stages: genericStages,
      lessons: genericLessons,
      isMobile: false,
      selectedLessonId: null,
      recommendedLessonId: "functions",
    })

    expect(layout.nodes.filter((node) => node.type === "overview")).toHaveLength(2)
    expect(layout.nodes.filter((node) => node.type === "stage")).toHaveLength(2)
    expect(layout.nodes.filter((node) => node.type === "lesson")).toHaveLength(3)
    expect(layout.edges.filter((edge) => edge.data?.kind === "learning")).toHaveLength(2)
  })

  it("为跨类型同名领域 ID 分配独立 React Flow 命名空间", () => {
    const layout = buildRoadmapLayout({
      courseTitle: "Collision Course",
      courseDescription: "合法的跨类型同名 ID",
      tracks: [
        {
          id: "roadmap-overview",
          order: 1,
          title: "同名 Track",
          description: "Track",
          stageIds: ["shared"],
        },
      ],
      stages: [
        {
          id: "shared",
          trackId: "roadmap-overview",
          order: 1,
          title: "同名 Stage",
          description: "Stage",
          lessonIds: ["shared"],
        },
      ],
      lessons: [
        {
          courseId: "collision-course",
          lessonId: "shared",
          lifecycle: "active",
          day: null,
          label: "课次 1",
          title: "同名 Lesson",
          objective: "保持图身份唯一",
          goals: ["节点不冲突"],
          trackId: "roadmap-overview",
          stageId: "shared",
          status: "未开始",
          referenceScore: null,
          lessonHref:
            "/courses/collision-course/sources/lessons/shared.md",
        },
      ],
      isMobile: false,
      selectedLessonId: null,
      recommendedLessonId: "shared",
    })

    expect(new Set(layout.nodes.map((node) => node.id)).size).toBe(
      layout.nodes.length
    )
  })

  it("为可产生相同连字符拼接结果的 Lesson tuple 分配唯一边 ID", () => {
    const lessonIds = ["a-b", "c", "x", "a", "b-c"]
    const collisionLessons: RoadmapLesson[] = lessonIds.map(
      (lessonId, index) => ({
        courseId: "edge-collision-course",
        lessonId,
        lifecycle: "active",
        day: null,
        label: `课次 ${index + 1}`,
        title: lessonId,
        objective: "保持学习边身份唯一",
        goals: ["边不冲突"],
        trackId: "track",
        stageId: "stage",
        status: "未开始",
        referenceScore: null,
        lessonHref: `/courses/edge-collision-course/sources/lessons/${lessonId}.md`,
      })
    )
    const layout = buildRoadmapLayout({
      courseTitle: "Edge Collision Course",
      courseDescription: "合法的边 tuple 碰撞样例",
      tracks: [
        {
          id: "track",
          order: 1,
          title: "Track",
          description: "Track",
          stageIds: ["stage"],
        },
      ],
      stages: [
        {
          id: "stage",
          trackId: "track",
          order: 1,
          title: "Stage",
          description: "Stage",
          lessonIds,
        },
      ],
      lessons: collisionLessons,
      isMobile: false,
      selectedLessonId: null,
      recommendedLessonId: null,
    })
    const learningEdges = layout.edges.filter(
      (edge) => edge.data?.kind === "learning"
    )

    expect(new Set(learningEdges.map((edge) => edge.id)).size).toBe(
      learningEdges.length
    )
  })

  it("建立一个总节点、三条主干和六个非纵向堆叠阶段簇", () => {
    const layout = buildRoadmapLayout({
      courseTitle: "Go 36 天实战",
      courseDescription: "Go 后端学习路线",
      tracks,
      stages,
      lessons,
      isMobile: false,
      selectedLessonId: "day-00",
      recommendedLessonId: "day-01",
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
      "path-6:day-06-6:day-07",
      "path-6:day-12-6:day-13",
      "path-6:day-18-6:day-19",
      "path-6:day-22-6:day-23",
      "path-6:day-28-6:day-29",
    ])
    expect(
      learningEdges.filter((edge) => edge.className === undefined)
    ).toHaveLength(31)
  })

  it("桌面与移动布局的总节点、主干和阶段簇均不互相重叠", () => {
    for (const isMobile of [false, true]) {
      const rectangles = topLevelRectangles(
        buildRoadmapLayout({
          courseTitle: "Go 36 天实战",
          courseDescription: "Go 后端学习路线",
          tracks,
          stages,
          lessons,
          isMobile,
          selectedLessonId: "day-00",
          recommendedLessonId: "day-01",
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
        courseTitle: "Go 36 天实战",
        courseDescription: "Go 后端学习路线",
        tracks,
        stages,
        lessons,
        isMobile,
        selectedLessonId: "day-00",
        recommendedLessonId: "day-01",
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
      courseTitle: "Go 36 天实战",
      courseDescription: "Go 后端学习路线",
      tracks,
      stages,
      lessons,
      isMobile: false,
      selectedLessonId: null,
      recommendedLessonId: "day-01",
    })
    const lessonNodes = layout.nodes.filter((node) => node.type === "lesson")

    expect(lessonNodes.every((node) => node.selected === false)).toBe(true)
    expect(
      lessonNodes.every((node) => !node.ariaLabel?.includes("当前选中"))
    ).toBe(true)
  })
})
