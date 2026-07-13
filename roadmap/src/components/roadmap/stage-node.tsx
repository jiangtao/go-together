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
  lessons: RoadmapLesson[]
  completed: number
  total: number
  percentage: number
}

export type StageFlowNode = Node<StageNodeData, "stage">

export function StageNode({ data }: NodeProps<StageFlowNode>) {
  const { stage } = data
  const dayValues = data.lessons
    .map((lesson) => lesson.day)
    .filter((day): day is number => day !== null)
  const rangeLabel =
    dayValues.length === data.lessons.length
      ? `Day ${Math.min(...dayValues)}–${Math.max(...dayValues)}`
      : `${data.lessons.length} 个课次`
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="roadmap-structure-handle"
      />
      <Card className="stage-node-card" data-testid={`stage-${stage.order}`}>
        <CardHeader>
          <CardTitle>
            阶段 {stage.order} · {stage.title}
          </CardTitle>
          <CardDescription>{stage.description}</CardDescription>
          <CardAction>
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
        position={Position.Bottom}
        isConnectable={false}
        className="roadmap-structure-handle"
      />
    </>
  )
}
