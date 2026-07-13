import { COURSE_STATUSES, type CourseStatus } from "../types/course.ts"

type JsonRecord = Record<string, unknown>

export interface PublicLanguage {
  id: string
  label: string
}

export interface PublicCatalogCourse {
  courseId: string
  courseRevision: string
  title: string
  description: string
  language: PublicLanguage
  lifecycle: "published" | "retired"
  replacementCourseId: string | null
  pageHref: string
  courseHref: string
  progressHref: string
}

export interface PublicCatalog {
  schemaVersion: 1
  defaultCourseId: string
  courses: PublicCatalogCourse[]
}

export interface PublicLesson {
  lessonId: string
  lifecycle: "active" | "retired"
  day: number | null
  title: string
  objective: string
  goals: string[]
  contentRevision: string
  lessonHref: string
}

export interface PublicStage {
  stageId: string
  title: string
  description: string
  lessons: PublicLesson[]
}

export interface PublicTrack {
  trackId: string
  title: string
  description: string
  stages: PublicStage[]
}

export interface PublicCourse {
  schemaVersion: 1
  courseId: string
  courseRevision: string
  title: string
  description: string
  language: PublicLanguage
  lifecycle: "published" | "retired"
  replacementCourseId: string | null
  tracks: PublicTrack[]
}

export interface PublicProgressLesson {
  lessonId: string
  status: CourseStatus
  referenceScore: number | null
}

export interface PublicProgress {
  schemaVersion: 1
  courseId: string
  courseRevision: string
  lessons: PublicProgressLesson[]
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/
const CATALOG_KEYS = ["schemaVersion", "defaultCourseId", "courses"] as const
const CATALOG_COURSE_KEYS = [
  "courseId",
  "courseRevision",
  "title",
  "description",
  "language",
  "lifecycle",
  "replacementCourseId",
  "pageHref",
  "courseHref",
  "progressHref",
] as const
const LANGUAGE_KEYS = ["id", "label"] as const
const COURSE_KEYS = [
  "schemaVersion",
  "courseId",
  "courseRevision",
  "title",
  "description",
  "language",
  "lifecycle",
  "replacementCourseId",
  "tracks",
] as const
const TRACK_KEYS = ["trackId", "title", "description", "stages"] as const
const STAGE_KEYS = ["stageId", "title", "description", "lessons"] as const
const LESSON_KEYS = [
  "lessonId",
  "lifecycle",
  "day",
  "title",
  "objective",
  "goals",
  "contentRevision",
  "lessonHref",
] as const
const PROGRESS_KEYS = ["schemaVersion", "courseId", "courseRevision", "lessons"] as const
const PROGRESS_LESSON_KEYS = ["lessonId", "status", "referenceScore"] as const

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} 必须是对象`)
  }
  return value as JsonRecord
}

function exact(value: JsonRecord, keys: readonly string[], context: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${context} 包含缺失或非白名单字段`)
  }
}

function nonempty(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} 必须是非空字符串`)
  }
}

function id(value: unknown, context: string): asserts value is string {
  nonempty(value, context)
  if (!ID_PATTERN.test(value)) throw new Error(`${context} 必须是稳定 kebab-case ID`)
}

function revision(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || !REVISION_PATTERN.test(value)) {
    throw new Error(`${context} 必须是 sha256: 修订`)
  }
}

function nullableId(value: unknown, context: string): string | null {
  if (value === null) return null
  id(value, context)
  return value
}

function language(value: unknown, context: string): PublicLanguage {
  const parsed = record(value, context)
  exact(parsed, LANGUAGE_KEYS, context)
  id(parsed.id, `${context}.id`)
  nonempty(parsed.label, `${context}.label`)
  return { id: parsed.id, label: parsed.label }
}

function lifecycle(value: unknown, context: string): "published" | "retired" {
  if (value !== "published" && value !== "retired") {
    throw new Error(`${context} 只允许 Published 或 Retired`)
  }
  return value
}

function unique(values: string[], context: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${context} 包含重复值`)
}

