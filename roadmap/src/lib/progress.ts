import {
  COURSE_STATUSES,
  type CourseLesson,
  type CourseStage,
  type CourseStatus,
} from "@/types/course"

export interface ProgressSummary {
  total: number
  completed: number
  percentage: number
  counts: Record<CourseStatus, number>
  recommendedDay: number | null
}

export interface RoadmapProgressSummary {
  total: number
  completed: number
  percentage: number
  counts: Record<CourseStatus, number>
  recommendedLessonId: string | null
}

type RoadmapProgressLesson = {
  lessonId: string
  lifecycle: "active" | "retired"
  status: CourseStatus
}

export function summarizeRoadmapProgress(
  lessons: RoadmapProgressLesson[]
): RoadmapProgressSummary {
  const activeLessons = lessons.filter((lesson) => lesson.lifecycle === "active")
  const counts = Object.fromEntries(
    COURSE_STATUSES.map((status) => [status, 0])
  ) as Record<CourseStatus, number>
  activeLessons.forEach((lesson) => {
    counts[lesson.status] += 1
  })
  const completed = counts["通过"]
  const total = activeLessons.length
  return {
    total,
    completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    counts,
    recommendedLessonId:
      activeLessons.find((lesson) => lesson.status !== "通过")?.lessonId ?? null,
  }
}

type ProgressLesson = Pick<CourseLesson, "day" | "status">

export interface StageProgressSummary {
  stageId: string
  completed: number
  total: number
  percentage: number
  recommendedDay: number | null
}

export function summarizeProgress(lessons: ProgressLesson[]): ProgressSummary {
  const counts = Object.fromEntries(
    COURSE_STATUSES.map((status) => [status, 0])
  ) as Record<CourseStatus, number>

  for (const lesson of lessons) {
    counts[lesson.status] += 1
  }

  const completed = counts["通过"]
  const total = lessons.length
  const recommendedDay = [...lessons]
    .sort((left, right) => left.day - right.day)
    .find((lesson) => lesson.status !== "通过")?.day

  return {
    total,
    completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    counts,
    recommendedDay: recommendedDay ?? null,
  }
}

export function summarizeStageProgress(
  stages: Pick<CourseStage, "id" | "lessonDays">[],
  lessons: ProgressLesson[]
): StageProgressSummary[] {
  const lessonsByDay = new Map(lessons.map((lesson) => [lesson.day, lesson]))

  return stages.map((stage) => {
    const stageLessons = stage.lessonDays
      .map((day) => lessonsByDay.get(day))
      .filter((lesson): lesson is ProgressLesson => Boolean(lesson))
      .sort((left, right) => left.day - right.day)
    const completed = stageLessons.filter(
      (lesson) => lesson.status === "通过"
    ).length
    const total = stageLessons.length
    const recommendedDay = stageLessons.find(
      (lesson) => lesson.status !== "通过"
    )?.day

    return {
      stageId: stage.id,
      completed,
      total,
      percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
      recommendedDay: recommendedDay ?? null,
    }
  })
}
