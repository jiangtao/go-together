import {
  MarkerType,
  Position,
  type Edge,
  type XYPosition,
} from "@xyflow/react"

import type { LessonFlowNode } from "@/components/roadmap/lesson-node"
import type { OverviewFlowNode } from "@/components/roadmap/overview-node"
import type { StageFlowNode } from "@/components/roadmap/stage-node"
import type {
  RoadmapLesson,
  RoadmapStage,
  RoadmapTrack,
} from "@/types/course"

export type RoadmapNode = OverviewFlowNode | StageFlowNode | LessonFlowNode
export type RoadmapEdgeKind = "structure" | "learning"
export type RoadmapEdge = Edge<{ kind: RoadmapEdgeKind }, "smoothstep">

interface LayoutSettings {
  lessonColumns: number
  groupWidth: number
  headerHeight: number
  horizontalPadding: number
  nodeWidth: number
  nodeHeight: number
  columnGap: number
  rowGap: number
  bottomPadding: number
  trackGap: number
  rootWidth: number
  rootHeight: number
  trackWidth: number
  trackHeight: number
  rootY: number
  trackY: number
  stageTopY: number
  stageRowGap: number
  focusZoom: number
}

interface PositionedLesson {
  node: LessonFlowNode
  absolutePosition: XYPosition
}

interface StagePlacement {
  x: number
  y: number
  height: number
}

export interface RoadmapLayout {
  nodes: RoadmapNode[]
  edges: RoadmapEdge[]
  focus: XYPosition & { zoom: number }
}

export function roadmapTrackNodeId(trackId: string): string {
  return `track:${trackId}`
}

export function roadmapStageNodeId(stageId: string): string {
  return `stage:${stageId}`
}

export function roadmapLessonNodeId(lessonId: string): string {
  return `lesson:${lessonId}`
}

function learningEdgeId(sourceLessonId: string, targetLessonId: string): string {
  return `path-${sourceLessonId.length}:${sourceLessonId}-${targetLessonId.length}:${targetLessonId}`
}

const DESKTOP_SETTINGS: LayoutSettings = {
  lessonColumns: 3,
  groupWidth: 594,
  headerHeight: 96,
  horizontalPadding: 24,
  nodeWidth: 170,
  nodeHeight: 116,
  columnGap: 18,
  rowGap: 18,
  bottomPadding: 24,
  trackGap: 100,
  rootWidth: 300,
  rootHeight: 96,
  trackWidth: 240,
  trackHeight: 84,
  rootY: 0,
  trackY: 152,
  stageTopY: 304,
  stageRowGap: 110,
  focusZoom: 0.84,
}

const MOBILE_SETTINGS: LayoutSettings = {
  lessonColumns: 2,
  groupWidth: 376,
  headerHeight: 104,
  horizontalPadding: 20,
  nodeWidth: 160,
  nodeHeight: 120,
  columnGap: 16,
  rowGap: 16,
  bottomPadding: 24,
  trackGap: 48,
  rootWidth: 280,
  rootHeight: 100,
  trackWidth: 208,
  trackHeight: 88,
  rootY: 0,
  trackY: 160,
  stageTopY: 320,
  stageRowGap: 100,
  focusZoom: 0.88,
}

function percentage(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

function stageHeight(
  stage: RoadmapStage,
  settings: LayoutSettings
): number {
  const rows = Math.ceil(stage.lessonIds.length / settings.lessonColumns)
  return (
    settings.headerHeight +
    rows * settings.nodeHeight +
    Math.max(0, rows - 1) * settings.rowGap +
    settings.bottomPadding
  )
}

function connectionPositions(
  source: PositionedLesson,
  target: PositionedLesson
): { source: Position; target: Position } {
  const horizontalDelta =
    target.absolutePosition.x - source.absolutePosition.x
  const verticalDelta = target.absolutePosition.y - source.absolutePosition.y

  if (Math.abs(verticalDelta) > 48) {
    return verticalDelta >= 0
      ? { source: Position.Bottom, target: Position.Top }
      : { source: Position.Top, target: Position.Bottom }
  }

  return horizontalDelta >= 0
    ? { source: Position.Right, target: Position.Left }
    : { source: Position.Left, target: Position.Right }
}

function structuralEdge(
  source: string,
  target: string,
  id = `structure-${source}-${target}`
): RoadmapEdge {
  return {
    id,
    type: "smoothstep",
    source,
    target,
    animated: true,
    className: "roadmap-structure-edge",
    data: { kind: "structure" },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 13,
      height: 13,
      color: "var(--roadmap-structure-edge)",
    },
    style: {
      stroke: "var(--roadmap-structure-edge)",
      strokeWidth: 1.4,
    },
    selectable: false,
    focusable: false,
  }
}

