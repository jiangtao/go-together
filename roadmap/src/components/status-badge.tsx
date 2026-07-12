import type { ComponentType } from "react"
import {
  BookOpenCheckIcon,
  CircleDashedIcon,
  RotateCcwIcon,
  WrenchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { CourseStatus } from "@/types/course"

const STATUS_ICONS: Record<CourseStatus, ComponentType> = {
  未开始: CircleDashedIcon,
  定向回炉: WrenchIcon,
  重新学习: RotateCcwIcon,
  通过: BookOpenCheckIcon,
}

interface StatusBadgeProps {
  status: CourseStatus
  iconOnly?: boolean
}

export function StatusBadge({ status, iconOnly = false }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status]

  return (
    <Badge
      variant="outline"
      data-status={status}
      aria-label={iconOnly ? status : undefined}
      className="status-badge"
    >
      <Icon data-icon="inline-start" />
      {iconOnly ? <span className="sr-only">{status}</span> : status}
    </Badge>
  )
}
