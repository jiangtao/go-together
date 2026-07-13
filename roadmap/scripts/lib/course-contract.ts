import { createHash } from "node:crypto"
import path from "node:path"

import {
  COURSE_STATUSES,
  type CourseStatus,
} from "../../src/types/course.ts"
import {
  parsePublicCatalog as parseSharedPublicCatalog,
  parsePublicCourse as parseSharedPublicCourse,
  parsePublicProgress as parseSharedPublicProgress,
  validatePublicCatalogCoursePair as validateSharedPublicCatalogCoursePair,
  type PublicCatalog as SharedPublicCatalog,
  type PublicCatalogCourse as SharedPublicCatalogCourse,
  type PublicCourse as SharedPublicCourse,
  type PublicLanguage as SharedPublicLanguage,
  type PublicLesson as SharedPublicLesson,
  type PublicProgress as SharedPublicProgress,
  type PublicProgressLesson as SharedProgressLesson,
  type PublicStage as SharedPublicStage,
  type PublicTrack as SharedPublicTrack,
} from "../../src/lib/public-course-contract.ts"

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/

type JsonRecord = Record<string, unknown>

export type CourseLifecycle = "draft" | "published" | "retired"
export type PublicCourseLifecycle = Exclude<CourseLifecycle, "draft">
export type LessonLifecycle = "active" | "retired"
export type Language = SharedPublicLanguage
export type PublicCatalogCourse = SharedPublicCatalogCourse
export type PublicCatalog = SharedPublicCatalog
export type PublicLesson = SharedPublicLesson
export type PublicStage = SharedPublicStage
export type PublicTrack = SharedPublicTrack
export type PublicCourse = SharedPublicCourse
export type ProgressLesson = SharedProgressLesson
export type PublicProgress = SharedPublicProgress

export interface SourceCatalogCourse {
  courseId: string
  title: string
  language: Language
  lifecycle: CourseLifecycle
  replacementCourseId: string | null
  manifestPath: string
}

export interface SourceCatalog {
  schemaVersion: 1
  defaultCourseId: string
  courses: SourceCatalogCourse[]
}

export interface CourseResource {
  resourceId: string
  label: string
  path: string
}

export interface LessonEvaluationContract {
  competencies: Array<{ competencyId: string; title: string }>
  requiredEvidence: string[]
  scoringBasis: string[]
}

export interface SourceLesson {
  lessonId: string
  lifecycle: LessonLifecycle
  day: number | null
  title: string
  objective: string
  goals: string[]
  contentPath: string
  exerciseTemplatePath: string | null
  evaluation: LessonEvaluationContract
}

export interface SourceStage {
  stageId: string
  title: string
  description: string
  lessons: SourceLesson[]
}

export interface SourceTrack {
  trackId: string
  title: string
  description: string
  stages: SourceStage[]
}

export interface SourceCourse {
  schemaVersion: 1
  courseId: string
  title: string
  description: string
  language: Language
  lifecycle: CourseLifecycle
  replacementCourseId: string | null
  evaluationPolicyPath: string
  commandProfilePath: string
  publicResources: CourseResource[]
  internalResources: CourseResource[]
  tracks: SourceTrack[]
}

export interface ReleaseProgressSnapshot extends PublicProgress {
  privateInputDigest: string
}

export interface EvaluationHistoryEntry {
  evaluationRevision: string
  status: CourseStatus
  referenceScore: number | null
  competencies: Array<{ competencyId: string; score: number }>
}

export interface EvaluationRecord {
  schemaVersion: 1
  courseId: string
  lessonId: string
  history: EvaluationHistoryEntry[]
}

export type AuthoringFiles = Record<string, string>

export interface CompiledLesson {
  courseId: string
  trackId: string
  stageId: string
  lessonId: string
  lifecycle: LessonLifecycle
  day: number | null
  contentRevision: string
  evaluationRevision: string
}

export interface CompiledCourseContract {
  course: SourceCourse
  courseRevision: string
  lessons: CompiledLesson[]
}

export interface DerivedCourseProgress {
  progress: PublicProgress
  summary: { activeLessons: number; passed: number }
  recommendedLessonId: string | null
}

export interface PublicReleaseBundleInput {
  catalog: unknown
  course: unknown
  snapshot: unknown
  publicLessonFiles: Record<string, string>
}

const COURSE_LIFECYCLE_TRANSITIONS: Record<
  CourseLifecycle,
  readonly CourseLifecycle[]
> = {
  draft: ["draft", "published"],
  published: ["published", "retired"],
  retired: ["retired"],
}

