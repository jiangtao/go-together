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
  nodeWidth: number
  nodeHeight: number
  columnGap: number
  rowGap: number
  bottomPadding: number
  rootWidth: number
  rootHeight: number
  rootY: number
  stageTopY: number
  stageColumnGap: number
  stageWithinLevelGap: number
  stageLevelGap: number
  extensionLevelGap: number
  stageWidthStep: number
  focusZoom: number
  openingZoom: number
}

interface PositionedLesson {
  node: LessonFlowNode
  absolutePosition: XYPosition
}

interface PositionedStage {
  node: StageFlowNode
  absolutePosition: XYPosition
}

interface StagePlacement {
  x: number
  y: number
  width: number
  height: number
  level: number
  totalLevels: number
  levelLabel: string
  levelKind: "core" | "extension"
}

interface StageLevel {
  label: string
  kind: "core" | "extension"
  stages: RoadmapStage[]
}

export interface RoadmapLayout {
  nodes: RoadmapNode[]
  edges: RoadmapEdge[]
  focus: XYPosition & { zoom: number }
  initialViewport: "whole" | "focus"
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
  lessonColumns: 4,
  groupWidth: 782,
  headerHeight: 112,
  nodeWidth: 170,
  nodeHeight: 116,
  columnGap: 18,
  rowGap: 18,
  bottomPadding: 24,
  rootWidth: 300,
  rootHeight: 96,
  rootY: 0,
  stageTopY: 184,
  stageColumnGap: 64,
  stageWithinLevelGap: 48,
  stageLevelGap: 112,
  extensionLevelGap: 160,
  stageWidthStep: 0,
  focusZoom: 0.84,
  openingZoom: 0.72,
}

const MOBILE_SETTINGS: LayoutSettings = {
  lessonColumns: 2,
  groupWidth: 376,
  headerHeight: 120,
  nodeWidth: 160,
  nodeHeight: 120,
  columnGap: 16,
  rowGap: 16,
  bottomPadding: 24,
  rootWidth: 280,
  rootHeight: 100,
  rootY: 0,
  stageTopY: 188,
  stageColumnGap: 0,
  stageWithinLevelGap: 48,
  stageLevelGap: 88,
  extensionLevelGap: 120,
  stageWidthStep: 24,
  focusZoom: 0.88,
  openingZoom: 0.88,
}

