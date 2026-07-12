import { XIcon } from "lucide-react"

import { LessonDetail } from "@/components/lesson-detail"
import { ProgressOverview } from "@/components/progress-overview"
import { Button } from "@/components/ui/button"
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
          <ProgressOverview
            summary={summary}
            stages={stages}
            stageProgress={stageProgress}
          />
          <LessonDetail lesson={lesson} stage={stage} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