const LANGUAGE_KEYS = ["id", "label"] as const
const SOURCE_CATALOG_KEYS = ["schemaVersion", "defaultCourseId", "courses"] as const
const SOURCE_CATALOG_COURSE_KEYS = [
  "courseId",
  "title",
  "language",
  "lifecycle",
  "replacementCourseId",
  "manifestPath",
] as const
const SOURCE_COURSE_KEYS = [
  "schemaVersion",
  "courseId",
  "title",
  "description",
  "language",
  "lifecycle",
  "replacementCourseId",
  "evaluationPolicyPath",
  "commandProfilePath",
  "publicResources",
  "internalResources",
  "tracks",
] as const
const RESOURCE_KEYS = ["resourceId", "label", "path"] as const
const TRACK_KEYS = ["trackId", "title", "description", "stages"] as const
const STAGE_KEYS = ["stageId", "title", "description", "lessons"] as const
const LESSON_KEYS = [
  "lessonId",
  "lifecycle",
  "day",
  "title",
  "objective",
  "goals",
  "contentPath",
  "exerciseTemplatePath",
  "evaluation",
] as const
const EVALUATION_CONTRACT_KEYS = [
  "competencies",
  "requiredEvidence",
  "scoringBasis",
] as const
const COMPETENCY_CONTRACT_KEYS = ["competencyId", "title"] as const
const PROGRESS_KEYS = ["schemaVersion", "courseId", "courseRevision", "lessons"] as const
const SNAPSHOT_KEYS = [
  "schemaVersion",
  "courseId",
  "courseRevision",
  "privateInputDigest",
  "lessons",
] as const
const PROGRESS_LESSON_KEYS = ["lessonId", "status", "referenceScore"] as const
const EVALUATION_RECORD_KEYS = ["schemaVersion", "courseId", "lessonId", "history"] as const
const EVALUATION_HISTORY_KEYS = [
  "evaluationRevision",
  "status",
  "referenceScore",
  "competencies",
] as const
const EVALUATION_SCORE_KEYS = ["competencyId", "score"] as const

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function record(value: unknown, context: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${context} 必须是对象`)
  return value
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

function string(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} 必须是非空字符串`)
  }
}

function id(value: unknown, context: string): asserts value is string {
  string(value, context)
  if (!ID_PATTERN.test(value)) throw new Error(`${context} 必须是稳定 kebab-case ID`)
}

function revision(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || !REVISION_PATTERN.test(value)) {
    throw new Error(`${context} 必须是 sha256: 修订`)
  }
}

function schemaOne(value: unknown, context: string): void {
  if (value !== 1) throw new Error(`${context}.schemaVersion 必须为 1`)
}

function nullableId(value: unknown, context: string): asserts value is string | null {
  if (value !== null) id(value, context)
}

function lifecycle(value: unknown, context: string): asserts value is CourseLifecycle {
  if (!["draft", "published", "retired"].includes(String(value))) {
    throw new Error(`${context} 不是有效 Course 生命周期`)
  }
}

function lessonLifecycle(
  value: unknown,
  context: string
): asserts value is LessonLifecycle {
  if (!["active", "retired"].includes(String(value))) {
    throw new Error(`${context} 不是有效 Lesson 生命周期`)
  }
}

function day(value: unknown, context: string): asserts value is number | null {
  if (value !== null && (!Number.isInteger(value) || Number(value) < 0)) {
    throw new Error(`${context} 必须是 null 或非负整数`)
  }
}

function status(value: unknown, context: string): asserts value is CourseStatus {
  if (!COURSE_STATUSES.includes(value as CourseStatus)) {
    throw new Error(`${context} 不是允许的四态`)
  }
}

function score(value: unknown, context: string): asserts value is number | null {
  if (
    value !== null &&
    (typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100)
  ) {
    throw new Error(`${context} 必须是 null 或 0-100 分数`)
  }
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${context} 必须是非空数组`)
  }
  value.forEach((entry, index) => string(entry, `${context}[${index}]`))
  return value as string[]
}

function safePath(value: unknown, context: string): asserts value is string {
  string(value, context)
  if (
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes(":") ||
    value.includes("%") ||
    [...value].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    }) ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === "." ||
    value === ".." ||
    value.startsWith("../")
  ) {
    throw new Error(`${context} 必须是安全相对 POSIX 路径`)
  }
}

function parseLanguage(value: unknown, context: string): Language {
  const language = record(value, context)
  exact(language, LANGUAGE_KEYS, context)
  id(language.id, `${context}.id`)
  string(language.label, `${context}.label`)
  return structuredClone(language) as unknown as Language
}

function unique(values: string[], context: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${context} 包含重复值`)
}

function assertCourseLifecycleTransition(
  previous: CourseLifecycle,
  next: CourseLifecycle
): void {
  if (!COURSE_LIFECYCLE_TRANSITIONS[previous].includes(next)) {
    throw new Error("Course 生命周期只能 Draft→Published→Retired 单向推进")
  }
}