function percentage(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

function progressiveLevelSizes(total: number): number[] {
  if (total <= 0) return []
  if (total <= 2) return [total]

  let levelCount = total <= 5 ? 2 : total <= 11 ? 3 : Math.ceil(total / 4)
  if (total === levelCount * 4) {
    levelCount += 1
  }

  const base = Math.floor(total / levelCount)
  const remainder = total % levelCount
  const sizes = Array.from({ length: levelCount }, (_, index) =>
    index >= levelCount - remainder ? base + 1 : base
  )
  if (
    sizes.length > 1 &&
    sizes.every((size) => size === sizes[0]) &&
    sizes[0] > 1 &&
    sizes.at(-1)! < 4
  ) {
    sizes[0] -= 1
    sizes[sizes.length - 1] += 1
  }
  return sizes
}

function coreLevelLabel(index: number, total: number): string {
  if (total === 1) return "核心主线"
  if (index === 0) return "基础建模"
  if (index === total - 1) return "深入优化"
  return total === 3 ? "经典结构" : `进阶建模 ${index}`
}

function buildStageLevels(
  tracks: RoadmapTrack[],
  stages: RoadmapStage[]
): StageLevel[] {
  const lastTrack = tracks.at(-1)
  const extensionTrackId =
    lastTrack && /\bagent\b/i.test(`${lastTrack.id} ${lastTrack.title}`)
      ? lastTrack.id
      : null
  const coreStages = stages.filter(
    (stage) => stage.trackId !== extensionTrackId
  )
  const extensionStages = stages.filter(
    (stage) => stage.trackId === extensionTrackId
  )
  const coreSizes = progressiveLevelSizes(coreStages.length)
  let offset = 0
  const levels = coreSizes.map((size, index): StageLevel => {
    const level = {
      label: coreLevelLabel(index, coreSizes.length),
      kind: "core" as const,
      stages: coreStages.slice(offset, offset + size),
    }
    offset += size
    return level
  })

  if (extensionStages.length > 0) {
    levels.push({
      label: "Agent 进阶",
      kind: "extension",
      stages: extensionStages,
    })
  }
  return levels
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
  source: { absolutePosition: XYPosition },
  target: { absolutePosition: XYPosition }
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
    className: "roadmap-structure-edge",
    data: { kind: "structure" },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: "var(--roadmap-structure-edge)",
    },
    style: {
      stroke: "var(--roadmap-structure-edge)",
      strokeWidth: 1.6,
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
  const stageLevels = buildStageLevels(tracks, stages)
  const graphWidth = Math.max(
    settings.rootWidth,
    ...stageLevels.map((level, index) =>
      isMobile
        ? settings.groupWidth + index * settings.stageWidthStep
        : level.stages.length * settings.groupWidth +
          Math.max(0, level.stages.length - 1) * settings.stageColumnGap
    )
  )
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
      eyebrow: `由浅入深 · ${stageLevels.length} 层 · ${stages.length} 个阶段`,
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

  const stagePlacements = new Map<string, StagePlacement>()
  let nextStageY = settings.stageTopY
  for (const [levelIndex, level] of stageLevels.entries()) {
    if (isMobile) {
      const width = settings.groupWidth + levelIndex * settings.stageWidthStep
      for (const stage of level.stages) {
        const height = stageHeight(stage, settings)
        stagePlacements.set(stage.id, {
          x: (graphWidth - width) / 2,
          y: nextStageY,
          width,
          height,
          level: levelIndex + 1,
          totalLevels: stageLevels.length,
          levelLabel: level.label,
          levelKind: level.kind,
        })
        nextStageY += height + settings.stageWithinLevelGap
      }
      nextStageY -= settings.stageWithinLevelGap
    } else {
      const rowWidth =
        level.stages.length * settings.groupWidth +
        Math.max(0, level.stages.length - 1) * settings.stageColumnGap
      const rowX = (graphWidth - rowWidth) / 2
      const heights = level.stages.map((stage) => stageHeight(stage, settings))
      level.stages.forEach((stage, index) => {
        const visualIndex =
          levelIndex % 2 === 0 ? index : level.stages.length - 1 - index
        stagePlacements.set(stage.id, {
          x:
            rowX +
            visualIndex * (settings.groupWidth + settings.stageColumnGap),
          y: nextStageY,
          width: settings.groupWidth,
          height: heights[index],
          level: levelIndex + 1,
          totalLevels: stageLevels.length,
          levelLabel: level.label,
          levelKind: level.kind,
        })
      })
      nextStageY += Math.max(...heights, 0)
    }

    const nextLevel = stageLevels[levelIndex + 1]
    if (nextLevel) {
      nextStageY +=
        nextLevel.kind === "extension"
          ? settings.extensionLevelGap
          : settings.stageLevelGap
    }
  }

  const stageNodes: StageFlowNode[] = []
  const positionedStages: PositionedStage[] = []
  const positionedLessons: PositionedLesson[] = []
  const trackById = new Map(tracks.map((track) => [track.id, track]))

  for (const stage of stages) {
    const placement = stagePlacements.get(stage.id)
    if (!placement) {
      throw new Error(`阶段 ${stage.id} 未分配到路线主干`)
    }
    const stageLessons = lessons.filter((lesson) => lesson.stageId === stage.id)
    const completed = stageLessons.filter(
      (lesson) => lesson.status === "通过"
    ).length

    const stageNode: StageFlowNode = {
      id: roadmapStageNodeId(stage.id),
      type: "stage",
      position: { x: placement.x, y: placement.y },
      data: {
        stage,
        trackTitle: trackById.get(stage.trackId)?.title ?? "课程主题",
        level: placement.level,
        totalLevels: placement.totalLevels,
        levelLabel: placement.levelLabel,
        levelKind: placement.levelKind,
        lessons: stageLessons,
        completed,
        total: stageLessons.length,
        percentage: percentage(completed, stageLessons.length),
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
      },
      style: { width: placement.width, height: placement.height },
      selectable: false,
      draggable: false,
      focusable: false,
    }
    stageNodes.push(stageNode)
    positionedStages.push({
      node: stageNode,
      absolutePosition: { x: placement.x, y: placement.y },
    })

    stageLessons.forEach((lesson, index) => {
      const row = Math.floor(index / settings.lessonColumns)
      const sequentialColumn = index % settings.lessonColumns
      const column =
        row % 2 === 1
          ? settings.lessonColumns - 1 - sequentialColumn
          : sequentialColumn
      const lessonGridWidth =
        settings.lessonColumns * settings.nodeWidth +
        Math.max(0, settings.lessonColumns - 1) * settings.columnGap
      const x =
        (placement.width - lessonGridWidth) / 2 +
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

  const structureEdges: RoadmapEdge[] = []
  const firstStage = positionedStages[0]
  if (firstStage) {
    structureEdges.push(structuralEdge(rootId, firstStage.node.id))
  }
  for (let index = 0; index < positionedStages.length - 1; index += 1) {
    const source = positionedStages[index]
    const target = positionedStages[index + 1]
    const positions = connectionPositions(source, target)
    source.node.data.sourcePosition = positions.source
    target.node.data.targetPosition = positions.target
    structureEdges.push(structuralEdge(source.node.id, target.node.id))
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
  for (const stage of stages) {
    const stageLessons = positionedLessons.filter(
      (positioned) => positioned.node.data.lesson.stageId === stage.id
    )
    for (let index = 0; index < stageLessons.length - 1; index += 1) {
      const source = stageLessons[index]
      const target = stageLessons[index + 1]
      const positions = connectionPositions(source, target)
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
  }

  const focusLessonId = recommendedLessonId ?? lessons.at(-1)?.lessonId
  const focusLesson =
    positionedLessons.find(
      (positioned) => positioned.node.data.lesson.lessonId === focusLessonId
    ) ?? positionedLessons[0]
  const focusStage = focusLesson
    ? stagePlacements.get(focusLesson.node.data.lesson.stageId)
    : undefined
  const focus = focusLesson
    ? focusStage?.level === 1
      ? isMobile
        ? {
          x: graphWidth / 2,
          y:
              (settings.rootY + settings.rootHeight + focusStage.y) /
              2,
          zoom: settings.openingZoom,
        }
        : {
          x: graphWidth / 2,
          y:
            (settings.rootY +
              settings.rootHeight +
              focusStage.y +
              focusStage.height) /
            2,
          zoom: settings.openingZoom,
        }
      : {
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
      ...stageNodes,
      ...positionedLessons.map(({ node }) => node),
    ],
    edges: [...structureEdges, ...learningEdges],
    focus,
    initialViewport: stageLevels.length === 1 ? "whole" : "focus",
  }
}
