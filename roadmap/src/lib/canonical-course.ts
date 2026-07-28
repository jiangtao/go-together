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
  canonicalPath: string
  selectionReason:
    | "explicit"
    | "earliest-incomplete"
    | "earliest-complete"
    | "invalid-course-fallback"
  selectionNotice: string | null
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
  courseId: string | null
  canonicalPath: string
  shouldNormalize: boolean
}

export function resolveCoursePath(pathname: string): ResolvedCoursePath {
  if (pathname === "/") {
    return {
      courseId: null,
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

interface LoadedPublicCourse {
  catalogCourse: PublicCatalogCourse
  course: PublicCourse
  progress: PublicProgress
}

function activeLessonIds(course: PublicCourse): string[] {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons
        .filter((lesson) => lesson.lifecycle === "active")
        .map((lesson) => lesson.lessonId)
    )
  )
}

export function isPublicCourseComplete(
  course: PublicCourse,
  progress: PublicProgress
): boolean {
  const statusByLessonId = new Map(
    progress.lessons.map((lesson) => [lesson.lessonId, lesson.status])
  )
  return activeLessonIds(course).every(
    (lessonId) => statusByLessonId.get(lessonId) === "通过"
  )
}

async function loadPublicCourse(
  catalog: PublicCatalog,
  catalogCourse: PublicCatalogCourse,
  fetcher: typeof fetch,
  signal?: AbortSignal
): Promise<LoadedPublicCourse> {
  const [courseValue, progressValue] = await Promise.all([
    fetchJson(fetcher, catalogCourse.courseHref, signal),
    fetchJson(fetcher, catalogCourse.progressHref, signal),
  ])
  const course = parsePublicCourse(courseValue)
  const progress = parsePublicProgress(progressValue)
  validatePublicCatalogCoursePair(catalog, course)
  validatePublicCourseProgressPair(course, progress)
  return { catalogCourse, course, progress }
}

async function loadDefaultCourse(
  catalog: PublicCatalog,
  fetcher: typeof fetch,
  signal?: AbortSignal
): Promise<{
  loaded: LoadedPublicCourse
  reason: "earliest-incomplete" | "earliest-complete"
}> {
  // Public Catalog 的声明顺序就是没有 createdAt 时的稳定创建顺序。
  const candidates = catalog.courses.filter(
    (course) => course.lifecycle === "published"
  )
  if (candidates.length === 0) {
    throw new Error("当前没有可用于默认预览的 Published 课程")
  }

  let earliest: LoadedPublicCourse | null = null
  for (const candidate of candidates) {
    let loaded: LoadedPublicCourse
    try {
      loaded = await loadPublicCourse(catalog, candidate, fetcher, signal)
    } catch (error: unknown) {
      const cause = error instanceof Error ? error.message : "公开进度加载失败"
      throw new Error(`无法确定默认课程：${candidate.title} 的${cause}`)
    }
    earliest ??= loaded
    if (!isPublicCourseComplete(loaded.course, loaded.progress)) {
      return { loaded, reason: "earliest-incomplete" }
    }
  }

  return { loaded: earliest!, reason: "earliest-complete" }
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
  const route = resolveCoursePath(pathname)
  const catalog = parsePublicCatalog(
    await fetchJson(fetcher, "/courses/catalog.json", options.signal)
  )
  const explicitCourse = route.courseId
    ? catalog.courses.find((course) => course.courseId === route.courseId)
    : null

  let loaded: LoadedPublicCourse
  let selectionReason: CanonicalCourseLoadResult["selectionReason"]
  let selectionNotice: string | null = null
  let canonicalPath = route.canonicalPath

  if (explicitCourse) {
    loaded = await loadPublicCourse(
      catalog,
      explicitCourse,
      fetcher,
      options.signal
    )
    selectionReason = "explicit"
  } else {
    const selected = await loadDefaultCourse(catalog, fetcher, options.signal)
    loaded = selected.loaded
    selectionReason = selected.reason
    if (route.courseId !== null) {
      selectionReason = "invalid-course-fallback"
      canonicalPath = loaded.catalogCourse.pageHref
      selectionNotice = `未找到课程“${route.courseId}”，已按公开学习进度切换到“${loaded.course.title}”。`
    }
  }

  return {
    courseId: loaded.course.courseId,
    courseRevision: loaded.course.courseRevision,
    catalog,
    catalogCourse: loaded.catalogCourse,
    courseData: projectCurrentRoadmap(loaded.course, loaded.progress),
    canonicalPath,
    selectionReason,
    selectionNotice,
  }
}