function validateCatalogRelationships<T extends {
  courseId: string
  language: Language
  lifecycle: CourseLifecycle
  replacementCourseId: string | null
}>(courses: T[], defaultCourseId: string): void {
  const byId = new Map(courses.map((course) => [course.courseId, course]))
  const languageLabels = new Map<string, string>()
  for (const course of courses) {
    const knownLabel = languageLabels.get(course.language.id)
    if (knownLabel !== undefined && knownLabel !== course.language.label) {
      throw new Error("同一 Language ID 必须使用稳定 label")
    }
    languageLabels.set(course.language.id, course.language.label)
  }
  const defaultCourse = byId.get(defaultCourseId)
  if (!defaultCourse || defaultCourse.lifecycle !== "published") {
    throw new Error("Default Course 必须 Published")
  }
  for (const course of courses) {
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
    let current: T | undefined = course
    while (current?.replacementCourseId) {
      if (visited.has(current.courseId)) {
        throw new Error("Replacement Course 必须无环")
      }
      visited.add(current.courseId)
      current = byId.get(current.replacementCourseId)
    }
  }
}

export function parseSourceCatalog(value: unknown): SourceCatalog {
  const catalog = record(value, "sourceCatalog")
  exact(catalog, SOURCE_CATALOG_KEYS, "sourceCatalog")
  schemaOne(catalog.schemaVersion, "sourceCatalog")
  id(catalog.defaultCourseId, "sourceCatalog.defaultCourseId")
  if (!Array.isArray(catalog.courses) || catalog.courses.length === 0) {
    throw new Error("sourceCatalog.courses 必须是非空数组")
  }
  const courses = catalog.courses.map((candidate, index) => {
    const context = `sourceCatalog.courses[${index}]`
    const course = record(candidate, context)
    exact(course, SOURCE_CATALOG_COURSE_KEYS, context)
    id(course.courseId, `${context}.courseId`)
    string(course.title, `${context}.title`)
    const language = parseLanguage(course.language, `${context}.language`)
    lifecycle(course.lifecycle, `${context}.lifecycle`)
    nullableId(course.replacementCourseId, `${context}.replacementCourseId`)
    safePath(course.manifestPath, `${context}.manifestPath`)
    if (course.manifestPath !== `courses/${course.courseId}/course.json`) {
      throw new Error(`${context}.manifestPath 必须由 courseId 决定`)
    }
    return { ...structuredClone(course), language } as unknown as SourceCatalogCourse
  })
  unique(courses.map((course) => course.courseId), "sourceCatalog.courseId")
  validateCatalogRelationships(courses, catalog.defaultCourseId)
  return { schemaVersion: 1, defaultCourseId: catalog.defaultCourseId, courses }
}

export function validateSourceCatalogTransition(
  previousValue: unknown,
  nextValue: unknown
): SourceCatalog {
  const previous = parseSourceCatalog(previousValue)
  const next = parseSourceCatalog(nextValue)
  const nextById = new Map(next.courses.map((course) => [course.courseId, course]))
  for (const course of previous.courses) {
    const successor = nextById.get(course.courseId)
    if (!successor) {
      if (course.lifecycle !== "draft") {
        throw new Error("Published 或 Retired Course ID 必须永久保留")
      }
      continue
    }
    assertCourseLifecycleTransition(course.lifecycle, successor.lifecycle)
    if (
      successor.language.id !== course.language.id ||
      successor.language.label !== course.language.label ||
      successor.manifestPath !== course.manifestPath
    ) {
      throw new Error("既有 Course 的 Language 与 manifestPath 不可重绑")
    }
  }
  return next
}

export function validateSourceCourseTransition(
  previousValue: unknown,
  nextValue: unknown
): SourceCourse {
  const previous = parseSourceCourse(previousValue)
  const next = parseSourceCourse(nextValue)
  if (previous.courseId !== next.courseId) {
    throw new Error("Source Course transition 不得改变 courseId")
  }
  assertCourseLifecycleTransition(previous.lifecycle, next.lifecycle)
  if (
    previous.language.id !== next.language.id ||
    previous.language.label !== next.language.label
  ) {
    throw new Error("Source Course transition 不得重绑 Language")
  }
  if (previous.lifecycle === "draft") return next

  const previousTracks = previous.tracks.map((track) => track.trackId)
  const nextTracks = new Set(next.tracks.map((track) => track.trackId))
  const previousStages = previous.tracks.flatMap((track) =>
    track.stages.map((stage) => stage.stageId)
  )
  const nextStages = new Set(
    next.tracks.flatMap((track) => track.stages.map((stage) => stage.stageId))
  )
  const previousLessons = new Map(
    flattenSourceLessons(previous).map(({ lesson }) => [lesson.lessonId, lesson])
  )
  const nextLessons = new Map(
    flattenSourceLessons(next).map(({ lesson }) => [lesson.lessonId, lesson])
  )
  if (previousTracks.some((trackId) => !nextTracks.has(trackId))) {
    throw new Error("Published Track ID 必须永久保留")
  }
  if (previousStages.some((stageId) => !nextStages.has(stageId))) {
    throw new Error("Published Stage ID 必须永久保留")
  }
  for (const [lessonId, lesson] of previousLessons) {
    const successor = nextLessons.get(lessonId)
    if (!successor) throw new Error("Published Lesson ID 必须永久保留")
    if (lesson.lifecycle === "retired" && successor.lifecycle !== "retired") {
      throw new Error("Retired Lesson 是终态")
    }
  }
  return next
}

