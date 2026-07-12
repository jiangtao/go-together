import { ChevronDownIcon, RouteIcon, XIcon } from "lucide-react"

import { LessonDetail } from "@/components/lesson-detail"
import { ProgressOverview } from "@/components/progress-overview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMobile } from "@/hooks/use-mobile"
import type {
  ProgressSummary,
  StageProgressSummary,
} from "@/lib/progress"
import type { CourseLesson, CourseStage } from "@/types/course"

interface LearningDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: CourseLesson
  stage: CourseStage
  stages: CourseStage[]
  summary: ProgressSummary
  stageProgress: StageProgressSummary[]
}

export function LearningDrawer({
  open,
  onOpenChange,
  lesson,
  stage,
  stages,
  summary,
  stageProgress,
}: LearningDrawerProps) {
  const isMobile = useMobile()

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className="learning-drawer data-[vaul-drawer-direction=right]:sm:max-w-none"
        data-testid="learning-drawer"
      >
        <DrawerHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle>
                {lesson.dayLabel} · {lesson.title}
              </DrawerTitle>
              <DrawerDescription>
                查看实时学习进度、当日目标与课程资源
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="关闭学习抽屉"
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="learning-drawer-body">
          <Collapsible
            key={`${isMobile ? "mobile" : "desktop"}-${lesson.day}`}
            defaultOpen={!isMobile}
            className="learning-progress-section"
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="learning-progress-toggle"
                data-testid="learning-progress-toggle"
                aria-label="展开或收起总进度"
              >
                <RouteIcon data-icon="inline-start" />
                <span>
                  总进度 {summary.completed}/{summary.total}
                </span>
                <Badge
                  variant="secondary"
                  className="learning-progress-recommendation"
                >
                  {summary.recommendedDay === null
                    ? "全部完成"
                    : `推荐 Day ${summary.recommendedDay}`}
                </Badge>
                <strong className="tabular-nums">{summary.percentage}%</strong>
                <ChevronDownIcon className="learning-progress-chevron" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="learning-progress-content">
              <ProgressOverview
                summary={summary}
                stages={stages}
                stageProgress={stageProgress}
              />
            </CollapsibleContent>
          </Collapsible>
          <LessonDetail lesson={lesson} stage={stage} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