export function buildRoadmapLayout({
  courseTitle,
  courseDescription,
  tracks,
  stages,
  lessons,
  isMobile,
  selectedLessonId,
  recommendedLessonId,
  onOpenCourse = () => undefined,
}: {
  courseTitle: string
  courseDescription: string
  tracks: RoadmapTrack[]
  stages: RoadmapStage[]
  lessons: RoadmapLesson[]
  isMobile: boolean
  selectedLessonId: string | null
  recommendedLessonId: string | null
  onOpenCourse?: (lesson: RoadmapLesson, trigger: HTMLElement) => void
}): RoadmapLayout {
  const settings = isMobile ? MOBILE_SETTINGS : DESKTOP_SETTINGS
  const graphWidth =
    tracks.length * settings.groupWidth +
    Math.max(0, tracks.length - 1) * settings.trackGap
  const rootId = "roadmap:root"
  const completedLessons = lessons.filter(
    (lesson) => lesson.status === "通过"
  ).length
  const rootNode: OverviewFlowNode = {
    id: rootId,
    type: "overview",
    position: {
      x: (graphWidth - settings.rootWidth) / 2,
      y: settings.rootY,
    },
    style: { width: settings.rootWidth, height: settings.rootHeight },
    data: {
      variant: "root",
      eyebrow: `${tracks.length} 条主干 · ${stages.length} 个阶段 · ${lessons.length} 个课次`,
      title: courseTitle,
      description: courseDescription,
      completed: completedLessons,
      total: lessons.length,
      percentage: percentage(completedLessons, lessons.length),
      testId: "roadmap-root",
    },
    draggable: false,
    selectable: false,
    focusable: false,
  }

  const stageRows = Math.max(...tracks.map((track) => track.stageIds.length))
  const stageRowY: number[] = []
  let nextStageY = settings.stageTopY
  for (let row = 0; row < stageRows; row += 1) {
    stageRowY.push(nextStageY)
    const rowHeight = Math.max(
      ...tracks.map((track) => {
        const stageId = track.stageIds[row]
        const stage = stages.find((candidate) => candidate.id === stageId)
        return stage ? stageHeight(stage, settings) : 0
      })
    )
    nextStageY += rowHeight + settings.stageRowGap
  }
  const stagePlacements = new Map<string, StagePlacement>()
  const trackNodes: OverviewFlowNode[] = []
  const structureEdges: RoadmapEdge[] = []

  tracks.forEach((track, trackIndex) => {
    const groupX = trackIndex * (settings.groupWidth + settings.trackGap)
    const trackLessons = lessons.filter((lesson) =>
      track.stageIds.includes(lesson.stageId)
    )
    const trackCompleted = trackLessons.filter(
      (lesson) => lesson.status === "通过"
    ).length
    trackNodes.push({
      id: roadmapTrackNodeId(track.id),
      type: "overview",
      position: {
        x: groupX + (settings.groupWidth - settings.trackWidth) / 2,
        y: settings.trackY,
      },
      style: { width: settings.trackWidth, height: settings.trackHeight },
      data: {
        variant: "track",
        eyebrow: `主干 ${trackIndex + 1}`,
        title: track.title,
        description: track.description,
        completed: trackCompleted,
        total: trackLessons.length,
        percentage: percentage(trackCompleted, trackLessons.length),
        testId: `roadmap-track-${trackIndex + 1}`,
      },
      draggable: false,
      selectable: false,
      focusable: false,
    })
    structureEdges.push(structuralEdge(rootId, roadmapTrackNodeId(track.id)))

    track.stageIds.forEach((stageId, stageIndex) => {
      const stage = stages.find((candidate) => candidate.id === stageId)
      if (!stage) {
        return
      }
      stagePlacements.set(stageId, {
        x: groupX,
        y: stageRowY[stageIndex],
        height: stageHeight(stage, settings),
      })
    })

    if (track.stageIds[0]) {
      structureEdges.push(
        structuralEdge(
          roadmapTrackNodeId(track.id),
          roadmapStageNodeId(track.stageIds[0])
        )
      )
    }
    for (let index = 0; index < track.stageIds.length - 1; index += 1) {
      structureEdges.push(
        structuralEdge(
          roadmapStageNodeId(track.stageIds[index]),
          roadmapStageNodeId(track.stageIds[index + 1])
        )
      )
    }
  })

  const stageNodes: StageFlowNode[] = []
  const positionedLessons: PositionedLesson[] = []

  for (const stage of stages) {
    const placement = stagePlacements.get(stage.id)
    if (!placement) {
      throw new Error(`阶段 ${stage.id} 未分配到路线主干`)
    }
    const stageLessons = lessons.filter((lesson) => lesson.stageId === stage.id)
    const completed = stageLessons.filter(
      (lesson) => lesson.status === "通过"
    ).length

    stageNodes.push({
      id: roadmapStageNodeId(stage.id),
      type: "stage",
      position: { x: placement.x, y: placement.y },
      data: {
        stage,
        lessons: stageLessons,
        completed,
        total: stageLessons.length,
        percentage: percentage(completed, stageLessons.length),
      },
      style: { width: settings.groupWidth, height: placement.height },
      selectable: false,
      draggable: false,
      focusable: false,
    })

    stageLessons.forEach((lesson, index) => {
      const row = Math.floor(index / settings.lessonColumns)
      const sequentialColumn = index % settings.lessonColumns
      const column =
        row % 2 === 1
          ? settings.lessonColumns - 1 - sequentialColumn
          : sequentialColumn
      const x =
        settings.horizontalPadding +
        column * (settings.nodeWidth + settings.columnGap)
      const y =
        settings.headerHeight + row * (settings.nodeHeight + settings.rowGap)
      const node: LessonFlowNode = {
        id: roadmapLessonNodeId(lesson.lessonId),
        type: "lesson",
        parentId: roadmapStageNodeId(stage.id),
        extent: "parent",
        position: { x, y },
        style: { width: settings.nodeWidth, height: settings.nodeHeight },
        data: {
          lesson,
          recommended: lesson.lessonId === recommendedLessonId,
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
          onOpenCourse,
        },
        selected: lesson.lessonId === selectedLessonId,
        draggable: false,
        selectable: true,
        focusable: true,
        ariaLabel: [
          `${lesson.label} ${lesson.title}`,
          `状态 ${lesson.status}`,
          lesson.lessonId === selectedLessonId ? "当前选中" : null,
          lesson.lessonId === recommendedLessonId ? "推荐课程" : null,
          "按 Enter 或空格查看详情",
        ]
          .filter(Boolean)
          .join("，"),
      }
      positionedLessons.push({
        node,
        absolutePosition: {
          x: placement.x + x,
          y: placement.y + y,
        },
      })
    })
  }

  const lessonOrder = new Map(
    lessons.map((lesson, index) => [lesson.lessonId, index])
  )
  positionedLessons.sort(
    (left, right) =>
      (lessonOrder.get(left.node.data.lesson.lessonId) ?? 0) -
      (lessonOrder.get(right.node.data.lesson.lessonId) ?? 0)
  )

  const learningEdges: RoadmapEdge[] = []
  for (let index = 0; index < positionedLessons.length - 1; index += 1) {
    const source = positionedLessons[index]
    const target = positionedLessons[index + 1]
    const positions = connectionPositions(source, target)
    const crossesStage =
      source.node.data.lesson.stageId !== target.node.data.lesson.stageId
    source.node.data.sourcePosition = positions.source
    target.node.data.targetPosition = positions.target
    learningEdges.push({
      id: learningEdgeId(
        source.node.data.lesson.lessonId,
        target.node.data.lesson.lessonId
      ),
      type: "smoothstep",
      source: source.node.id,
      target: target.node.id,
      className: crossesStage ? "roadmap-cross-stage-edge" : undefined,
      data: { kind: "learning" },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: "var(--roadmap-edge)",
      },
      style: {
        stroke: "var(--roadmap-edge)",
        strokeWidth: 1.6,
      },
      selectable: false,
      focusable: false,
    })
  }

  const focusLessonId = recommendedLessonId ?? lessons.at(-1)?.lessonId
  const focusLesson =
    positionedLessons.find(
      (positioned) => positioned.node.data.lesson.lessonId === focusLessonId
    ) ?? positionedLessons[0]
  const focus = focusLesson
    ? {
        x: focusLesson.absolutePosition.x + settings.nodeWidth / 2,
        y: focusLesson.absolutePosition.y + settings.nodeHeight / 2,
        zoom: settings.focusZoom,
      }
    : {
        x: graphWidth / 2,
        y: settings.stageTopY,
        zoom: settings.focusZoom,
      }

  return {
    nodes: [
      rootNode,
      ...trackNodes,
      ...stageNodes,
      ...positionedLessons.map(({ node }) => node),
    ],
    edges: [...structureEdges, ...learningEdges],
    focus,
  }
}
