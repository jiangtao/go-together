import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
  type NodeTypes,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react"
import {
  ExpandIcon,
  LocateFixedIcon,
  MapPinnedIcon,
  Maximize2Icon,
  Minimize2Icon,
  NetworkIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"

import { DaySearch } from "@/components/roadmap/day-search"
import {
  buildRoadmapLayout,
  type RoadmapEdge,
  type RoadmapNode,
} from "@/components/roadmap/layout"
import { LessonNode } from "@/components/roadmap/lesson-node"
import { OverviewNode } from "@/components/roadmap/overview-node"
import { RoadmapLegend } from "@/components/roadmap/roadmap-legend"
import { StageNode } from "@/components/roadmap/stage-node"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMobile } from "@/hooks/use-mobile"
import {
  getNextZoom,
  getZoomControls,
  ROADMAP_MAX_ZOOM,
  ROADMAP_MIN_ZOOM,
  shouldAutomaticallyFit,
} from "@/lib/roadmap-viewport"
import { cn } from "@/lib/utils"
import type { CourseLesson, CourseStage } from "@/types/course"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = {
  lesson: LessonNode,
  overview: OverviewNode,
  stage: StageNode,
}

export interface RoadmapCanvasHandle {
  getViewport: () => Viewport | null
  restoreViewportAfterLayout: (viewport: Viewport) => void
  focusZenEntry: () => void
  focusZenExit: () => void
}

interface RoadmapCanvasProps {
  stages: CourseStage[]
  lessons: CourseLesson[]
  selectedDay: number | null
  recommendedDay: number | null
  zen: boolean
  surfaceIsCanvas: boolean
  onToggleZen: () => void
  onSelectDay: (day: number, trigger: HTMLElement) => void
  onOpenCourse: (lesson: CourseLesson, trigger: HTMLElement) => void
}

export const RoadmapCanvas = forwardRef<
  RoadmapCanvasHandle,
  RoadmapCanvasProps
