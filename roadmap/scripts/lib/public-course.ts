import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  parseLegacyCourseData,
  type LegacyCourseData,
  type LegacyCourseLesson,
  type LegacyCourseStage,
} from "./legacy-course-data.ts"
import {
  listAuthoringPaths,
  parseReleaseProgressSnapshot,
  parseSourceCatalog,
  parseSourceCourse,
  type AuthoringFiles,
  type ReleaseProgressSnapshot,
  type SourceCourse,
} from "./course-contract.ts"
import { buildMultiCoursePublicArtifacts } from "./multi-course-public.ts"
import { assertCanonicalInputTree } from "./canonical-input-tree.ts"

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
export const ROADMAP_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "../..")
export const REPOSITORY_ROOT = path.resolve(ROADMAP_DIRECTORY, "..")
export const SOURCE_CATALOG_FILE = path.join(
  REPOSITORY_ROOT,
  "courses/catalog.json"
)
export const RELEASE_PROGRESS_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "release-progress"
)
export const GENERATED_PUBLIC_DIRECTORY = path.join(
  ROADMAP_DIRECTORY,
  ".generated/public"
)

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*$/
const MARKDOWN_FENCE = /^\s*(`{3,}|~{3,})/
const FORBIDDEN_PUBLIC_SECTION =
  /\b(?:capstone[\s_-]*)?rubric\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|测评(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评(?:表|标准|得分|分数)?/i
const FORBIDDEN_PUBLIC_SENTENCE =
  /\b(?:capstone[\s_-]*)?rubric\b|\b(?:answer\s+key|model\s+answer|evaluation\s+(?:criteria|result)|grading\s+criteria)\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|测评(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评/i
const REPOSITORY_GOVERNANCE_REFERENCE =
  /docs[\\/]go-learning[\\/]|(?:^|[\s("'`])exercise[\\/]|roadmap[\\/]src[\\/]data[\\/]course\.json|\]\((?:README\.md|\.\.?[\\/])/i
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LEGACY_HREF_PATTERN =
  /^\/sources\/lessons\/day-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

interface PublicCourseBuildOptions {
  repositoryRoot?: string
  outputDirectory?: string
}

interface GoCompatibilityStage {
  stageId: string
  canonicalStageId: string
  title: string
  description: string
}

interface GoCompatibilityLesson {
  lessonId: string
  legacyId: string
  legacyHref: string
  englishTitle: string | null
}

interface GoCompatibility {
  schemaVersion: 1
  courseId: "go-backend"
  legacyTitle: string
  dayRange: { start: 0; end: 36 }
  stages: GoCompatibilityStage[]
  lessons: GoCompatibilityLesson[]
}

function sanitizeNarrativeLine(line: string): string | null {
  if (REPOSITORY_GOVERNANCE_REFERENCE.test(line)) return null
  if (!FORBIDDEN_PUBLIC_SENTENCE.test(line)) return line
  const prefixMatch = line.match(
    /^(\s*(?:(?:[-*+]|\d+[.)])\s+|>\s+))?([\s\S]*)$/
  )
  const prefix = prefixMatch?.[1] ?? ""
  const body = prefixMatch?.[2] ?? line
  if (prefix) return null
  const safeBody = (body.match(/[^。！？!?]+[。！？!?]?/g) ?? [body])
    .filter((sentence) => !FORBIDDEN_PUBLIC_SENTENCE.test(sentence))
    .join("")
    .trim()
  return safeBody ? `${prefix}${safeBody}` : null
}

function pruneEmptySections(lines: string[]): string[] {
  const result = [...lines]
  let changed = true
  while (changed) {
    changed = false
    for (let index = 0; index < result.length; index += 1) {
      const heading = result[index].match(MARKDOWN_HEADING)
      if (!heading || heading[1].length === 1) continue
      let end = result.length
      for (let candidate = index + 1; candidate < result.length; candidate += 1) {
        const nextHeading = result[candidate].match(MARKDOWN_HEADING)
        if (nextHeading && nextHeading[1].length <= heading[1].length) {
          end = candidate
          break
        }
      }
      const hasContent = result
        .slice(index + 1, end)
        .some((line) => line.trim() && !MARKDOWN_HEADING.test(line))
      if (!hasContent) {
        result.splice(index, end - index)
        changed = true
        break
      }
    }
  }
  return result
}

