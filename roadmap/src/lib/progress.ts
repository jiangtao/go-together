import {
  COURSE_STATUSES,
  type CourseStatus,
} from "@/types/course"

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