function parseResource(
  value: unknown,
  context: string,
  prefix: string
): CourseResource {
  const resource = record(value, context)
  exact(resource, RESOURCE_KEYS, context)
  id(resource.resourceId, `${context}.resourceId`)
  string(resource.label, `${context}.label`)
  safePath(resource.path, `${context}.path`)
  if (!resource.path.startsWith(prefix)) {
    throw new Error(`${context}.path 必须位于 ${prefix}`)
  }
  return structuredClone(resource) as unknown as CourseResource
}

function parseEvaluationContract(
  value: unknown,
  context: string
): LessonEvaluationContract {
  const evaluation = record(value, context)
  exact(evaluation, EVALUATION_CONTRACT_KEYS, context)
  if (!Array.isArray(evaluation.competencies) || evaluation.competencies.length === 0) {
    throw new Error(`${context}.competencies 必须是非空数组`)
  }
  const competencies = evaluation.competencies.map((candidate, index) => {
    const competencyContext = `${context}.competencies[${index}]`
    const competency = record(candidate, competencyContext)
    exact(competency, COMPETENCY_CONTRACT_KEYS, competencyContext)
    id(competency.competencyId, `${competencyContext}.competencyId`)
    string(competency.title, `${competencyContext}.title`)
    return structuredClone(competency) as { competencyId: string; title: string }
  })
  unique(competencies.map((entry) => entry.competencyId), `${context}.competencyId`)
  return {
    competencies,
    requiredEvidence: stringArray(evaluation.requiredEvidence, `${context}.requiredEvidence`),
    scoringBasis: stringArray(evaluation.scoringBasis, `${context}.scoringBasis`),
  }
}

interface CurriculumLessonIdentity {
  lessonId: string
  day: number | null
}

type ParsedCurriculum<TLesson> = Array<{
  trackId: string
  title: string
  description: string
  stages: Array<{
    stageId: string
    title: string
    description: string
    lessons: TLesson[]
  }>
}>

