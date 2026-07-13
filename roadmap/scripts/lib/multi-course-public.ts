import {
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { parseCourseData } from "../../src/lib/course-data.ts"
import type { CourseData } from "../../src/types/course.ts"
import {
  compileCourseContract,
  parsePublicCatalog,
  parsePublicCourse,
  parsePublicProgress,
  parseReleaseProgressSnapshot,
  parseSourceCatalog,
  validatePublicReleaseBundle,
  type AuthoringFiles,
  type PublicCatalog,
  type PublicCourse,
  type PublicProgress,
  type ReleaseProgressSnapshot,
  type SourceCatalog,
  type SourceCourse,
} from "./course-contract.ts"

export interface CourseProjectionInput {
  sourceCourse: unknown
  authoringFiles: AuthoringFiles
  snapshot?: unknown
}

export interface LegacyLessonMapping {
  lessonId: string
  legacyHref: string
}

export interface LegacyPublicProjection {
  courseId: string
  courseData: unknown
  lessons: LegacyLessonMapping[]
}

export interface MultiCoursePublicBuildInput {
  sourceCatalog: unknown
  courses: CourseProjectionInput[]
  outputDirectory: string
  legacy?: LegacyPublicProjection
}

export interface MultiCoursePublicBuildResult {
  catalog: PublicCatalog
  courses: PublicCourse[]
  files: string[]
}

const DANGEROUS_PUBLIC_CONTENT: Array<[string, RegExp]> = [
  ["危险协议", /(?:javascript|data|file):/i],
  ["带凭据 URL", /https?:\/\/[^\s/@:]+:[^\s/@]+@/i],
  ["本机绝对路径", /(?:\/Users\/|\/home\/[a-z0-9._-]+\/)/i],
  ["越界相对路径", /(?:^|[\s("'])\.\.[\\/]/m],
  ["Windows 绝对路径", /\b[A-Za-z]:[\\/]/],
  ["内部治理路径", /docs[\\/]go-learning[\\/]|roadmap[\\/]src[\\/]data/i],
  ["私有学习路径", /(?:^|[\s("'])exercise[\\/]|notes(?:-eval)?\.md/i],
  ["答案或评分材料", /\b(?:answer\s+key|model\s+answer|grading\s+criteria|rubric)\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评/i],
  ["脚本 HTML", /<\s*(?:script|iframe|object|embed)\b/i],
  ["私钥", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
]
const PUBLIC_RESOURCE_SUFFIX_PATTERN =
  /^[a-z0-9._/-]+\.(?:md|json|txt)$/
const ENCODED_PATH_SEPARATOR = /%(?:00|25|2e|2f|5c)/i
const HTML_LINK_ENTITY = /&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi
const NAMED_LINK_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  bsol: "\\",
  colon: ":",
  percnt: "%",
  period: ".",
  sol: "/",
}

function assertPublicText(content: string, context: string): void {
  if (
    content.includes("\0") ||
    // eslint-disable-next-line no-control-regex -- public text rejects non-text bytes
    /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)
  ) {
    throw new Error(`${context} 包含危险控制字符或二进制伪装`)
  }
  for (const [label, pattern] of DANGEROUS_PUBLIC_CONTENT) {
    if (pattern.test(content)) throw new Error(`${context} 包含危险内容：${label}`)
  }
}

function decodeLinkEntities(destination: string, context: string): string {
  let value = destination
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false
    value = value.replace(HTML_LINK_ENTITY, (entity) => {
      changed = true
      if (entity.startsWith("&#")) {
        const hexadecimal = entity[2]?.toLowerCase() === "x"
        const digits = entity.slice(hexadecimal ? 3 : 2, -1)
        const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10)
        if (!Number.isSafeInteger(codePoint) || codePoint > 0x10ffff) {
          throw new Error(`${context} 包含无效 HTML 字符实体`)
        }
        return String.fromCodePoint(codePoint)
      }
      const decoded = NAMED_LINK_ENTITIES[entity.slice(1, -1).toLowerCase()]
      if (decoded === undefined) {
        throw new Error(`${context} 包含未白名单 HTML 字符实体`)
      }
      return decoded
    })
    if (!changed) break
  }
  if (HTML_LINK_ENTITY.test(value)) {
    throw new Error(`${context} 包含嵌套过深的 HTML 字符实体`)
  }
  return value
}

function assertSafeLinkDestination(destination: string, context: string): void {
  const value = decodeLinkEntities(
    destination.trim().replace(/^<|>$/g, ""),
    context
  )
  // eslint-disable-next-line no-control-regex -- decoded URLs reject every control byte
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${context} 链接包含危险控制字符`)
  }
  if (ENCODED_PATH_SEPARATOR.test(value)) {
    throw new Error(`${context} 包含 URL 编码的危险路径分隔符`)
  }
  if (value.startsWith("//") || /^http:\/\//i.test(value)) {
    throw new Error(`${context} 外部链接只允许 HTTPS`)
  }
  if (/^https:\/\//i.test(value)) {
    const url = new URL(value)
    if (url.username || url.password) {
      throw new Error(`${context} 外部链接不得包含凭据`)
    }
    return
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    throw new Error(`${context} 包含危险或未知协议`)
  }
  if (value.includes("\\")) throw new Error(`${context} 链接包含反斜杠`)
  const pathname = value.split(/[?#]/, 1)[0]
  if (pathname.split("/").includes("..")) {
    throw new Error(`${context} 链接尝试越界`)
  }
}

function assertSafeMarkdownLinks(markdown: string, context: string): void {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as {
    type: string
    children?: unknown[]
  }
  const inspect = (value: unknown): void => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return
    const node = value as {
      type?: unknown
      url?: unknown
      children?: unknown
    }
    if (node.type === "html") throw new Error(`${context} 不允许原始 HTML`)
    if (["link", "image", "definition"].includes(String(node.type))) {
      if (typeof node.url !== "string") {
        throw new Error(`${context} Markdown 链接缺少字符串 URL`)
      }
      assertSafeLinkDestination(node.url, context)
    }
    if (Array.isArray(node.children)) node.children.forEach(inspect)
  }
  inspect(tree)
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function flattenSourceLessons(course: SourceCourse) {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((lesson) => ({ track, stage, lesson }))
    )
  )
}

function sourceCourseMatchesCatalog(
  course: SourceCourse,
  catalogCourse: SourceCatalog["courses"][number]
): boolean {
  return (
    course.courseId === catalogCourse.courseId &&
    course.title === catalogCourse.title &&
    course.language.id === catalogCourse.language.id &&
    course.language.label === catalogCourse.language.label &&
    course.lifecycle === catalogCourse.lifecycle &&
    course.replacementCourseId === catalogCourse.replacementCourseId
  )
}

function publicCourseFromSource(
  source: SourceCourse,
  courseRevision: string,
  compiledLessons: ReturnType<typeof compileCourseContract>["lessons"]
): PublicCourse {
  if (source.lifecycle === "draft") {
    throw new Error("Draft Course 不得生成 Public Course")
  }
  const revisions = new Map(
    compiledLessons.map((lesson) => [lesson.lessonId, lesson.contentRevision])
  )
  return parsePublicCourse({
    schemaVersion: 1,
    courseId: source.courseId,
    courseRevision,
    title: source.title,
    description: source.description,
    language: source.language,
    lifecycle: source.lifecycle,
    replacementCourseId: source.replacementCourseId,
    tracks: source.tracks.map((track) => ({
      trackId: track.trackId,
      title: track.title,
      description: track.description,
      stages: track.stages.map((stage) => ({
        stageId: stage.stageId,
        title: stage.title,
        description: stage.description,
        lessons: stage.lessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          lifecycle: lesson.lifecycle,
          day: lesson.day,
          title: lesson.title,
          objective: lesson.objective,
          goals: lesson.goals,
          contentRevision: revisions.get(lesson.lessonId),
          lessonHref: `/courses/${source.courseId}/sources/lessons/${lesson.lessonId}.md`,
        })),
      })),
    })),
  })
}

function publicProgressFromSnapshot(
  snapshot: ReleaseProgressSnapshot
): PublicProgress {
  return parsePublicProgress({
    schemaVersion: 1,
    courseId: snapshot.courseId,
    courseRevision: snapshot.courseRevision,
    lessons: snapshot.lessons,
  })
}

function assertExactCourseSet(
  catalog: SourceCatalog,
  courses: SourceCourse[]
): void {
  const expected = catalog.courses.map((course) => course.courseId).sort()
  const actual = courses.map((course) => course.courseId).sort()
  if (
    expected.length !== actual.length ||
    expected.some((courseId, index) => courseId !== actual[index])
  ) {
    throw new Error("Catalog 与 Source Course 集合必须一一对应")
  }
}

function addFile(files: Map<string, string>, relative: string, content: string): void {
  if (files.has(relative)) throw new Error(`公开投影路径重复：${relative}`)
  assertPublicText(content, relative)
  if (relative.endsWith(".md")) assertSafeMarkdownLinks(content, relative)
  files.set(relative, content)
}

function addLegacyProjection(
  files: Map<string, string>,
  legacy: LegacyPublicProjection,
  publicLessonByCourse: Map<string, Map<string, string>>
): void {
  if (legacy.courseId !== "go-backend") {
    throw new Error("根级 Legacy Projection 永久只属于 go-backend")
  }
  const courseData = parseCourseData(legacy.courseData) as CourseData
  const canonical = publicLessonByCourse.get(legacy.courseId)
  if (!canonical) throw new Error("Legacy Projection 引用了未知 Public Course")
  const byHref = new Map(legacy.lessons.map((entry) => [entry.legacyHref, entry]))
  if (byHref.size !== legacy.lessons.length) {
    throw new Error("Legacy Lesson mapping 包含重复 legacyHref")
  }
  const mappedLessonIds = new Set(legacy.lessons.map((entry) => entry.lessonId))
  if (mappedLessonIds.size !== legacy.lessons.length) {
    throw new Error("Legacy Lesson mapping 包含重复 lessonId")
  }
  if (
    courseData.lessons.length !== legacy.lessons.length ||
    courseData.lessons.some((lesson) => !byHref.has(lesson.lessonHref))
  ) {
    throw new Error("Legacy Course 与显式 Lesson mapping 不一致")
  }
  addFile(files, "course.json", json(courseData))
  for (const lesson of courseData.lessons) {
    const mapping = byHref.get(lesson.lessonHref)!
    const content = canonical.get(mapping.lessonId)
    if (content === undefined) {
      throw new Error(`Legacy mapping 引用了未知 Lesson: ${mapping.lessonId}`)
    }
    const relative = lesson.lessonHref.replace(/^\//, "")
    addFile(files, relative, content)
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await lstat(candidate)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

export async function recoverInterruptedPublicSwap(
  outputDirectory: string
): Promise<void> {
  const output = path.resolve(outputDirectory)
  const backup = `${output}.previous`
  if (!(await pathExists(backup))) return
  const backupMetadata = await lstat(backup)
  if (backupMetadata.isSymbolicLink() || !backupMetadata.isDirectory()) {
    throw new Error("公开输出 previous 状态不是安全目录")
  }
  if (await pathExists(output)) {
    const outputMetadata = await lstat(output)
    if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
      throw new Error("公开输出不是安全目录")
    }
    await rm(backup, { recursive: true })
    return
  }
  await rename(backup, output)
}

async function writeEntries(
  directory: string,
  entries: Array<[string, string]>
): Promise<void> {
  for (const [relative, content] of entries.sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const destination = path.join(directory, ...relative.split("/"))
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, content, { flag: "wx" })
  }
}

async function writeAtomically(
  outputDirectory: string,
  files: Map<string, string>
): Promise<void> {
  const output = path.resolve(outputDirectory)
  const parent = path.dirname(output)
  await mkdir(parent, { recursive: true })
  await recoverInterruptedPublicSwap(output)
  const temporary = await mkdtemp(
    path.join(parent, `.${path.basename(output)}.candidate-`)
  )
  let backup: string | null = null
  const courseTemporaries: string[] = []
  try {
    const courseEntries = new Map<string, Array<[string, string]>>()
    const sharedEntries: Array<[string, string]> = []
    for (const [relative, content] of files) {
      const match = relative.match(/^courses\/([^/]+)\/(.+)$/)
      if (!match) {
        sharedEntries.push([relative, content])
        continue
      }
      const entries = courseEntries.get(match[1]) ?? []
      entries.push([match[2], content])
      courseEntries.set(match[1], entries)
    }
    await writeEntries(temporary, sharedEntries)
    await mkdir(path.join(temporary, "courses"), { recursive: true })
    for (const [courseId, entries] of [...courseEntries.entries()].sort()) {
      const courseTemporary = await mkdtemp(
        path.join(parent, `.${path.basename(output)}.course-${courseId}-`)
      )
      courseTemporaries.push(courseTemporary)
      await writeEntries(courseTemporary, entries)
      await rename(courseTemporary, path.join(temporary, "courses", courseId))
    }
    if (await pathExists(output)) {
      const metadata = await lstat(output)
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error("公开输出必须是非 symlink 目录或不存在")
      }
      backup = `${output}.previous`
      await rename(output, backup)
    }
    try {
      await rename(temporary, output)
    } catch (error) {
      if (backup !== null) await rename(backup, output)
      throw error
    }
    if (backup !== null) {
      await rm(backup, { recursive: true }).catch(() => undefined)
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
    await Promise.all(
      courseTemporaries.map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    )
  }
}

export async function buildMultiCoursePublicArtifacts(
  input: MultiCoursePublicBuildInput
): Promise<MultiCoursePublicBuildResult> {
  const sourceCatalog = parseSourceCatalog(input.sourceCatalog)
  const unorderedInputs = input.courses.map((course) => ({
    input: course,
    compiled: compileCourseContract(course.sourceCourse, course.authoringFiles),
  }))
  const parsedSources = unorderedInputs.map((entry) => entry.compiled.course)
  assertExactCourseSet(
    sourceCatalog,
    parsedSources
  )
  const inputById = new Map(
    unorderedInputs.map((entry) => [entry.compiled.course.courseId, entry])
  )
  const parsedInputs = sourceCatalog.courses.map((catalogCourse) => {
    const entry = inputById.get(catalogCourse.courseId)!
    return { ...entry, source: entry.compiled.course }
  })
  const catalogById = new Map(
    sourceCatalog.courses.map((course) => [course.courseId, course])
  )
  for (const { source } of parsedInputs) {
    const catalogCourse = catalogById.get(source.courseId)!
    if (!sourceCourseMatchesCatalog(source, catalogCourse)) {
      throw new Error(`Catalog 与 Source Course 声明不一致: ${source.courseId}`)
    }
  }

  const catalog = parsePublicCatalog({
    schemaVersion: 1,
    defaultCourseId: sourceCatalog.defaultCourseId,
    courses: parsedInputs
      .filter((entry) => entry.source.lifecycle !== "draft")
      .map(({ source, compiled }) => ({
        courseId: source.courseId,
        courseRevision: compiled.courseRevision,
        title: source.title,
        description: source.description,
        language: source.language,
        lifecycle: source.lifecycle,
        replacementCourseId: source.replacementCourseId,
        pageHref: `/courses/${source.courseId}`,
        courseHref: `/courses/${source.courseId}/course.json`,
        progressHref: `/courses/${source.courseId}/progress.json`,
      })),
  })

  const files = new Map<string, string>()
  const publicCourses: PublicCourse[] = []
  const publicLessonByCourse = new Map<string, Map<string, string>>()

  for (const { input: courseInput, source, compiled } of parsedInputs) {
    if (source.lifecycle === "draft") {
      if (courseInput.snapshot !== undefined) {
        throw new Error("Draft Course 不得提供 Release Progress Snapshot")
      }
      continue
    }
    if (courseInput.snapshot === undefined) {
      throw new Error(`Course 缺少 Release Progress Snapshot: ${source.courseId}`)
    }
    const snapshot = parseReleaseProgressSnapshot(courseInput.snapshot)
    const publicCourse = publicCourseFromSource(
      source,
      compiled.courseRevision,
      compiled.lessons
    )
    const lessonFiles = Object.fromEntries(
      flattenSourceLessons(source).map(({ lesson }) => [
        `/courses/${source.courseId}/sources/lessons/${lesson.lessonId}.md`,
        courseInput.authoringFiles[lesson.contentPath],
      ])
    )
    validatePublicReleaseBundle({
      catalog,
      course: publicCourse,
      snapshot,
      publicLessonFiles: lessonFiles,
    })
    publicCourses.push(publicCourse)
    const progress = publicProgressFromSnapshot(snapshot)
    publicLessonByCourse.set(
      source.courseId,
      new Map(
        flattenSourceLessons(source).map(({ lesson }) => [
          lesson.lessonId,
          courseInput.authoringFiles[lesson.contentPath],
        ])
      )
    )

    const base = `courses/${source.courseId}`
    addFile(files, `${base}/course.json`, json(publicCourse))
    addFile(files, `${base}/progress.json`, json(progress))
    for (const [href, content] of Object.entries(lessonFiles)) {
      addFile(files, href.replace(/^\//, ""), content)
    }
    for (const resource of source.publicResources) {
      const suffix = resource.path.slice("resources/public/".length)
      if (!PUBLIC_RESOURCE_SUFFIX_PATTERN.test(suffix)) {
        throw new Error(`Public resource 不是受支持的文本白名单：${suffix}`)
      }
      addFile(
        files,
        `${base}/sources/resources/${suffix}`,
        courseInput.authoringFiles[resource.path]
      )
    }
  }

  addFile(files, "courses/catalog.json", json(catalog))
  if (input.legacy) {
    addLegacyProjection(files, input.legacy, publicLessonByCourse)
  }
  await writeAtomically(input.outputDirectory, files)
  return {
    catalog,
    courses: publicCourses,
    files: [...files.keys()].sort(),
  }
}
