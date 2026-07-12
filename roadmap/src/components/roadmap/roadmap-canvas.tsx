import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
} from "@xyflow/react"
import {
  ExpandIcon,
  LocateFixedIcon,
  MapPinnedIcon,
  NetworkIcon,
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
import type { CourseLesson, CourseStage } from "@/types/course"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = {
  lesson: LessonNode,
  overview: OverviewNode,
  stage: StageNode,
}

interface RoadmapCanvasProps {
  stages: CourseStage[]
  lessons: CourseLesson[]
  selectedDay: number
  recommendedDay: number | null
  onSelectDay: (day: number) => void
}

export function RoadmapCanvas({
  stages,
  lessons,
  selectedDay,
  recommendedDay,
  onSelectDay,
}: RoadmapCanvasProps) {
  const isMobile = useMobile()
  const flowInstance = useRef<
    ReactFlowInstance<RoadmapNode, RoadmapEdge> | undefined
  >(undefined)
  const lastAutoFocusedMode = useRef<boolean | null>(null)
  const layout = useMemo(
    () =>
      buildRoadmapLayout({
        stages,
        lessons,
        isMobile,
        selectedDay,
        recommendedDay,
      }),
    [isMobile, lessons, recommendedDay, selectedDay, stages]
  )
  const { x: focusX, y: focusY, zoom: focusZoom } = layout.focus
  const selectedStage = stages.find((stage) =>
    stage.lessonDays.includes(selectedDay)
  )

  const focusRecommended = useCallback(() => {
    void flowInstance.current?.setCenter(focusX, focusY, {
      zoom: focusZoom,
      duration: 280,
    })
  }, [focusX, focusY, focusZoom])

  useEffect(() => {
    if (
      !flowInstance.current ||
      lastAutoFocusedMode.current === isMobile
    ) {
      return
    }
    lastAutoFocusedMode.current = isMobile
    const frame = window.requestAnimationFrame(focusRecommended)
    return () => window.cancelAnimationFrame(frame)
  }, [focusRecommended, isMobile])

  const handleNodeClick: NodeMouseHandler<RoadmapNode> = (_event, node) => {
    if (node.type === "lesson") {
      onSelectDay(node.data.lesson.day)
    }
  }

  const focusNodes = useCallback(
    (nodeIds: string[], options?: { maxZoom?: number; padding?: number }) => {
      void flowInstance.current?.fitView({
        nodes: nodeIds.map((id) => ({ id })),
        padding: options?.padding ?? 0.15,
        maxZoom: options?.maxZoom ?? 1,
        duration: 280,
      })
    },
    []
  )

  const fitWholeRoadmap = useCallback(() => {
    void flowInstance.current?.fitView({
      padding: 0.08,
      maxZoom: 1,
      duration: 280,
    })
  }, [])

  const handleSearchSelect = useCallback(
    (lesson: CourseLesson) => {
      onSelectDay(lesson.day)
      window.requestAnimationFrame(() =>
        focusNodes([lesson.id], { maxZoom: 1.08, padding: 0.8 })
      )
    },
    [focusNodes, onSelectDay]
  )

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.repeat ||
      !["Enter", " ", "Spacebar"].includes(event.key)
    ) {
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
    onSelectDay(node.data.lesson.day)
  }

  const recommendationLabel =
    recommendedDay === null ? "最终 Day" : `Day ${recommendedDay}`

  return (
    <Card className="roadmap-panel">
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
            阶段 {selectedStage?.order ?? 1}/{stages.length} · Day {selectedDay}
          </Badge>
        </div>

        <div className="roadmap-toolbar" role="toolbar" aria-label="路线图导航">
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
        </div>
      </CardHeader>
      <CardContent className="roadmap-canvas-wrap px-0">
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
              lastAutoFocusedMode.current = isMobile
              window.requestAnimationFrame(focusRecommended)
            }}
            minZoom={0.18}
            maxZoom={1.6}
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
            <Controls
              position="bottom-left"
              showInteractive={false}
              fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  )
}
