import { InfoIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { COURSE_STATUSES } from "@/types/course"

export function RoadmapLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="roadmap-legend-trigger"
        >
          <InfoIcon data-icon="inline-start" />
          图例
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="roadmap-legend"
        data-testid="roadmap-legend"
      >
        <PopoverHeader>
          <PopoverTitle>路线图图例</PopoverTitle>
          <PopoverDescription>
            状态由评测文件生成，选中与推荐互不等同。
          </PopoverDescription>
        </PopoverHeader>

        <div className="roadmap-legend-statuses" aria-label="课程状态">
          {COURSE_STATUSES.map((status) => (
            <StatusBadge status={status} key={status} />
          ))}
        </div>

        <div className="roadmap-legend-list">
          <div>
            <span className="legend-node-sample" data-variant="selected" />
            <span>选中</span>
          </div>
          <div>
            <Badge variant="secondary" className="recommended-marker">
              推荐
            </Badge>
            <span>当前推荐 Day</span>
          </div>
          <div>
            <span className="legend-line-sample" data-variant="within" />
            <span>阶段内实线</span>
          </div>
          <div>
            <span className="legend-line-sample" data-variant="cross" />
            <span>跨阶段虚线</span>
          </div>
          <div>
            <span className="legend-line-sample" data-variant="structure" />
            <span>结构线（总路线与阶段）</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
