import {
  Handle,
  type Node,
  type NodeProps,
  type Position,
} from "@xyflow/react"
import { FileTextIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CourseLesson } from "@/types/course"

export interface LessonNodeData extends Record<string, unknown> {
  lesson: CourseLesson
  recommended: boolean
  targetPosition: Position
  sourcePosition: Position
}

export type LessonFlowNode = Node<LessonNodeData, "lesson">

export function LessonNode({ data, selected }: NodeProps<LessonFlowNode>) {
  const { lesson } = data
  const lessonResource = lesson.resources.find(
    (resource) => resource.kind === "lesson"
  )

  return (
    <>
      <Handle
        type="target"
        position={data.targetPosition}
        isConnectable={false}
        className="roadmap-handle"
      />
      <Card
        size="sm"
        className="lesson-node-card"
        data-status={lesson.status}
        data-selected={selected || undefined}
        data-recommended={data.recommended || undefined}
        data-testid={`lesson-node-${lesson.day}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="tabular-nums">{lesson.dayLabel}</span>
            <StatusBadge status={lesson.status} />
          </CardTitle>
          {lessonResource?.exists ? (
            <CardAction>
              <Button
                asChild
                variant="ghost"
                size="icon-xs"
                className="nodrag nopan"
              >
                <a
                  href={lessonResource.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`打开 ${lesson.dayLabel} 课程 Markdown`}
                  data-testid={`lesson-node-course-${lesson.day}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <FileTextIcon data-icon="inline-start" />
                </a>
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="lesson-node-title" title={lesson.title}>
            {lesson.title}
          </p>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={data.sourcePosition}
        isConnectable={false}
        className="roadmap-handle"
      />
    </>
  )
}