function validateCatalogRelationships(
  courses: PublicCatalogCourse[],
  defaultCourseId: string
): void {
  const byId = new Map(courses.map((course) => [course.courseId, course]))
  const defaultCourse = byId.get(defaultCourseId)
  if (!defaultCourse || defaultCourse.lifecycle !== "published") {
    throw new Error("Default Course 必须 Published")
  }
  const languageLabels = new Map<string, string>()
  for (const course of courses) {
    const label = languageLabels.get(course.language.id)
    if (label !== undefined && label !== course.language.label) {
      throw new Error("同一 Language ID 必须使用稳定 label")
    }
    languageLabels.set(course.language.id, course.language.label)
    if (course.replacementCourseId === null) continue
    if (course.lifecycle !== "retired") {
      throw new Error("只有 Retired Course 可以声明 Replacement")
    }
    const replacement = byId.get(course.replacementCourseId)
    if (!replacement) throw new Error("Replacement Course 不存在")
    if (replacement.lifecycle !== "published") {
      throw new Error("Replacement Course 必须 Published")
    }
    if (replacement.language.id !== course.language.id) {
      throw new Error("Replacement Course 必须属于同一 Language")
    }
  }
  for (const course of courses) {
    const visited = new Set<string>()
    let current: PublicCatalogCourse | undefined = course
    while (current?.replacementCourseId) {
      if (visited.has(current.courseId)) throw new Error("Replacement Course 必须无环")
      visited.add(current.courseId)
      current = byId.get(current.replacementCourseId)
    }
  }
}

export function parsePublicCatalog(value: unknown): PublicCatalog {
  const catalog = record(value, "publicCatalog")
  exact(catalog, CATALOG_KEYS, "publicCatalog")
  if (catalog.schemaVersion !== 1) {
    throw new Error("publicCatalog.schemaVersion 必须为 1")
  }
  id(catalog.defaultCourseId, "publicCatalog.defaultCourseId")
  if (!Array.isArray(catalog.courses) || catalog.courses.length === 0) {
    throw new Error("publicCatalog.courses 必须是非空数组")
  }
  const courses = catalog.courses.map((candidate, index) => {
    const context = `publicCatalog.courses[${index}]`
    const course = record(candidate, context)
    exact(course, CATALOG_COURSE_KEYS, context)
    id(course.courseId, `${context}.courseId`)
    revision(course.courseRevision, `${context}.courseRevision`)
    nonempty(course.title, `${context}.title`)
    nonempty(course.description, `${context}.description`)
    const parsedLanguage = language(course.language, `${context}.language`)
    const parsedLifecycle = lifecycle(course.lifecycle, `${context}.lifecycle`)
    const replacementCourseId = nullableId(
      course.replacementCourseId,
      `${context}.replacementCourseId`
    )
    nonempty(course.pageHref, `${context}.pageHref`)
    nonempty(course.courseHref, `${context}.courseHref`)
    nonempty(course.progressHref, `${context}.progressHref`)
    if (
      course.pageHref !== `/courses/${course.courseId}` ||
      course.courseHref !== `/courses/${course.courseId}/course.json` ||
      course.progressHref !== `/courses/${course.courseId}/progress.json`
    ) {
      throw new Error(`${context} 规范 href 与 courseId 不一致`)
    }
    return {
      courseId: course.courseId,
      courseRevision: course.courseRevision,
      title: course.title,
      description: course.description,
      language: parsedLanguage,
      lifecycle: parsedLifecycle,
      replacementCourseId,
      pageHref: course.pageHref,
      courseHref: course.courseHref,
      progressHref: course.progressHref,
    }
  })
  unique(courses.map((course) => course.courseId), "publicCatalog.courseId")
  validateCatalogRelationships(courses, catalog.defaultCourseId)
  return { schemaVersion: 1, defaultCourseId: catalog.defaultCourseId, courses }
}

