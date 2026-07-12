import type { ComponentType } from "react"
import {
  BookOpenCheckIcon,
  CircleDashedIcon,
  RotateCcwIcon,
  WrenchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type {
  ProgressSummary,
  StageProgressSummary,
} from "@/lib/progress"
import {
  COURSE_STATUSES,
  type CourseStage,
  type CourseStatus,
} from "@/types/course"

const STATUS_ICONS: Record<CourseStatus, ComponentType> = {
  未开始: CircleDashedIcon,
  定向回炉: WrenchIcon,
  重新学习: RotateCcwIcon,
  通过: BookOpenCheckIcon,
}

interface ProgressOverviewProps {
  summary: ProgressSummary
  stages: CourseStage[]
  stageProgress: StageProgressSummary[]
}

export function ProgressOverview({
  summary,
  stages,
  stageProgress,
}: ProgressOverviewProps) {
  return (
    <Card
      size="sm"
      className="progress-overview-card"
      data-testid="progress-overview"
    >
      <CardContent className="flex flex-col gap-3">
        <h2 className="sr-only">学习进度详情</h2>
        <div className="flex items-center gap-3">
          <Progress
            value={summary.percentage}
            aria-label={`总进度 ${summary.percentage}%`}
          />
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {summary.percentage}%
          </span>
        </div>
        <div className="status-count-grid" aria-label="各状态数量">
          {COURSE_STATUSES.map((status) => {
            const Icon = STATUS_ICONS[status]
            return (
              <div className="status-count" data-status={status} key={status}>
                <Icon aria-hidden="true" />
                <span>{status}</span>
                <strong className="tabular-nums">{summary.counts[status]}</strong>
              </div>
            )
          })}
        </div>
        <Separator />
        <div className="stage-progress-heading">
          <strong>分阶段进度</strong>
          <Badge variant="outline">评测文件实时同步</Badge>
        </div>
        <div className="stage-progress-grid" aria-label="六阶段进度">
          {stages.map((stage) => {
            const progress = stageProgress.find(
              (candidate) => candidate.stageId === stage.id
            )
            if (!progress) {
              return null
            }
            return (
              <div
                className="stage-progress-item"
                data-testid={`stage-progress-${stage.order}`}
                key={stage.id}
              >
                <div>
                  <span>阶段 {stage.order}</span>
                  <strong className="tabular-nums">
                    {progress.completed}/{progress.total}
                  </strong>
                </div>
                <p title={stage.title}>{stage.title}</p>
                <Progress
                  value={progress.percentage}
                  aria-label={`阶段 ${stage.order} 进度 ${progress.percentage}%`}
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