function parseCurriculum<TLesson extends CurriculumLessonIdentity>(
  value: unknown,
  context: string,
  parseLesson: (candidate: unknown, lessonContext: string) => TLesson
): ParsedCurriculum<TLesson> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${context} 必须是非空数组`)
  }
  const trackIds: string[] = []
  const stageIds: string[] = []
  const lessonIds: string[] = []
  const days: number[] = []
  const tracks = value.map((trackCandidate, trackIndex) => {
    const trackContext = `${context}[${trackIndex}]`
    const track = record(trackCandidate, trackContext)
    exact(track, TRACK_KEYS, trackContext)
    id(track.trackId, `${trackContext}.trackId`)
    string(track.title, `${trackContext}.title`)
    string(track.description, `${trackContext}.description`)
    if (!Array.isArray(track.stages) || track.stages.length === 0) {
      throw new Error(`${trackContext}.stages 必须是非空数组`)
    }
    trackIds.push(track.trackId)
    const stages = track.stages.map((stageCandidate, stageIndex) => {
      const stageContext = `${trackContext}.stages[${stageIndex}]`
      const stage = record(stageCandidate, stageContext)
      exact(stage, STAGE_KEYS, stageContext)
      id(stage.stageId, `${stageContext}.stageId`)
      string(stage.title, `${stageContext}.title`)
      string(stage.description, `${stageContext}.description`)
      if (!Array.isArray(stage.lessons) || stage.lessons.length === 0) {
        throw new Error(`${stageContext}.lessons 必须是非空数组`)
      }
      stageIds.push(stage.stageId)
      const lessons = stage.lessons.map((lesson, lessonIndex) => {
        const parsed = parseLesson(
          lesson,
          `${stageContext}.lessons[${lessonIndex}]`
        )
        lessonIds.push(parsed.lessonId)
        if (parsed.day !== null) days.push(parsed.day)
        return parsed
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
  unique(trackIds, `${context} 包含重复 trackId`)
  unique(stageIds, `${context} 包含重复 stageId`)
  unique(lessonIds, `${context} 包含重复 lessonId`)
  unique(days.map(String), `${context} 包含重复 Day`)
  return tracks
}

function parseSourceLesson(value: unknown, context: string): SourceLesson {
  const lesson = record(value, context)
  exact(lesson, LESSON_KEYS, context)
  id(lesson.lessonId, `${context}.lessonId`)
  lessonLifecycle(lesson.lifecycle, `${context}.lifecycle`)
  day(lesson.day, `${context}.day`)
  string(lesson.title, `${context}.title`)
  string(lesson.objective, `${context}.objective`)
  const goals = stringArray(lesson.goals, `${context}.goals`)
  safePath(lesson.contentPath, `${context}.contentPath`)
  if (lesson.contentPath !== `lessons/${lesson.lessonId}.md`) {
    throw new Error(`${context}.contentPath 不能替代 Lesson identity`)
  }
  if (lesson.exerciseTemplatePath !== null) {
    safePath(lesson.exerciseTemplatePath, `${context}.exerciseTemplatePath`)
    if (
      !lesson.exerciseTemplatePath.startsWith(
        `exercise-templates/${lesson.lessonId}/`
      )
    ) {
      throw new Error(`${context}.exerciseTemplatePath 与 Lesson identity 不一致`)
    }
  }
  const evaluation = parseEvaluationContract(
    lesson.evaluation,
    `${context}.evaluation`
  )
  return {
    lessonId: lesson.lessonId,
    lifecycle: lesson.lifecycle,
    day: lesson.day,
    title: lesson.title,
    objective: lesson.objective,
    goals,
    contentPath: lesson.contentPath,
    exerciseTemplatePath: lesson.exerciseTemplatePath,
    evaluation,
  }
}

export function parseSourceCourse(value: unknown): SourceCourse {
  const course = record(value, "sourceCourse")
  exact(course, SOURCE_COURSE_KEYS, "sourceCourse")
  schemaOne(course.schemaVersion, "sourceCourse")
  id(course.courseId, "sourceCourse.courseId")
  string(course.title, "sourceCourse.title")
  string(course.description, "sourceCourse.description")
  const language = parseLanguage(course.language, "sourceCourse.language")
  lifecycle(course.lifecycle, "sourceCourse.lifecycle")
  nullableId(course.replacementCourseId, "sourceCourse.replacementCourseId")
  if (course.replacementCourseId === course.courseId) {
    throw new Error("Course 不能替代自身")
  }
  if (course.replacementCourseId !== null && course.lifecycle !== "retired") {
    throw new Error("只有 Retired Course 可以声明 Replacement")
  }
  safePath(course.evaluationPolicyPath, "sourceCourse.evaluationPolicyPath")
  safePath(course.commandProfilePath, "sourceCourse.commandProfilePath")
  if (!course.evaluationPolicyPath.startsWith("evaluation/")) {
    throw new Error("evaluationPolicyPath 必须位于 evaluation/")
  }
  if (!course.commandProfilePath.startsWith("evaluation/")) {
    throw new Error("commandProfilePath 必须位于 evaluation/")
  }
  if (!Array.isArray(course.publicResources) || !Array.isArray(course.internalResources)) {
    throw new Error("Course resources 必须是数组")
  }
  const publicResources = course.publicResources.map((resource, index) =>
    parseResource(resource, `sourceCourse.publicResources[${index}]`, "resources/public/")
  )
  if (publicResources.some((resource) => resource.path !== resource.path.toLowerCase())) {
    throw new Error("Public Resource 路径必须全小写")
  }
  const internalResources = course.internalResources.map((resource, index) =>
    parseResource(resource, `sourceCourse.internalResources[${index}]`, "resources/internal/")
  )
  unique(
    [...publicResources, ...internalResources].map((resource) => resource.resourceId),
    "sourceCourse.resourceId"
  )
  const tracks = parseCurriculum(
    course.tracks,
    "sourceCourse.tracks",
    parseSourceLesson
  )
  const authoringPaths = [
    course.evaluationPolicyPath,
    course.commandProfilePath,
    ...publicResources.map((resource) => resource.path),
    ...internalResources.map((resource) => resource.path),
    ...tracks.flatMap((track) =>
      track.stages.flatMap((stage) =>
        stage.lessons.flatMap((lesson) => [
          lesson.contentPath,
          ...(lesson.exerciseTemplatePath ? [lesson.exerciseTemplatePath] : []),
        ])
      )
    ),
  ]
  unique(
    authoringPaths.map((relative) => relative.toLocaleLowerCase("en-US")),
    "sourceCourse authoring path 大小写折叠后"
  )
  return {
    schemaVersion: 1,
    courseId: course.courseId,
    title: course.title,
    description: course.description,
    language,
    lifecycle: course.lifecycle,
    replacementCourseId: course.replacementCourseId,
    evaluationPolicyPath: course.evaluationPolicyPath,
    commandProfilePath: course.commandProfilePath,
    publicResources,
    internalResources,
    tracks,
  }
}

export function parsePublicCatalog(value: unknown): PublicCatalog {
  return parseSharedPublicCatalog(value)
}

export function parsePublicCourse(value: unknown): PublicCourse {
  return parseSharedPublicCourse(value)
}

function parseProgressLesson(value: unknown, context: string): ProgressLesson {
  const lesson = record(value, context)
  exact(lesson, PROGRESS_LESSON_KEYS, context)
  id(lesson.lessonId, `${context}.lessonId`)
  status(lesson.status, `${context}.status`)
  score(lesson.referenceScore, `${context}.referenceScore`)
  if (lesson.status === "未开始" && lesson.referenceScore !== null) {
    throw new Error(`${context} 未开始时 referenceScore 必须为 null`)
  }
  return structuredClone(lesson) as unknown as ProgressLesson
}

function parseProgressLike(
  value: unknown,
  context: string,
  snapshot: boolean
): PublicProgress | ReleaseProgressSnapshot {
  const progress = record(value, context)
  exact(progress, snapshot ? SNAPSHOT_KEYS : PROGRESS_KEYS, context)
  schemaOne(progress.schemaVersion, context)
  id(progress.courseId, `${context}.courseId`)
  revision(progress.courseRevision, `${context}.courseRevision`)
  let inputDigest: string | undefined
  if (snapshot) {
    revision(progress.privateInputDigest, `${context}.privateInputDigest`)
    inputDigest = progress.privateInputDigest
  }
  if (!Array.isArray(progress.lessons) || progress.lessons.length === 0) {
    throw new Error(`${context}.lessons 必须是非空数组`)
  }
  const lessons = progress.lessons.map((lesson, index) =>
    parseProgressLesson(lesson, `${context}.lessons[${index}]`)
  )
  unique(lessons.map((lesson) => lesson.lessonId), `${context}.lessonId`)
  return snapshot
    ? {
        schemaVersion: 1,
        courseId: progress.courseId,
        courseRevision: progress.courseRevision,
        privateInputDigest: inputDigest!,
        lessons,
      }
    : {
        schemaVersion: 1,
        courseId: progress.courseId,
        courseRevision: progress.courseRevision,
        lessons,
      }
}

export function parsePublicProgress(value: unknown): PublicProgress {
  return parseSharedPublicProgress(value)
}

export function parseReleaseProgressSnapshot(
  value: unknown
): ReleaseProgressSnapshot {
  return parseProgressLike(
    value,
    "releaseProgressSnapshot",
    true
  ) as ReleaseProgressSnapshot
}

export function parseEvaluationRecord(value: unknown): EvaluationRecord {
  const evaluation = record(value, "evaluationRecord")
  exact(evaluation, EVALUATION_RECORD_KEYS, "evaluationRecord")
  schemaOne(evaluation.schemaVersion, "evaluationRecord")
  id(evaluation.courseId, "evaluationRecord.courseId")
  id(evaluation.lessonId, "evaluationRecord.lessonId")
  if (!Array.isArray(evaluation.history) || evaluation.history.length === 0) {
    throw new Error("evaluationRecord.history 必须是非空数组")
  }
  const history = evaluation.history.map((candidate, historyIndex) => {
    const context = `evaluationRecord.history[${historyIndex}]`
    const entry = record(candidate, context)
    exact(entry, EVALUATION_HISTORY_KEYS, context)
    revision(entry.evaluationRevision, `${context}.evaluationRevision`)
    status(entry.status, `${context}.status`)
    score(entry.referenceScore, `${context}.referenceScore`)
    if (entry.status === "未开始" && entry.referenceScore !== null) {
      throw new Error(`${context} 未开始时 referenceScore 必须为 null`)
    }
    if (!Array.isArray(entry.competencies) || entry.competencies.length === 0) {
      throw new Error(`${context}.competencies 必须是非空数组`)
    }
    const competencies = entry.competencies.map((candidateScore, scoreIndex) => {
      const scoreContext = `${context}.competencies[${scoreIndex}]`
      const competency = record(candidateScore, scoreContext)
      exact(competency, EVALUATION_SCORE_KEYS, scoreContext)
      id(competency.competencyId, `${scoreContext}.competencyId`)
      if (!Number.isInteger(competency.score) || Number(competency.score) < 0 || Number(competency.score) > 4) {
        throw new Error(`${scoreContext}.score 必须是 0-4 整数`)
      }
      return structuredClone(competency) as { competencyId: string; score: number }
    })
    unique(competencies.map((item) => item.competencyId), `${context}.competencyId`)
    return { ...structuredClone(entry), competencies } as unknown as EvaluationHistoryEntry
  })
  const passedRevisions = new Set<string>()
  for (const entry of history) {
    if (
      passedRevisions.has(entry.evaluationRevision) &&
      entry.status !== "通过"
    ) {
      throw new Error("同一 evaluationRevision 一旦通过便不可回退")
    }
    if (entry.status === "通过") passedRevisions.add(entry.evaluationRevision)
  }
  return {
    schemaVersion: 1,
    courseId: evaluation.courseId,
    lessonId: evaluation.lessonId,
    history,
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  }
  return value
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")}`
}

