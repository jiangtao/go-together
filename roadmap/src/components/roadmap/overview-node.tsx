import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { RouteIcon, WaypointsIcon } from "lucide-react"

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

export interface OverviewNodeData extends Record<string, unknown> {
  variant: "root" | "track"
  eyebrow: string
  title: string
  description: string
  completed: number
  total: number
  percentage: number
  testId: string
}

export type OverviewFlowNode = Node<OverviewNodeData, "overview">

export function OverviewNode({ data }: NodeProps<OverviewFlowNode>) {
  const Icon = data.variant === "root" ? RouteIcon : WaypointsIcon

  return (
    <>
      {data.variant === "track" ? (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className="roadmap-structure-handle"
        />
      ) : null}
      <Card
        size="sm"
        className="overview-node-card"
        data-variant={data.variant}
        data-testid={data.testId}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon aria-hidden="true" />
            {data.title}
          </CardTitle>
          <CardDescription>
            {data.eyebrow} · {data.description}
          </CardDescription>
          <CardAction>
            <Badge variant={data.variant === "root" ? "secondary" : "outline"}>
              {data.completed}/{data.total}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="overview-node-progress">
          <Progress
            value={data.percentage}
            aria-label={`${data.title} 进度 ${data.percentage}%`}
          />
          <span className="tabular-nums">{data.percentage}%</span>
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
