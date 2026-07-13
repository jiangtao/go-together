import {
  Handle,
  type Node,
  type NodeProps,
  type Position,
} from "@xyflow/react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
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
  onOpenCourse: (lesson: CourseLesson, trigger: HTMLElement) => void
}

export type LessonFlowNode = Node<LessonNodeData, "lesson">

export function LessonNode({ data, selected }: NodeProps<LessonFlowNode>) {
  const { lesson } = data

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
          {data.recommended ? (
            <CardAction>
              <Badge
                variant="secondary"
                className="recommended-marker"
                data-testid={`recommended-marker-${lesson.day}`}
              >
                推荐
              </Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="lesson-node-content">
          <a
            href={lesson.lessonHref}
            className="nodrag nopan lesson-node-title lesson-node-course-link"
            title={`点击查看课程：${lesson.title}`}
            aria-label={`在应用内阅读 ${lesson.dayLabel} 课程：${lesson.title}`}
            data-testid={`lesson-node-course-${lesson.day}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              data.onOpenCourse(lesson, event.currentTarget)
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {lesson.title}
          </a>
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