function normalizedText(value: string, context: string): string {
  if (value.includes("\0")) throw new Error(`${context} 包含 NUL`)
  return value.replace(/\r\n/g, "\n")
}

function flattenSourceLessons(course: SourceCourse): Array<{
  trackId: string
  stageId: string
  lesson: SourceLesson
}> {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((lesson) => ({
        trackId: track.trackId,
        stageId: stage.stageId,
        lesson,
      }))
    )
  )
}

export function listAuthoringPaths(course: SourceCourse): string[] {
  return [
    course.evaluationPolicyPath,
    course.commandProfilePath,
    ...course.publicResources.map((resource) => resource.path),
    ...course.internalResources.map((resource) => resource.path),
    ...flattenSourceLessons(course).flatMap(({ lesson }) => [
      lesson.contentPath,
      ...(lesson.exerciseTemplatePath ? [lesson.exerciseTemplatePath] : []),
    ]),
  ].sort()
}

function parseAuthoringFiles(course: SourceCourse, files: AuthoringFiles): AuthoringFiles {
  if (!isRecord(files)) throw new Error("authoringFiles 必须是路径到文本的对象")
  const required = listAuthoringPaths(course)
  const actual = Object.keys(files).sort()
  if (
    actual.length !== required.length ||
    actual.some((entry, index) => entry !== required[index])
  ) {
    throw new Error("authoringFiles 与 Source Course 显式路径不一致")
  }
  return Object.fromEntries(
    required.map((relative) => {
      safePath(relative, "authoringFiles path")
      const content = files[relative]
      if (typeof content !== "string") throw new Error(`authoringFiles ${relative} 必须是文本`)
      return [relative, normalizedText(content, relative)]
    })
  )
}

