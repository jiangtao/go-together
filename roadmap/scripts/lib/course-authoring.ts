import {
  compileCourseContract,
  listAuthoringPaths,
  parseSourceCatalog,
  parseSourceCourse,
  validateSourceCatalogTransition,
  validateSourceCourseTransition,
  type AuthoringFiles,
  type CompiledCourseContract,
  type SourceCatalog,
  type SourceCatalogCourse,
  type SourceCourse,
} from "./course-contract.ts"

export interface DraftCourseAuthoringRequest {
  catalog: unknown
  course: unknown
  authoringFiles: AuthoringFiles
  existingPaths?: readonly string[]
}

export interface DraftLessonAuthoringRequest {
  currentCourse: unknown
  nextCourse: unknown
  currentFiles: AuthoringFiles
  nextFiles: AuthoringFiles
  existingPaths?: readonly string[]
}

export interface CoursePublicationRequest {
  previousCatalog: unknown
  nextCatalog: unknown
  previousCourse: unknown
  nextCourse: unknown
  authoringFiles: AuthoringFiles
}

export interface CourseAuthoringValidation {
  catalog: SourceCatalog
  course: SourceCourse
  compiled: CompiledCourseContract
  targets: string[]
}

export interface DraftLessonValidation {
  currentCourse: SourceCourse
  nextCourse: SourceCourse
  compiled: CompiledCourseContract
  addedLessonIds: string[]
  targets: string[]
}

function catalogEntry(course: SourceCourse): SourceCatalogCourse {
  return {
    courseId: course.courseId,
    title: course.title,
    language: course.language,
    lifecycle: course.lifecycle,
    replacementCourseId: course.replacementCourseId,
    manifestPath: `courses/${course.courseId}/course.json`,
  }
}

function courseLessonIds(course: SourceCourse): string[] {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) => stage.lessons.map((lesson) => lesson.lessonId))
  )
}

function courseFileTargets(course: SourceCourse): string[] {
  return listAuthoringPaths(course).map((relative) =>
    `courses/${course.courseId}/${relative}`
  )
}

export function authoringTargets(courseValue: unknown): string[] {
  const course = parseSourceCourse(courseValue)
  return [`courses/${course.courseId}/course.json`, ...courseFileTargets(course)]
}

export function assertAuthoringTargetsAvailable(
  requestedPaths: readonly string[],
  existingPaths: readonly string[]
): void {
  const requested = requestedPaths.map((entry) => entry.toLocaleLowerCase("en-US"))
  if (new Set(requested).size !== requested.length) {
    throw new Error("authoring targets contain duplicates")
  }
  const existing = new Set(
    existingPaths.map((entry) => entry.toLocaleLowerCase("en-US"))
  )
  const collisions = requestedPaths.filter((entry) =>
    existing.has(entry.toLocaleLowerCase("en-US"))
  )
  if (collisions.length > 0) {
    throw new Error(`authoring target already exists: ${collisions.join(", ")}`)
  }
}

export function validateDraftCourse(
  request: DraftCourseAuthoringRequest
): CourseAuthoringValidation {
  const catalog = parseSourceCatalog(request.catalog)
  const course = parseSourceCourse(request.course)
  if (course.lifecycle !== "draft") {
    throw new Error("new courses must start as draft")
  }
  if (catalog.courses.some((entry) => entry.courseId === course.courseId)) {
    throw new Error(`course ${course.courseId} already exists`)
  }
  const nextCatalog = validateSourceCatalogTransition(catalog, {
    ...catalog,
    courses: [...catalog.courses, catalogEntry(course)],
  })
  const targets = authoringTargets(course)
  assertAuthoringTargetsAvailable(targets, request.existingPaths ?? [])
  const compiled = compileCourseContract(course, request.authoringFiles)
  return { catalog: nextCatalog, course, compiled, targets }
}

export function validateDraftLessonAddition(
  request: DraftLessonAuthoringRequest
): DraftLessonValidation {
  const currentCourse = parseSourceCourse(request.currentCourse)
  const nextCourse = parseSourceCourse(request.nextCourse)
  if (currentCourse.lifecycle !== "draft" || nextCourse.lifecycle !== "draft") {
    throw new Error("lesson additions are allowed only for draft courses")
  }
  validateSourceCourseTransition(currentCourse, nextCourse)
  const currentIds = new Set(courseLessonIds(currentCourse))
  const nextIds = courseLessonIds(nextCourse)
  const nextIdSet = new Set(nextIds)
  if ([...currentIds].some((lessonId) => !nextIdSet.has(lessonId))) {
    throw new Error("lesson addition must preserve existing lessons")
  }
  const addedLessonIds = nextIds.filter((lessonId) => !currentIds.has(lessonId))
  if (addedLessonIds.length !== 1) {
    throw new Error("lesson addition requires a new lessonId")
  }
  const currentTargets = new Set(courseFileTargets(currentCourse))
  const targets = authoringTargets(nextCourse).filter(
    (target) => !currentTargets.has(target)
  )
  assertAuthoringTargetsAvailable(targets, request.existingPaths ?? [])
  const compiled = compileCourseContract(nextCourse, request.nextFiles)
  compileCourseContract(currentCourse, request.currentFiles)
  return { currentCourse, nextCourse, compiled, addedLessonIds, targets }
}

export function validateCoursePublication(
  request: CoursePublicationRequest
): CourseAuthoringValidation {
  const previousCatalog = parseSourceCatalog(request.previousCatalog)
  const nextCatalog = validateSourceCatalogTransition(
    previousCatalog,
    request.nextCatalog
  )
  const previousCourse = parseSourceCourse(request.previousCourse)
  const course = parseSourceCourse(request.nextCourse)
  if (previousCourse.lifecycle !== "draft" || course.lifecycle !== "published") {
    throw new Error("publication requires a draft to published transition")
  }
  validateSourceCourseTransition(previousCourse, course)
  const declaration = nextCatalog.courses.find(
    (entry) => entry.courseId === course.courseId
  )
  if (!declaration || declaration.lifecycle !== "published") {
    throw new Error("published course must be published in the catalog")
  }
  const compiled = compileCourseContract(course, request.authoringFiles)
  return {
    catalog: nextCatalog,
    course,
    compiled,
    targets: authoringTargets(course),
  }
}
