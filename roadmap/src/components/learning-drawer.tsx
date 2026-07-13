import { useEffect, useRef } from "react"
import { XIcon } from "lucide-react"

import { LessonDetail } from "@/components/lesson-detail"
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
import type { CourseLesson, CourseStage } from "@/types/course"

interface LearningDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: CourseLesson
  stage: CourseStage
  initialFocus: "close" | "resource"
  onOpenCourse: (lesson: CourseLesson, trigger: HTMLElement) => void
}

export function LearningDrawer({
  open,
  onOpenChange,
  lesson,
  stage,
  initialFocus,
  onOpenCourse,
}: LearningDrawerProps) {
  const isMobile = useMobile()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (initialFocus === "resource") {
        document
          .querySelector<HTMLElement>('[data-testid="lesson-resource-lesson"]')
          ?.focus()
      } else {
        closeButtonRef.current?.focus()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialFocus, open])

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
      autoFocus
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
                仅显示这一天的状态、评测证据与学习资源
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="关闭学习抽屉"
                data-testid="learning-drawer-close"
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="learning-drawer-body">
          <LessonDetail
            lesson={lesson}
            stage={stage}
            onOpenCourse={onOpenCourse}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