export function compileCourseContract(
  value: unknown,
  inputFiles: AuthoringFiles
): CompiledCourseContract {
  const course = parseSourceCourse(value)
  const files = parseAuthoringFiles(course, inputFiles)
  const policy = files[course.evaluationPolicyPath]
  const commandProfile = files[course.commandProfilePath]
  const lessons = flattenSourceLessons(course).map(({ trackId, stageId, lesson }) => ({
    courseId: course.courseId,
    trackId,
    stageId,
    lessonId: lesson.lessonId,
    lifecycle: lesson.lifecycle,
    day: lesson.day,
    contentRevision: digest({ content: files[lesson.contentPath] }),
    evaluationRevision: digest({
      evaluation: lesson.evaluation,
      policy,
      commandProfile,
      exerciseTemplate:
        lesson.exerciseTemplatePath === null
          ? null
          : files[lesson.exerciseTemplatePath],
    }),
  }))
  const fileRevisions = Object.fromEntries(
    Object.entries(files).map(([relative, content]) => [relative, digest(content)])
  )
  const courseRevision = digest({
    course,
    lessons: lessons.map((lesson) => ({
      trackId: lesson.trackId,
      stageId: lesson.stageId,
      lessonId: lesson.lessonId,
      lifecycle: lesson.lifecycle,
      day: lesson.day,
      contentRevision: lesson.contentRevision,
      evaluationRevision: lesson.evaluationRevision,
    })),
    fileRevisions,
  })
  return { course, courseRevision, lessons }
}

function parsedEvaluations(
  compiled: CompiledCourseContract,
  values: unknown[]
): EvaluationRecord[] {
  const lessonIds = new Set(compiled.lessons.map((lesson) => lesson.lessonId))
  const evaluations = values.map(parseEvaluationRecord)
  for (const evaluation of evaluations) {
    if (evaluation.courseId !== compiled.course.courseId) {
      throw new Error("Evaluation 属于错误 Course")
    }
    if (!lessonIds.has(evaluation.lessonId)) {
      throw new Error(`Evaluation 引用了未知 Lesson: ${evaluation.lessonId}`)
    }
  }
  unique(evaluations.map((entry) => entry.lessonId), "Evaluation lessonId")
  return evaluations
}

function deriveParsedCourseProgress(
  compiled: CompiledCourseContract,
  evaluations: EvaluationRecord[]
): DerivedCourseProgress {
  const byLesson = new Map(evaluations.map((entry) => [entry.lessonId, entry]))
  const lessons = compiled.lessons.map((lesson) => {
    const latest = byLesson.get(lesson.lessonId)?.history.at(-1)
    return latest?.evaluationRevision === lesson.evaluationRevision
      ? {
          lessonId: lesson.lessonId,
          status: latest.status,
          referenceScore: latest.referenceScore,
        }
      : {
          lessonId: lesson.lessonId,
          status: "未开始" as const,
          referenceScore: null,
        }
  })
  const progress = parsePublicProgress({
    schemaVersion: 1,
    courseId: compiled.course.courseId,
    courseRevision: compiled.courseRevision,
    lessons,
  })
  const activeLessonIds = new Set(
    compiled.lessons
      .filter((lesson) => lesson.lifecycle === "active")
      .map((lesson) => lesson.lessonId)
  )
  const active = progress.lessons.filter((lesson) => activeLessonIds.has(lesson.lessonId))
  return {
    progress,
    summary: {
      activeLessons: active.length,
      passed: active.filter((lesson) => lesson.status === "通过").length,
    },
    recommendedLessonId:
      active.find((lesson) => lesson.status !== "通过")?.lessonId ?? null,
  }
}

export function deriveCourseProgress(
  compiled: CompiledCourseContract,
  values: unknown[]
): DerivedCourseProgress {
  return deriveParsedCourseProgress(compiled, parsedEvaluations(compiled, values))
}

function privateInputDigest(
  compiled: CompiledCourseContract,
  evaluations: EvaluationRecord[]
): string {
  const byLesson = new Map(evaluations.map((entry) => [entry.lessonId, entry]))
  return digest({
    courseId: compiled.course.courseId,
    courseRevision: compiled.courseRevision,
    evaluations: compiled.lessons
      .map((lesson) => byLesson.get(lesson.lessonId) ?? null)
      .filter((entry) => entry !== null),
  })
}