export function parsePublicCourse(value: unknown): PublicCourse {
  const course = record(value, "publicCourse")
  exact(course, COURSE_KEYS, "publicCourse")
  if (course.schemaVersion !== 1) {
    throw new Error("publicCourse.schemaVersion 必须为 1")
  }
  id(course.courseId, "publicCourse.courseId")
  revision(course.courseRevision, "publicCourse.courseRevision")
  nonempty(course.title, "publicCourse.title")
  nonempty(course.description, "publicCourse.description")
  const parsedLanguage = language(course.language, "publicCourse.language")
  const parsedLifecycle = lifecycle(course.lifecycle, "publicCourse.lifecycle")
  const replacementCourseId = nullableId(
    course.replacementCourseId,
    "publicCourse.replacementCourseId"
  )
  if (replacementCourseId === course.courseId) {
    throw new Error("Public Course 不能替代自身")
  }
  if (replacementCourseId !== null && parsedLifecycle !== "retired") {
    throw new Error("只有 Retired Public Course 可以声明 Replacement")
  }
  if (!Array.isArray(course.tracks) || course.tracks.length === 0) {
    throw new Error("publicCourse.tracks 必须是非空数组")
  }
  const trackIds = new Set<string>()
  const stageIds = new Set<string>()
  const lessonIds = new Set<string>()
  const days = new Set<number>()
  const tracks = course.tracks.map((trackValue, trackIndex) => {
    const trackContext = `publicCourse.tracks[${trackIndex}]`
    const track = record(trackValue, trackContext)
    exact(track, TRACK_KEYS, trackContext)
    id(track.trackId, `${trackContext}.trackId`)
    nonempty(track.title, `${trackContext}.title`)
    nonempty(track.description, `${trackContext}.description`)
    if (trackIds.has(track.trackId)) throw new Error("publicCourse 包含重复 trackId")
    trackIds.add(track.trackId)
    if (!Array.isArray(track.stages) || track.stages.length === 0) {
      throw new Error(`${trackContext}.stages 必须是非空数组`)
    }
    const stages = track.stages.map((stageValue, stageIndex) => {
      const stageContext = `${trackContext}.stages[${stageIndex}]`
      const stage = record(stageValue, stageContext)
      exact(stage, STAGE_KEYS, stageContext)
      id(stage.stageId, `${stageContext}.stageId`)
      nonempty(stage.title, `${stageContext}.title`)
      nonempty(stage.description, `${stageContext}.description`)
      if (stageIds.has(stage.stageId)) throw new Error("publicCourse 包含重复 stageId")
      stageIds.add(stage.stageId)
      if (!Array.isArray(stage.lessons) || stage.lessons.length === 0) {
        throw new Error(`${stageContext}.lessons 必须是非空数组`)
      }
      const lessons = stage.lessons.map((lessonValue, lessonIndex) => {
        const lessonContext = `${stageContext}.lessons[${lessonIndex}]`
        const lesson = record(lessonValue, lessonContext)
        exact(lesson, LESSON_KEYS, lessonContext)
        id(lesson.lessonId, `${lessonContext}.lessonId`)
        if (lessonIds.has(lesson.lessonId)) {
          throw new Error("publicCourse 包含重复 lessonId")
        }
        lessonIds.add(lesson.lessonId)
        if (lesson.lifecycle !== "active" && lesson.lifecycle !== "retired") {
          throw new Error(`${lessonContext}.lifecycle 无效`)
        }
        const parsedLessonLifecycle: PublicLesson["lifecycle"] =
          lesson.lifecycle
        if (
          lesson.day !== null &&
          (!Number.isInteger(lesson.day) || Number(lesson.day) < 0)
        ) {
          throw new Error(`${lessonContext}.day 无效`)
        }
        if (typeof lesson.day === "number") {
          if (days.has(lesson.day)) throw new Error("publicCourse 包含重复 Day")
          days.add(lesson.day)
        }
        nonempty(lesson.title, `${lessonContext}.title`)
        nonempty(lesson.objective, `${lessonContext}.objective`)
        if (!Array.isArray(lesson.goals) || lesson.goals.length === 0) {
          throw new Error(`${lessonContext}.goals 必须是非空数组`)
        }
        lesson.goals.forEach((goal, goalIndex) =>
          nonempty(goal, `${lessonContext}.goals[${goalIndex}]`)
        )
        revision(lesson.contentRevision, `${lessonContext}.contentRevision`)
        nonempty(lesson.lessonHref, `${lessonContext}.lessonHref`)
        if (
          lesson.lessonHref !==
          `/courses/${course.courseId}/sources/lessons/${lesson.lessonId}.md`
        ) {
          throw new Error(`${lessonContext}.lessonHref 与稳定 identity 不一致`)
        }
        return {
          lessonId: lesson.lessonId,
          lifecycle: parsedLessonLifecycle,
          day: lesson.day as number | null,
          title: lesson.title,
          objective: lesson.objective,
          goals: lesson.goals as string[],
          contentRevision: lesson.contentRevision,
          lessonHref: lesson.lessonHref,
        }
      })
      return {
        stageId: stage.stageId,
        title: stage.title,
        description: stage.description,
        lessons,
      }
    })
    return {
      trackId: track.trackId,
      title: track.title,
      description: track.description,
      stages,
    }
  })
  return {
    schemaVersion: 1,
    courseId: course.courseId,
    courseRevision: course.courseRevision,
    title: course.title,
    description: course.description,
    language: parsedLanguage,
    lifecycle: parsedLifecycle,
    replacementCourseId,
    tracks,
  }
}