function renumberOrderedLists(lines: string[]): string[] {
  let inFence = false
  let activeIndent: string | null = null
  let nextNumber = 1
  return lines.map((line) => {
    if (MARKDOWN_FENCE.test(line)) {
      inFence = !inFence
      return line
    }
    if (inFence) return line
    const item = line.match(/^(\s*)\d+\.\s+(.+)$/)
    if (item) {
      if (activeIndent !== item[1]) {
        activeIndent = item[1]
        nextNumber = 1
      }
      const numbered = `${item[1]}${nextNumber}. ${item[2]}`
      nextNumber += 1
      return numbered
    }
    if (line.trim() && !/^\s+[-*+]\s+/.test(line)) {
      activeIndent = null
      nextNumber = 1
    }
    return line
  })
}

export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\\(\S)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

export function projectPublicLessonMarkdown(
  markdown: string,
  fileName = "lesson.md"
): string {
  const lines = markdown.split(/\r?\n/)
  const projected: string[] = []
  let inFence = false
  let excludedHeadingLevel: number | null = null
  for (const line of lines) {
    if (MARKDOWN_FENCE.test(line)) {
      if (excludedHeadingLevel === null) projected.push(line)
      inFence = !inFence
      continue
    }
    if (inFence) {
      if (excludedHeadingLevel === null) projected.push(line)
      continue
    }
    const heading = line.match(MARKDOWN_HEADING)
    if (heading) {
      const level = heading[1].length
      if (excludedHeadingLevel !== null && level > excludedHeadingLevel) continue
      excludedHeadingLevel = null
      if (FORBIDDEN_PUBLIC_SECTION.test(stripInlineMarkdown(heading[2]))) {
        excludedHeadingLevel = level
        continue
      }
      projected.push(line)
      continue
    }
    if (excludedHeadingLevel !== null) continue
    const safeLine = sanitizeNarrativeLine(line)
    if (safeLine !== null) projected.push(safeLine)
  }
  const result = renumberOrderedLists(pruneEmptySections(projected))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n")
  if (!/^#\s+\S/m.test(result)) {
    throw new Error(`${fileName}: 公开投影缺少一级标题`)
  }
  if (
    FORBIDDEN_PUBLIC_SENTENCE.test(result) ||
    REPOSITORY_GOVERNANCE_REFERENCE.test(result)
  ) {
    throw new Error(`${fileName}: 公开投影仍包含禁止的治理材料或仓库路径`)
  }
  return result
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function readSafeRegularFile(root: string, filePath: string): Promise<string> {
  const logicalRoot = path.resolve(root)
  const rootMetadata = await lstat(logicalRoot)
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error(`拒绝读取符号链接目录或非目录：${root}`)
  }
  const absoluteRoot = await realpath(logicalRoot)
  const absoluteFile = path.resolve(filePath)
  if (!isInside(logicalRoot, absoluteFile)) {
    throw new Error(`拒绝读取目录外文件：${filePath}`)
  }
  const metadata = await lstat(absoluteFile)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`拒绝读取符号链接或非普通文件：${filePath}`)
  }
  const resolvedFile = await realpath(absoluteFile)
  if (!isInside(absoluteRoot, resolvedFile)) {
    throw new Error(`拒绝读取符号链接越界文件：${filePath}`)
  }
  return readFile(resolvedFile, "utf8")
}

async function readJson(root: string, file: string, context: string): Promise<unknown> {
  const source = await readSafeRegularFile(root, file)
  try {
    return JSON.parse(source)
  } catch {
    throw new Error(`${context} 不是合法 JSON`)
  }
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function exact(
  value: Record<string, unknown>,
  keys: string[],
  context: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${context} 字段不精确`)
  }
}

function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} 必须是非空字符串`)
  }
  return value
}

