import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react"
import { LocateFixedIcon, NetworkIcon } from "lucide-react"

import {
  buildRoadmapLayout,
  type RoadmapEdge,
  type RoadmapNode,
} from "@/components/roadmap/layout"
import { LessonNode } from "@/components/roadmap/lesson-node"
import { OverviewNode } from "@/components/roadmap/overview-node"
import { StageNode } from "@/components/roadmap/stage-node"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

  const recommendationLabel =
    recommendedDay === null ? "最终 Day" : `Day ${recommendedDay}`

  return (
    <Card className="roadmap-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NetworkIcon aria-hidden="true" />
          学习路径
        </CardTitle>
        <CardDescription>
          选择节点查看目标；拖动画布，滚轮或双指缩放
        </CardDescription>
        <CardAction>
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
        </CardAction>
      </CardHeader>
      <CardContent className="roadmap-canvas-wrap px-0">
        <div
          className="roadmap-canvas"
          data-testid="roadmap-canvas"
          aria-label="Go 学习路线图画布"
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