export function exportReleaseProgressSnapshot(
  compiled: CompiledCourseContract,
  values: unknown[],
  files: AuthoringFiles
): ReleaseProgressSnapshot {
  if (compiled.course.lifecycle === "draft") {
    throw new Error("Draft Course 不导出 Release Progress Snapshot")
  }
  const fresh = compileCourseContract(compiled.course, files)
  if (JSON.stringify(fresh) !== JSON.stringify(compiled)) {
    throw new Error("Course authoring inputs 与 compiled revision 不一致")
  }
  const evaluations = parsedEvaluations(compiled, values)
  const derived = deriveParsedCourseProgress(compiled, evaluations)
  return parseReleaseProgressSnapshot({
    schemaVersion: 1,
    courseId: compiled.course.courseId,
    courseRevision: compiled.courseRevision,
    privateInputDigest: privateInputDigest(compiled, evaluations),
    lessons: derived.progress.lessons,
  })
}

export function validateReleaseSnapshotForAuthoring(
  value: unknown,
  compiled: CompiledCourseContract,
  evaluations: unknown[],
  files: AuthoringFiles
): ReleaseProgressSnapshot {
  const snapshot = parseReleaseProgressSnapshot(value)
  const expected = exportReleaseProgressSnapshot(compiled, evaluations, files)
  if (snapshot.privateInputDigest !== expected.privateInputDigest) {
    throw new Error("Release Snapshot 私有输入摘要不一致")
  }
  if (JSON.stringify(snapshot) !== JSON.stringify(expected)) {
    throw new Error("Release Snapshot 与 authoring facts 不一致")
  }
  return snapshot
}

function publicLessonIds(course: PublicCourse): string[] {
  return publicLessons(course).map((lesson) => lesson.lessonId)
}

function publicLessons(course: PublicCourse): PublicLesson[] {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) => stage.lessons)
  )
}

export function validatePublicCourseContent(
  courseValue: unknown,
  publicFiles: Record<string, string>
): PublicCourse {
  const course = parsePublicCourse(courseValue)
  if (!isRecord(publicFiles)) throw new Error("Public Lesson files 必须是对象")
  const lessons = publicLessons(course)
  const expectedHrefs = lessons.map((lesson) => lesson.lessonHref).sort()
  const actualHrefs = Object.keys(publicFiles).sort()
  if (
    expectedHrefs.length !== actualHrefs.length ||
    expectedHrefs.some((href, index) => href !== actualHrefs[index])
  ) {
    throw new Error("Public Lesson files 与 Public Course 枚举不一致")
  }
  for (const lesson of lessons) {
    const content = publicFiles[lesson.lessonHref]
    if (typeof content !== "string") {
      throw new Error(`Public Lesson 缺失: ${lesson.lessonHref}`)
    }
    if (
      digest({ content: normalizedText(content, lesson.lessonHref) }) !==
      lesson.contentRevision
    ) {
      throw new Error(`Public Lesson 内容摘要不一致: ${lesson.lessonId}`)
    }
  }
  return course
}

export function validateReleaseSnapshotForPublicCourse(
  snapshotValue: unknown,
  courseValue: unknown
): ReleaseProgressSnapshot {
  const snapshot = parseReleaseProgressSnapshot(snapshotValue)
  const course = parsePublicCourse(courseValue)
  if (snapshot.courseId !== course.courseId) {
    throw new Error("Release Snapshot courseId 与 Public Course 不一致")
  }
  if (snapshot.courseRevision !== course.courseRevision) {
    throw new Error("Release Snapshot courseRevision 与 Public Course 不一致")
  }
  const expectedLessonIds = publicLessonIds(course)
  const actualLessonIds = snapshot.lessons.map((lesson) => lesson.lessonId)
  if (
    expectedLessonIds.length !== actualLessonIds.length ||
    expectedLessonIds.some((lessonId, index) => lessonId !== actualLessonIds[index])
  ) {
    throw new Error("Release Snapshot Lesson 集合与顺序不一致")
  }
  return snapshot
}

export function validatePublicReleaseBundle(
  input: PublicReleaseBundleInput
): {
  catalog: PublicCatalog
  course: PublicCourse
  snapshot: ReleaseProgressSnapshot
} {
  const catalog = parsePublicCatalog(input.catalog)
  const course = validatePublicCourseContent(
    input.course,
    input.publicLessonFiles
  )
  validatePublicCatalogCoursePair(catalog, course)
  return {
    catalog,
    course,
    snapshot: validateReleaseSnapshotForPublicCourse(input.snapshot, course),
  }
}

export function validatePublicCatalogCoursePair(
  catalogValue: unknown,
  courseValue: unknown
): { catalog: PublicCatalog; course: PublicCourse } {
  const catalog = parsePublicCatalog(catalogValue)
  const course = parsePublicCourse(courseValue)
  validateSharedPublicCatalogCoursePair(catalog, course)
  return { catalog, course }
}