>(function RoadmapCanvas(
  {
    stages,
    lessons,
    selectedDay,
    recommendedDay,
    zen,
    surfaceIsCanvas,
    onToggleZen,
    onSelectDay,
    onOpenCourse,
  },
  ref
) {
  const isMobile = useMobile()
  const flowInstance = useRef<
    ReactFlowInstance<RoadmapNode, RoadmapEdge> | undefined
  >(undefined)
  const initialFitComplete = useRef(false)
  const interactionRevision = useRef(0)
  const restoreFrame = useRef<number | null>(null)
  const zenEntryRef = useRef<HTMLButtonElement>(null)
  const zenExitRef = useRef<HTMLButtonElement>(null)
  const [viewportZoom, setViewportZoom] = useState(1)
  const layout = useMemo(
    () =>
      buildRoadmapLayout({
        stages,
        lessons,
        isMobile,
        selectedDay,
        recommendedDay,
        onOpenCourse,
      }),
    [isMobile, lessons, onOpenCourse, recommendedDay, selectedDay, stages]
  )
  const { x: focusX, y: focusY, zoom: focusZoom } = layout.focus
  const selectedStage =
    selectedDay === null
      ? null
      : stages.find((stage) => stage.lessonDays.includes(selectedDay))

  const cancelPendingRestore = useCallback(() => {
    if (restoreFrame.current !== null) {
      window.cancelAnimationFrame(restoreFrame.current)
      restoreFrame.current = null
    }
  }, [])

  const restoreViewportAfterLayout = useCallback(
    (viewport: Viewport) => {
      cancelPendingRestore()
      const expectedRevision = interactionRevision.current
      restoreFrame.current = window.requestAnimationFrame(() => {
        restoreFrame.current = window.requestAnimationFrame(() => {
          restoreFrame.current = null
          if (interactionRevision.current !== expectedRevision) {
            return
          }
          void flowInstance.current?.setViewport(viewport, { duration: 0 })
        })
      })
    },
    [cancelPendingRestore]
  )

  useImperativeHandle(
    ref,
    () => ({
      getViewport: () => flowInstance.current?.getViewport() ?? null,
      restoreViewportAfterLayout,
      focusZenEntry: () => zenEntryRef.current?.focus(),
      focusZenExit: () => zenExitRef.current?.focus(),
    }),
    [restoreViewportAfterLayout]
  )

  useEffect(() => cancelPendingRestore, [cancelPendingRestore])

  const focusRecommended = useCallback(() => {
    void flowInstance.current?.setCenter(focusX, focusY, {
      zoom: focusZoom,
      duration: 180,
    })
  }, [focusX, focusY, focusZoom])

  const handleNodeClick: NodeMouseHandler<RoadmapNode> = (_event, node) => {
    if (node.type === "lesson") {
      const trigger = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${node.id}"]`
      )
      if (trigger) {
        onSelectDay(node.data.lesson.day, trigger)
      }
    }
  }

  const focusNodes = useCallback(
    (nodeIds: string[], options?: { maxZoom?: number; padding?: number }) => {
      void flowInstance.current?.fitView({
        nodes: nodeIds.map((id) => ({ id })),
        padding: options?.padding ?? 0.15,
        maxZoom: options?.maxZoom ?? 1,
        duration: 180,
      })
    },
    []
  )

  const fitWholeRoadmap = useCallback(() => {
    void flowInstance.current?.fitView({
      padding: 0.08,
      maxZoom: 1,
      duration: 180,
    })
  }, [])

  const zoom = useCallback((direction: "in" | "out") => {
    const instance = flowInstance.current
    if (!instance) {
      return
    }
    const nextZoom = getNextZoom(instance.getZoom(), direction)
    void instance.zoomTo(nextZoom, { duration: 180 })
  }, [])

  const handleSearchSelect = useCallback(
    (lesson: CourseLesson) => {
      const trigger = document.querySelector<HTMLElement>(
        '[data-testid="day-search-trigger"]'
      )
      if (trigger) {
        onSelectDay(lesson.day, trigger)
      }
      window.requestAnimationFrame(() =>
        focusNodes([lesson.id], { maxZoom: 1.08, padding: 0.8 })
      )
    },
    [focusNodes, onSelectDay]
  )

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || !["Enter", " ", "Spacebar"].includes(event.key)) {
      return
    }

    const target = event.target as HTMLElement
    if (target.closest("a, button, input, [role='combobox']")) {
      return
    }

    const nodeElement = target.closest<HTMLElement>(
      ".react-flow__node-lesson"
    )
    const node = layout.nodes.find(
      (candidate) =>
        candidate.id === nodeElement?.dataset.id && candidate.type === "lesson"
    )
    if (node?.type !== "lesson") {
      return
    }

    event.preventDefault()
    if (nodeElement) {
      onSelectDay(node.data.lesson.day, nodeElement)
    }
  }

  const recommendationLabel =
    recommendedDay === null ? "最终 Day" : `Day ${recommendedDay}`
  const zoomControls = getZoomControls(viewportZoom)

  return (
    <Card
      className={cn("roadmap-panel", zen && "roadmap-panel-zen")}
      data-testid="roadmap-panel"
      data-zen={zen ? "true" : "false"}
    >
      {!zen ? (
        <CardHeader className="roadmap-panel-header">
          <div className="roadmap-panel-heading">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <NetworkIcon aria-hidden="true" />
                学习路径
              </CardTitle>
              <CardDescription>
                选择节点查看目标；拖动画布，滚轮或双指缩放
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="roadmap-location"
              data-testid="roadmap-location"
            >
              {selectedDay === null
                ? "全图概览"
                : `阶段 ${selectedStage?.order ?? 1}/${stages.length} · Day ${selectedDay}`}
            </Badge>
          </div>

          <div
            className="roadmap-toolbar"
            role="toolbar"
            aria-label="路线图导航"
          >
            <Select
              onValueChange={(stageId) =>
                focusNodes([stageId], { maxZoom: 0.9, padding: 0.12 })
              }
            >
              <SelectTrigger
                size="sm"
                className="stage-jump-trigger"
                aria-label="跳转阶段"
              >
                <MapPinnedIcon aria-hidden="true" />
                <SelectValue placeholder="跳转阶段" />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {stages.map((stage) => (
                  <SelectItem value={stage.id} key={stage.id}>
                    阶段 {stage.order} · {stage.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DaySearch
              lessons={lessons}
              selectedDay={selectedDay}
              onSelect={handleSearchSelect}
            />
            <RoadmapLegend />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fitWholeRoadmap}
              data-testid="roadmap-fit-view"
            >
              <ExpandIcon data-icon="inline-start" />
              适配全图
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={focusRecommended}
                  aria-label={`定位 ${recommendationLabel}`}
                >
                  <LocateFixedIcon data-icon="inline-start" />
                  定位 {recommendationLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent>回到当前推荐课程</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  ref={zenEntryRef}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="roadmap-zen-trigger"
                  aria-label="进入画布全屏聚焦模式"
                  data-testid="roadmap-zen-enter"
                  onClick={onToggleZen}
                >
                  <Maximize2Icon aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>画布全屏聚焦</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
      ) : null}

      <CardContent
        className={cn(
          "roadmap-canvas-wrap px-0",
          zen && "roadmap-canvas-wrap-zen"
        )}
      >
        {zen ? <div className="roadmap-zen-safe-area" aria-hidden="true" /> : null}
        <div
          className="roadmap-canvas"
          data-testid="roadmap-canvas"
          aria-label="Go 学习路线图画布"
          onKeyDownCapture={handleCanvasKeyDown}
        >
          <ReactFlow<RoadmapNode, RoadmapEdge>
            nodes={layout.nodes}
            edges={layout.edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={handleNodeClick}
            onInit={(instance) => {
              flowInstance.current = instance
              setViewportZoom(instance.getZoom())
              if (
                shouldAutomaticallyFit(
                  "initial-layout",
                  initialFitComplete.current
                )
              ) {
                initialFitComplete.current = true
                window.requestAnimationFrame(() => {
                  void instance.fitView({
                    padding: 0.08,
                    maxZoom: 1,
                    duration: 0,
                  })
                })
              }
            }}
            onMoveStart={(event) => {
              if (event) {
                interactionRevision.current += 1
                cancelPendingRestore()
              }
            }}
            onMove={(_event, viewport) => setViewportZoom(viewport.zoom)}
            minZoom={ROADMAP_MIN_ZOOM}
            maxZoom={ROADMAP_MAX_ZOOM}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            zoomOnDoubleClick={false}
            panOnScroll
            preventScrolling
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--roadmap-grid)"
            />
            {!zen ? (
              <Controls
                position="bottom-left"
                showInteractive={false}
                fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
              />
            ) : null}
          </ReactFlow>
        </div>
      </CardContent>

      {zen && surfaceIsCanvas ? (
        <div
          className="roadmap-zen-toolbar"
          role="toolbar"
          aria-label="画布全屏聚焦工具栏"
          data-testid="roadmap-zen-toolbar"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="缩小路线图"
                disabled={!zoomControls.canZoomOut}
                onClick={() => zoom("out")}
              >
                <ZoomOutIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>缩小</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="放大路线图"
                disabled={!zoomControls.canZoomIn}
                onClick={() => zoom("in")}
              >
                <ZoomInIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>放大</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="适配全图"
                onClick={fitWholeRoadmap}
                data-testid="roadmap-zen-fit-view"
              >
                <ExpandIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>适配全图</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={zenExitRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="退出画布全屏聚焦模式"
                data-testid="roadmap-zen-exit"
                onClick={onToggleZen}
              >
                <Minimize2Icon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>退出全屏聚焦</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
    </Card>
  )
})