function parseGoCompatibility(value: unknown): GoCompatibility {
  const compatibility = object(value, "Go compatibility")
  exact(
    compatibility,
    ["schemaVersion", "courseId", "legacyTitle", "dayRange", "stages", "lessons"],
    "Go compatibility"
  )
  if (compatibility.schemaVersion !== 1 || compatibility.courseId !== "go-backend") {
    throw new Error("Go compatibility identity 或 schema 无效")
  }
  const dayRange = object(compatibility.dayRange, "Go compatibility.dayRange")
  exact(dayRange, ["start", "end"], "Go compatibility.dayRange")
  if (dayRange.start !== 0 || dayRange.end !== 36) {
    throw new Error("Go legacy dayRange 必须永久保持 0–36")
  }
  if (!Array.isArray(compatibility.stages) || compatibility.stages.length !== 6) {
    throw new Error("Go legacy compatibility 必须包含六个 Stage")
  }
  const stages = compatibility.stages.map((candidate, index) => {
    const stage = object(candidate, `Go compatibility.stages[${index}]`)
    exact(
      stage,
      ["stageId", "canonicalStageId", "title", "description"],
      `Go compatibility.stages[${index}]`
    )
    const stageId = requiredString(stage.stageId, "legacy stageId")
    const canonicalStageId = requiredString(
      stage.canonicalStageId,
      "canonicalStageId"
    )
    if (!/^stage-[1-6]$/.test(stageId) || !ID_PATTERN.test(canonicalStageId)) {
      throw new Error("Go compatibility Stage ID 无效")
    }
    return {
      stageId,
      canonicalStageId,
      title: requiredString(stage.title, "legacy stage title"),
      description: requiredString(stage.description, "legacy stage description"),
    }
  })
  if (
    new Set(stages.map(({ stageId }) => stageId)).size !== stages.length ||
    new Set(stages.map(({ canonicalStageId }) => canonicalStageId)).size !==
      stages.length
  ) {
    throw new Error("Go compatibility Stage mapping 必须一一对应")
  }
  if (!Array.isArray(compatibility.lessons) || compatibility.lessons.length !== 37) {
    throw new Error("Go legacy compatibility 必须包含 37 个 Lesson")
  }
  const lessons = compatibility.lessons.map((candidate, index) => {
    const lesson = object(candidate, `Go compatibility.lessons[${index}]`)
    exact(
      lesson,
      ["lessonId", "legacyId", "legacyHref", "englishTitle"],
      `Go compatibility.lessons[${index}]`
    )
    const lessonId = requiredString(lesson.lessonId, "lessonId")
    const legacyId = requiredString(lesson.legacyId, "legacyId")
    const legacyHref = requiredString(lesson.legacyHref, "legacyHref")
    const match = legacyHref.match(LEGACY_HREF_PATTERN)
    if (
      !ID_PATTERN.test(lessonId) ||
      !match ||
      legacyId !== `day-${match[1]}` ||
      Number(match[1]) !== index
    ) {
      throw new Error("Go compatibility Lesson mapping 无效")
    }
    if (lesson.englishTitle !== null && typeof lesson.englishTitle !== "string") {
      throw new Error("Go compatibility englishTitle 必须是 string 或 null")
    }
    return {
      lessonId,
      legacyId,
      legacyHref,
      englishTitle: lesson.englishTitle as string | null,
    }
  })
  if (
    new Set(lessons.map(({ lessonId }) => lessonId)).size !== lessons.length ||
    new Set(lessons.map(({ legacyHref }) => legacyHref)).size !== lessons.length
  ) {
    throw new Error("Go compatibility Lesson mapping 必须一一对应")
  }
  return {
    schemaVersion: 1,
    courseId: "go-backend",
    legacyTitle: requiredString(compatibility.legacyTitle, "legacyTitle"),
    dayRange: { start: 0, end: 36 },
    stages,
    lessons,
  }
}

function flattenCourseLessons(course: SourceCourse) {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((lesson) => ({ stage, lesson }))
    )
  )
}

