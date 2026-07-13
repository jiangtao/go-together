import {
  BookOpenIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  ListChecksIcon,
  TargetIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CourseLesson, CourseStage } from "@/types/course"

interface LessonDetailProps {
  lesson: CourseLesson
  stage: CourseStage
  onOpenCourse: (lesson: CourseLesson, trigger: HTMLElement) => void
}

export function LessonDetail({
  lesson,
  stage,
  onOpenCourse,
}: LessonDetailProps) {
  return (
    <Card className="lesson-detail" data-testid="lesson-detail">
      <CardHeader>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{lesson.dayLabel}</Badge>
        </div>
        <CardTitle data-testid="lesson-detail-title">{lesson.title}</CardTitle>
        <CardDescription>
          阶段 {stage.order} · {stage.title}
          {lesson.englishTitle ? ` · ${lesson.englishTitle}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="lesson-detail-content">
        <section aria-labelledby={`evaluation-heading-${lesson.day}`}>
          <h2
            id={`evaluation-heading-${lesson.day}`}
            className="detail-heading"
          >
            <ClipboardCheckIcon aria-hidden="true" />
            当日评测
          </h2>
          <div className="lesson-evaluation-summary">
            <div>
              <span>当前状态</span>
              <StatusBadge status={lesson.status} />
            </div>
            <div>
              <span>参考分数</span>
              <strong className="tabular-nums" data-testid="lesson-score">
                {lesson.referenceScore === null ? "—" : lesson.referenceScore}
              </strong>
            </div>
          </div>
          <p className="detail-source-note">
            状态与分数来自发布前脱敏的进度摘要；页面只展示，不提供手工修改。
          </p>
        </section>

        <Separator />

        <section aria-labelledby="objective-heading">
          <h2 id="objective-heading" className="detail-heading">
            <TargetIcon aria-hidden="true" />
            当日目标
          </h2>
          <p className="detail-copy" data-testid="lesson-objective">
            {lesson.objective}
          </p>
        </section>

        <Separator />

        <section aria-labelledby="course-path-heading">
          <h2 id="course-path-heading" className="detail-heading">
            <BookOpenIcon aria-hidden="true" />
            课程入口
          </h2>
          <div className="path-row" data-resource="lesson">
            <BookOpenIcon aria-hidden="true" />
            <div className="min-w-0">
              <span>课程 Markdown</span>
              <p>在应用内安全阅读当天教程</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="lesson-resource-lesson"
              onClick={(event) => onOpenCourse(lesson, event.currentTarget)}
            >
              阅读
              <BookOpenIcon data-icon="inline-end" />
            </Button>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="goals-heading">
          <h2 id="goals-heading" className="detail-heading">
            <ListChecksIcon aria-hidden="true" />
            完成标准
          </h2>
          <ul className="goal-list">
            {lesson.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </section>
      </CardContent>
      <CardFooter className="gap-2 text-xs text-muted-foreground">
        <FileCheck2Icon aria-hidden="true" />
        公开页面仅展示教程与脱敏进度摘要
      </CardFooter>
    </Card>
  )
}
