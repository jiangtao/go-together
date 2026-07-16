import {
  parsePublicCatalog,
  parsePublicCourse,
  parsePublicProgress,
  validatePublicCatalogCoursePair,
  validatePublicCourseProgressPair,
  type PublicCatalog,
  type PublicCatalogCourse,
  type PublicCourse,
  type PublicProgress,
} from "@/lib/public-course-contract"
import type { RoadmapCourseData } from "@/types/course"

export interface CanonicalCourseLoadResult {
  courseId: string
  courseRevision: string
  catalog: PublicCatalog
  catalogCourse: PublicCatalogCourse
  courseData: RoadmapCourseData
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

export interface ResolvedCoursePath {
  courseId: string
  canonicalPath: string
  shouldNormalize: boolean
}

export function resolveCoursePath(pathname: string): ResolvedCoursePath {
  if (pathname === "/") {
    return {
      courseId: "go-backend",
      canonicalPath: "/",
      shouldNormalize: false,
    }
  }
  const match = pathname.match(/^\/courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)
  if (!match) throw new Error("当前课程 URL 无效")
  const canonicalPath = `/courses/${match[1]}`
  return {
    courseId: match[1],
    canonicalPath,
    shouldNormalize: pathname !== canonicalPath,
  }
}

function projectCurrentRoadmap(
  course: PublicCourse,
  progress: PublicProgress
): RoadmapCourseData {
  const progressById = new Map(
    progress.lessons.map((lesson) => [lesson.lessonId, lesson])
  )
  let lessonOrder = 0
  let stageOrder = 0
  const tracks = course.tracks.map((track, trackIndex) => ({
    id: track.trackId,
    order: trackIndex + 1,
    title: track.title,
    description: track.description,
    stageIds: track.stages.map((stage) => stage.stageId),
  }))
  const stages = course.tracks.flatMap((track) =>
    track.stages.map((stage) => ({
      id: stage.stageId,
      trackId: track.trackId,
      order: (stageOrder += 1),
      title: stage.title,
      description: stage.description,
      lessonIds: stage.lessons.map((lesson) => lesson.lessonId),
    }))
  )
  const lessons = course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((lesson) => {
        lessonOrder += 1
        const state = progressById.get(lesson.lessonId)
        if (!state) {
          throw new Error(`Progress 缺少 Lesson：${lesson.lessonId}`)
        }
        return {
          courseId: course.courseId,
          lessonId: lesson.lessonId,
          lifecycle: lesson.lifecycle,
          day: lesson.day,
          label: lesson.day === null ? `课次 ${lessonOrder}` : `Day ${lesson.day}`,
          title: lesson.title,
          objective: lesson.objective,
          goals: lesson.goals,
          trackId: track.trackId,
          stageId: stage.stageId,
          status: state.status,
          referenceScore: state.referenceScore,
          lessonHref: lesson.lessonHref,
        }
      })
    )
  )
  return {
    courseId: course.courseId,
    title: course.title,
    description: course.description,
    language: course.language,
    lifecycle: course.lifecycle,
    replacementCourseId: course.replacementCourseId,
    tracks,
    stages,
    lessons,
  }
}

export async function loadCanonicalCourse(
  pathname: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {}
): Promise<CanonicalCourseLoadResult> {
  const fetcher = options.fetcher ?? fetch
  const courseId = resolveCoursePath(pathname).courseId
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
    catalog,
    catalogCourse,
    courseData: projectCurrentRoadmap(course, progress),
  }
}