function createLegacyCourseData(
  course: SourceCourse,
  snapshot: ReleaseProgressSnapshot,
  compatibility: GoCompatibility
): LegacyCourseData {
  if (course.courseId !== "go-backend" || snapshot.courseId !== "go-backend") {
    throw new Error("根级 legacy projection 永久只属于 go-backend")
  }
  const sourceLessons = flattenCourseLessons(course)
  const sourceById = new Map(
    sourceLessons.map(({ stage, lesson }) => [lesson.lessonId, { stage, lesson }])
  )
  const progressById = new Map(snapshot.lessons.map((lesson) => [lesson.lessonId, lesson]))
  const stageMapping = new Map(
    compatibility.stages.map((stage) => [stage.canonicalStageId, stage])
  )
  if (
    sourceLessons.length !== 37 ||
    sourceLessons.some(({ lesson }, index) => lesson.day !== index) ||
    compatibility.lessons.some(({ lessonId }) => !sourceById.has(lessonId)) ||
    sourceLessons.some(({ lesson }) =>
      !compatibility.lessons.some(({ lessonId }) => lessonId === lesson.lessonId)
    )
  ) {
    throw new Error("Go source 与 37 条 explicit compatibility mapping 不一致")
  }
  const lessons: LegacyCourseLesson[] = compatibility.lessons.map((mapping, day) => {
    const source = sourceById.get(mapping.lessonId)!
    const progress = progressById.get(mapping.lessonId)
    const legacyStage = stageMapping.get(source.stage.stageId)
    if (!progress || !legacyStage || source.lesson.day !== day) {
      throw new Error("Go legacy Course、Progress 与 Stage mapping 不一致")
    }
    return {
      id: mapping.legacyId,
      day,
      dayLabel: `Day ${day}`,
      title: source.lesson.title,
      englishTitle: mapping.englishTitle,
      objective: source.lesson.objective,
      goals: source.lesson.goals,
      stageId: legacyStage.stageId,
      status: progress.status,
      referenceScore: progress.referenceScore,
      lessonHref: mapping.legacyHref,
    }
  })
  const stages: LegacyCourseStage[] = compatibility.stages.map((mapping, index) => {
    const lessonDays = lessons
      .filter((lesson) => lesson.stageId === mapping.stageId)
      .map((lesson) => lesson.day)
    if (lessonDays.length === 0) throw new Error("Go legacy Stage 不得为空")
    return {
      id: mapping.stageId,
      title: mapping.title,
      description: mapping.description,
      order: index + 1,
      startDay: Math.min(...lessonDays),
      endDay: Math.max(...lessonDays),
      lessonDays,
    }
  })
  return parseLegacyCourseData({
    schemaVersion: 3,
    title: compatibility.legacyTitle,
    dayRange: compatibility.dayRange,
    stages,
    lessons,
  })
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await lstat(file)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

export async function buildPublicArtifacts(
  options: PublicCourseBuildOptions = {}
): Promise<LegacyCourseData> {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? REPOSITORY_ROOT)
  const outputDirectory =
    options.outputDirectory ??
    (repositoryRoot === REPOSITORY_ROOT
      ? GENERATED_PUBLIC_DIRECTORY
      : path.join(repositoryRoot, "roadmap/.generated/public"))
  const sourceCatalog = parseSourceCatalog(
    await readJson(
      repositoryRoot,
      path.join(repositoryRoot, "courses/catalog.json"),
      "Source Catalog"
    )
  )
  await assertCanonicalInputTree(repositoryRoot, sourceCatalog)
  const courseInputs: Array<{
    sourceCourse: SourceCourse
    authoringFiles: AuthoringFiles
    publicLessonFiles: Record<string, string>
    snapshot?: unknown
  }> = []
  let goSource: SourceCourse | undefined
  let goSnapshot: ReleaseProgressSnapshot | undefined
  for (const catalogCourse of sourceCatalog.courses) {
    const manifestFile = path.join(repositoryRoot, catalogCourse.manifestPath)
    const sourceCourse = parseSourceCourse(
      await readJson(repositoryRoot, manifestFile, `Course ${catalogCourse.courseId}`)
    )
    const courseDirectory = path.dirname(manifestFile)
    const entries = await Promise.all(
      listAuthoringPaths(sourceCourse).map(async (relative) => [
        relative,
        await readSafeRegularFile(
          courseDirectory,
          path.join(courseDirectory, ...relative.split("/"))
        ),
      ] as const)
    )
    const authoringFiles = Object.fromEntries(entries)
    const publicLessonFiles = Object.fromEntries(
      flattenCourseLessons(sourceCourse).map(({ lesson }) => [
        lesson.contentPath,
        projectPublicLessonMarkdown(
          authoringFiles[lesson.contentPath],
          `${sourceCourse.courseId}/${lesson.contentPath}`
        ),
      ])
    )
    const snapshotFile = path.join(
      repositoryRoot,
      `release-progress/${sourceCourse.courseId}.json`
    )
    const snapshot = (await pathExists(snapshotFile))
      ? await readJson(repositoryRoot, snapshotFile, `Snapshot ${sourceCourse.courseId}`)
      : undefined
    courseInputs.push({
      sourceCourse,
      authoringFiles,
      publicLessonFiles,
      snapshot,
    })
    if (sourceCourse.courseId === "go-backend") {
      goSource = sourceCourse
      if (snapshot !== undefined) goSnapshot = parseReleaseProgressSnapshot(snapshot)
    }
  }
  if (!goSource || !goSnapshot) {
    throw new Error("永久根兼容要求 go-backend Course 与 Snapshot")
  }
  const goDirectory = path.join(repositoryRoot, "courses/go-backend")
  const compatibility = parseGoCompatibility(
    await readJson(
      goDirectory,
      path.join(goDirectory, "compatibility.json"),
      "Go compatibility"
    )
  )
  const legacyCourse = createLegacyCourseData(
    goSource,
    goSnapshot,
    compatibility
  )
  await buildMultiCoursePublicArtifacts({
    sourceCatalog,
    courses: courseInputs,
    outputDirectory,
    legacy: {
      courseId: "go-backend",
      courseData: legacyCourse,
      lessons: compatibility.lessons.map(({ lessonId, legacyHref }) => ({
        lessonId,
        legacyHref,
      })),
    },
  })
  return legacyCourse
}
