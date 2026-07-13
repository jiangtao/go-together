import {
  parsePublicCatalog,
  parsePublicCourse,
  parsePublicProgress,
  validatePublicCatalogCoursePair,
  validatePublicCourseProgressPair,
  type PublicCourse,
  type PublicProgress,
} from "@/lib/public-course-contract"
import type { CourseData } from "@/types/course"

export interface CanonicalCourseLoadResult {
  courseId: string
  courseRevision: string
  courseData: CourseData
}

async function fetchJson(
  fetcher: typeof fetch,
  href: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetcher(href, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`${href} 加载失败（HTTP ${response.status}）`)
  return response.json() as Promise<unknown>
}

function requestedCourseId(pathname: string): string {
  if (pathname === "/") return "go-backend"
  const match = pathname.match(/^\/courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)
  if (!match) throw new Error("当前课程 URL 无效")
  return match[1]
}

function projectCurrentRoadmap(
  course: PublicCourse,
  progress: PublicProgress
): CourseData {
  const stages = course.tracks.flatMap((track) => track.stages)
  const canonicalLessons = stages.flatMap((stage) =>
    stage.lessons.map((lesson) => ({ stageId: stage.stageId, lesson }))
  )
  if (
    stages.length !== 6 ||
    canonicalLessons.length !== 37 ||
    canonicalLessons.some(({ lesson }, index) => lesson.day !== index)
  ) {
    throw new Error("当前 Roadmap adapter 要求 Go Day 0-36；通用体验由后续票切换")
  }
  const progressById = new Map(
    progress.lessons.map((lesson) => [lesson.lessonId, lesson])
  )
  const projectedStageIds = new Map(
    stages.map((stage, index) => [stage.stageId, `stage-${index + 1}`])
  )
  return {
    schemaVersion: 3,
    title: course.title,
    dayRange: { start: 0, end: 36 },
    stages: stages.map((stage, index) => {
      const lessonDays = stage.lessons.map((lesson) => lesson.day!)
      return {
        id: projectedStageIds.get(stage.stageId)!,
        order: index + 1,
        title: stage.title,
        description: stage.description,
        startDay: Math.min(...lessonDays),
        endDay: Math.max(...lessonDays),
        lessonDays,
      }
    }),
    lessons: canonicalLessons.map(({ stageId, lesson }) => {
      const state = progressById.get(lesson.lessonId)!
      return {
        id: `day-${String(lesson.day).padStart(2, "0")}`,
        day: lesson.day!,
        dayLabel: `Day ${lesson.day}`,
        title: lesson.title,
        englishTitle: null,
        objective: lesson.objective,
        goals: lesson.goals,
        stageId: projectedStageIds.get(stageId)!,
        status: state.status,
        referenceScore: state.referenceScore,
        lessonHref: lesson.lessonHref,
      }
    }),
  }
}

export async function loadCanonicalCourse(
  pathname: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {}
): Promise<CanonicalCourseLoadResult> {
  const fetcher = options.fetcher ?? fetch
  const courseId = requestedCourseId(pathname)
  const catalog = parsePublicCatalog(
    await fetchJson(fetcher, "/courses/catalog.json", options.signal)
  )
  const catalogCourse = catalog.courses.find(
    (course) => course.courseId === courseId
  )
  if (!catalogCourse) throw new Error(`课程不存在：${courseId}`)
  const [courseValue, progressValue] = await Promise.all([
    fetchJson(fetcher, catalogCourse.courseHref, options.signal),
    fetchJson(fetcher, catalogCourse.progressHref, options.signal),
  ])
  const course = parsePublicCourse(courseValue)
  const progress = parsePublicProgress(progressValue)
  validatePublicCatalogCoursePair(catalog, course)
  validatePublicCourseProgressPair(course, progress)
  return {
    courseId,
    courseRevision: course.courseRevision,
    courseData: projectCurrentRoadmap(course, progress),
  }
}
