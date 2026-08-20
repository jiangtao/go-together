import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { RoadmapLesson, RoadmapStage } from "@/types/course"

export interface StageNodeData extends Record<string, unknown> {
  stage: RoadmapStage
  trackTitle: string
  level: number
  totalLevels: number
  levelLabel: string
  levelKind: "core" | "extension"
  lessons: RoadmapLesson[]
  completed: number
  total: number
  percentage: number
  targetPosition: Position
  sourcePosition: Position
}

export type StageFlowNode = Node<StageNodeData, "stage">

export function StageNode({ data }: NodeProps<StageFlowNode>) {
  const { stage } = data
  const dayValues = data.lessons
    .map((lesson) => lesson.day)
    .filter((day): day is number => day !== null)
  const rangeLabel =
    data.lessons.length === 0
      ? "暂无课次"
      : dayValues.length === data.lessons.length
      ? `Day ${Math.min(...dayValues)}–${Math.max(...dayValues)}`
      : `${data.lessons.length} 个课次`
  return (
    <>
      <Handle
        type="target"
        position={data.targetPosition}
        isConnectable={false}
        className="roadmap-structure-handle"
      />
      <Card
        className="stage-node-card"
        data-testid={`stage-${stage.order}`}
        data-level={data.level}
        data-level-kind={data.levelKind}
      >
        <CardHeader>
          <CardTitle className="stage-node-title">
            <span className="stage-node-kicker">
              第 {data.level}/{data.totalLevels} 层 · {data.levelLabel}
            </span>
            <span>阶段 {stage.order} · {stage.title}</span>
          </CardTitle>
          <CardDescription>
            {data.trackTitle} · {stage.description}
          </CardDescription>
          <CardAction className="stage-node-meta">
            <Badge variant="outline">{rangeLabel}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="stage-node-progress">
          <Progress
            value={data.percentage}
            aria-label={`阶段 ${stage.order} 进度 ${data.percentage}%`}
          />
          <span className="tabular-nums">
            {data.completed}/{data.total} · {data.percentage}%
          </span>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={data.sourcePosition}
        isConnectable={false}
        className="roadmap-structure-handle"
      />
    </>
  )
}