export function parsePublicProgress(value: unknown): PublicProgress {
  const progress = record(value, "publicProgress")
  exact(progress, PROGRESS_KEYS, "publicProgress")
  if (progress.schemaVersion !== 1) {
    throw new Error("publicProgress.schemaVersion 必须为 1")
  }
  id(progress.courseId, "publicProgress.courseId")
  revision(progress.courseRevision, "publicProgress.courseRevision")
  if (!Array.isArray(progress.lessons) || progress.lessons.length === 0) {
    throw new Error("publicProgress.lessons 必须是非空数组")
  }
  const lessons = progress.lessons.map((lessonValue, index) => {
    const context = `publicProgress.lessons[${index}]`
    const lesson = record(lessonValue, context)
    exact(lesson, PROGRESS_LESSON_KEYS, context)
    id(lesson.lessonId, `${context}.lessonId`)
    if (!COURSE_STATUSES.includes(lesson.status as CourseStatus)) {
      throw new Error(`${context}.status 不是允许的四态`)
    }
    if (
      lesson.referenceScore !== null &&
      (typeof lesson.referenceScore !== "number" ||
        !Number.isFinite(lesson.referenceScore) ||
        lesson.referenceScore < 0 ||
        lesson.referenceScore > 100)
    ) {
      throw new Error(`${context}.referenceScore 必须是 null 或 0-100 分数`)
    }
    if (lesson.status === "未开始" && lesson.referenceScore !== null) {
      throw new Error(`${context} 未开始时 referenceScore 必须为 null`)
    }
    return {
      lessonId: lesson.lessonId,
      status: lesson.status as CourseStatus,
      referenceScore: lesson.referenceScore as number | null,
    }
  })
  unique(lessons.map((lesson) => lesson.lessonId), "publicProgress.lessonId")
  return {
    schemaVersion: 1,
    courseId: progress.courseId,
    courseRevision: progress.courseRevision,
    lessons,
  }
}

export function validatePublicCatalogCoursePair(
  catalog: PublicCatalog,
  course: PublicCourse
): void {
  const declaration = catalog.courses.find(
    (candidate) => candidate.courseId === course.courseId
  )
  if (!declaration) throw new Error("Public Catalog 缺少 Public Course")
  if (
    declaration.courseRevision !== course.courseRevision ||
    declaration.title !== course.title ||
    declaration.description !== course.description ||
    declaration.language.id !== course.language.id ||
    declaration.language.label !== course.language.label ||
    declaration.lifecycle !== course.lifecycle ||
    declaration.replacementCourseId !== course.replacementCourseId
  ) {
    throw new Error("Public Catalog 与 Public Course 声明不一致")
  }
}

export function validatePublicCourseProgressPair(
  course: PublicCourse,
  progress: PublicProgress
): void {
  if (
    progress.courseId !== course.courseId ||
    progress.courseRevision !== course.courseRevision
  ) {
    throw new Error("Public Course 与 Progress 声明或修订不一致")
  }
  const lessonIds = course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) => stage.lessons.map((lesson) => lesson.lessonId))
  )
  const progressIds = progress.lessons.map((lesson) => lesson.lessonId)
  if (
    lessonIds.length !== progressIds.length ||
    lessonIds.some((lessonId, index) => lessonId !== progressIds[index])
  ) {
    throw new Error("Public Course 与 Progress Lesson 集合不一致")
  }
}
