import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FolderCodeIcon,
  ListChecksIcon,
  TargetIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type {
  CourseLesson,
  CourseResource,
  CourseStage,
} from "@/types/course"

interface LessonDetailProps {
  lesson: CourseLesson
  stage: CourseStage
}

interface PathRowProps {
  icon: typeof BookOpenIcon
  resource: CourseResource
}

function PathRow({ icon: Icon, resource }: PathRowProps) {
  return (
    <div className="path-row" data-resource={resource.kind}>
      <Icon aria-hidden="true" />
      <div className="min-w-0">
        <span>{resource.label}</span>
        <code title={resource.path}>{resource.path}</code>
      </div>
      {resource.exists ? (
        <Button asChild variant="outline" size="xs">
          <a
            href={resource.href}
            target="_blank"
            rel="noreferrer"
            data-testid={`lesson-resource-${resource.kind}`}
          >
            打开
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="xs"
          disabled
          data-testid={`lesson-resource-${resource.kind}`}
          aria-label={`${resource.label}尚未创建`}
        >
          待创建
        </Button>
      )}
    </div>
  )
}

export function LessonDetail({ lesson, stage }: LessonDetailProps) {
  const lessonResource = lesson.resources.find(
    (resource) => resource.kind === "lesson"
  )
  const notesResource = lesson.resources.find(
    (resource) => resource.kind === "notes"
  )
  const evaluationResource = lesson.resources.find(
    (resource) => resource.kind === "evaluation"
  )

  return (
    <Card className="lesson-detail" data-testid="lesson-detail">
      <CardHeader>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{lesson.dayLabel}</Badge>
          <StatusBadge status={lesson.status} />
        </div>
        <CardTitle data-testid="lesson-detail-title">{lesson.title}</CardTitle>
        <CardDescription>
          阶段 {stage.order} · {stage.title}
          {lesson.englishTitle ? ` · ${lesson.englishTitle}` : ""}
        </CardDescription>
        <CardAction>
          <Badge variant="outline" aria-label="参考分数">
            {lesson.referenceScore === null
              ? "参考分数 —"
              : `参考分数 ${lesson.referenceScore}`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="lesson-detail-content">
        <section aria-labelledby="objective-heading">
          <h2 id="objective-heading" className="detail-heading">
            <TargetIcon aria-hidden="true" />
            当日目标
          </h2>
          <p className="detail-copy">{lesson.objective}</p>
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

        <Separator />

        <section aria-labelledby="paths-heading">
          <h2 id="paths-heading" className="detail-heading">
            <FolderCodeIcon aria-hidden="true" />
            课程与练习路径
          </h2>
          <div className="flex flex-col gap-2">
            {lessonResource ? (
              <PathRow icon={BookOpenIcon} resource={lessonResource} />
            ) : null}
            {notesResource ? (
              <PathRow icon={FolderCodeIcon} resource={notesResource} />
            ) : null}
            {evaluationResource ? (
              <PathRow icon={FileCheck2Icon} resource={evaluationResource} />
            ) : null}
          </div>
        </section>
      </CardContent>
      <CardFooter className="gap-2 text-xs text-muted-foreground">
        <FileCheck2Icon aria-hidden="true" />
        {lesson.evaluationSourceExists
          ? "当前状态与分数来自评测文件；页面不提供手工打卡。"
          : "评测文件尚不存在，按约定自动视为未开始。"}
      </CardFooter>
    </Card>
  )
}
