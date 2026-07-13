import { createHash } from "node:crypto"
import {
  lstat,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseCourseData } from "../../src/lib/course-data.ts"
import {
  COURSE_STATUSES,
  type CourseData,
  type CourseLesson,
  type CourseStage,
  type CourseStatus,
} from "../../src/types/course.ts"
import {
  compileCourseContract,
  parseReleaseProgressSnapshot,
  type AuthoringFiles,
  type SourceCatalog,
  type SourceCourse,
} from "./course-contract.ts"
import { buildMultiCoursePublicArtifacts } from "./multi-course-public.ts"

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
export const ROADMAP_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "../..")
export const REPOSITORY_ROOT = path.resolve(ROADMAP_DIRECTORY, "..")
export const LESSONS_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "docs/go-learning/daily-lessons"
)
export const PROGRESS_FILE = path.join(
  ROADMAP_DIRECTORY,
  "content/progress.public.json"
)
export const GENERATED_PUBLIC_DIRECTORY = path.join(
  ROADMAP_DIRECTORY,
  ".generated/public"
)

const LESSON_FILE_PATTERN =
  /^day-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const PROGRESS_KEYS = ["day", "status", "referenceScore"] as const
const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*$/
const MARKDOWN_FENCE = /^\s*(`{3,}|~{3,})/
const FORBIDDEN_PUBLIC_SECTION =
  /\b(?:capstone[\s_-]*)?rubric\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|测评(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评(?:表|标准|得分|分数)?/i
const FORBIDDEN_PUBLIC_SENTENCE =
  /\b(?:capstone[\s_-]*)?rubric\b|\b(?:answer\s+key|model\s+answer|evaluation\s+(?:criteria|result)|grading\s+criteria)\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|测评(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评/i
const REPOSITORY_GOVERNANCE_REFERENCE =
  /docs[\\/]go-learning[\\/]|(?:^|[\s("'`])exercise[\\/]|roadmap[\\/]src[\\/]data[\\/]course\.json|\]\((?:README\.md|\.\.?[\\/])/i

const STAGE_DEFINITIONS = [
  {
    id: "stage-1",
    title: "起步与语言基础",
    description: "从学习动机进入 Go 工具链、值模型、数据结构与接口边界。",
    startDay: 0,
    endDay: 6,
  },
  {
    id: "stage-2",
    title: "HTTP 与数据入口",
    description: "串起路由、DTO、错误映射、测试、pgx 与 migration。",
    startDay: 7,
    endDay: 12,
  },
  {
    id: "stage-3",
    title: "数据边界与契约",
    description: "掌握 sqlc、repository、事务、真实 DB 验证与 proto 生成。",
    startDay: 13,
    endDay: 18,
  },
  {
    id: "stage-4",
    title: "gRPC 服务链路",
    description: "完成 unary、client、streaming、context 与 metadata 链路。",
    startDay: 19,
    endDay: 22,
  },
  {
    id: "stage-5",
    title: "并发与可运行性",
    description: "用 goroutine、errgroup、channel、race、观测和关闭机制收敛系统。",
    startDay: 23,
    endDay: 28,
  },
  {
    id: "stage-6",
    title: "Agent 切片与复盘",
    description: "阅读开源模式，构造最小 Agent 切片并完成集成、加固和复盘。",
    startDay: 29,
    endDay: 36,
  },
] as const

const CANONICAL_STAGE_IDS = [
  "language-foundations",
  "http-and-data-entry",
  "data-boundaries-and-contracts",
  "grpc-service-chain",
  "concurrency-and-operability",
  "agent-slice-and-review",
] as const

const TRACK_DEFINITIONS = [
  {
    trackId: "language-and-web",
    title: "语言与 Web",
    description: "建立 Go 语言、HTTP 与数据入口基础。",
    stageIndexes: [0, 1],
  },
  {
    trackId: "data-and-service-contracts",
    title: "数据与服务契约",
    description: "贯通数据库、代码生成与 gRPC 服务契约。",
    stageIndexes: [2, 3],
  },
  {
    trackId: "runtime-and-agent",
    title: "运行时与 Agent",
    description: "掌握并发、可运行性与 Agent 集成切片。",
    stageIndexes: [4, 5],
  },
] as const

export const LEGACY_GO_ADAPTER_REMOVAL_GATE =
  "Ticket 16 完成 go-backend 规范迁移并切换全部消费者后删除"

interface PublicProgress {
  day: number
  status: CourseStatus
  referenceScore: number | null
}

interface ParsedLessonMarkdown {
  day: number
  title: string
  englishTitle: string | null
  objective: string
  goals: string[]
}

export interface PublicCourseBuildOptions {
  lessonsDirectory?: string
  progressFile?: string
  outputDirectory?: string
}

function removeCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "")
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
    if (
      line.trim() &&
      !/^\s+[-*+]\s+/.test(line) &&
      !/^\s*$/.test(line)
    ) {
      activeIndent = null
      nextNumber = 1
    }
    return line
  })
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
      if (excludedHeadingLevel !== null && level > excludedHeadingLevel) {
        continue
      }
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
  if (!/^#\s+Day\s+\d{1,2}[：:]/m.test(result)) {
    throw new Error(`${fileName}: 公开投影缺少 Day 标题`)
  }
  if (
    FORBIDDEN_PUBLIC_SENTENCE.test(result) ||
    REPOSITORY_GOVERNANCE_REFERENCE.test(result)
  ) {
    throw new Error(`${fileName}: 公开投影仍包含禁止的治理材料或仓库路径`)
  }
  return result
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

function extractSection(markdown: string, title: string): string[] {
  const lines = removeCodeFences(markdown).split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(/^#{2,3}\s+(.+?)\s*$/)
    return match ? stripInlineMarkdown(match[1]) === title : false
  })
  if (headingIndex < 0) return []

  const section: string[] = []
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^#{1,3}\s+/.test(lines[index])) break
    section.push(lines[index])
  }
  return section
}

function extractBulletItems(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*[-*+]\s+(.+?)\s*$/)?.[1] ?? null)
    .filter((line): line is string => Boolean(line))
    .map(stripInlineMarkdown)
    .filter(Boolean)
}

function extractFirstParagraph(lines: string[]): string | null {
  return (
    lines
      .join("\n")
      .split(/\n\s*\n/)
      .map((paragraph) =>
        paragraph
          .split(/\r?\n/)
          .filter((line) => !/^\s*[-*+]\s+/.test(line))
          .join(" ")
      )
      .map(stripInlineMarkdown)
      .find(
        (paragraph) =>
          paragraph.length > 0 &&
          !paragraph.endsWith("：") &&
          !paragraph.endsWith(":")
      ) ?? null
  )
}

function extractIntroObjective(markdown: string): string | null {
  return (
    removeCodeFences(markdown)
      .split(/^#{2,3}\s+/m)[0]
      .split(/\n\s*\n/)
      .map(stripInlineMarkdown)
      .find(
        (paragraph) =>
          /(?:今天|本日).{0,18}(?:目标|重点)|目标是/.test(paragraph) &&
          !paragraph.startsWith("#")
      ) ?? null
  )
}

export function parseLessonMarkdown(
  markdown: string,
  fileName = "lesson.md"
): ParsedLessonMarkdown {
  const titleMatch = markdown.match(/^#\s+Day\s+(\d{1,2})[：:]\s*(.+?)\s*$/m)
  if (!titleMatch) {
    throw new Error(`${fileName}: 缺少合法的 Day 一级标题`)
  }
  const goalSection = extractSection(markdown, "学习目标")
  const bulletGoals = extractBulletItems(goalSection)
  const objective =
    extractFirstParagraph(goalSection) ??
    extractIntroObjective(markdown) ??
    bulletGoals[0] ??
    "完成当日课程与验证。"
  const englishTitleMatch = markdown.match(
    /^English title:\s*\*\*(.+?)\*\*\s*$/m
  )
  return {
    day: Number(titleMatch[1]),
    title: stripInlineMarkdown(titleMatch[2]),
    englishTitle: englishTitleMatch
      ? stripInlineMarkdown(englishTitleMatch[1])
      : null,
    objective,
    goals: bulletGoals.length > 0 ? bulletGoals : [objective],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parsePublicProgress(value: unknown): PublicProgress[] {
  if (!Array.isArray(value) || value.length !== 37) {
    throw new Error("progress.public.json 必须包含 Day 0-36 共 37 条记录")
  }
  const records = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`progress[${index}] 必须是对象`)
    }
    const actualKeys = Object.keys(entry).sort()
    const expectedKeys = [...PROGRESS_KEYS].sort()
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, keyIndex) => key !== expectedKeys[keyIndex])
    ) {
      throw new Error(`progress[${index}] 包含缺失或非白名单字段`)
    }
    if (
      typeof entry.day !== "number" ||
      !Number.isInteger(entry.day) ||
      entry.day < 0 ||
      entry.day > 36
    ) {
      throw new Error(`progress[${index}].day 必须位于 Day 0-36`)
    }
    if (!COURSE_STATUSES.includes(entry.status as CourseStatus)) {
      throw new Error(`progress[${index}].status 不在允许范围`)
    }
    if (
      entry.referenceScore !== null &&
      (typeof entry.referenceScore !== "number" ||
        !Number.isFinite(entry.referenceScore) ||
        entry.referenceScore < 0 ||
        entry.referenceScore > 100)
    ) {
      throw new Error(`progress[${index}].referenceScore 必须是 null 或 0-100`)
    }
    return entry as unknown as PublicProgress
  })
  records.sort((left, right) => left.day - right.day)
  records.forEach((record, index) => {
    if (record.day !== index) {
      throw new Error("progress.public.json 必须连续覆盖 Day 0-36 且不得重复")
    }
  })
  return records
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

function stageForDay(day: number): (typeof STAGE_DEFINITIONS)[number] {
  const stage = STAGE_DEFINITIONS.find(
    (candidate) => day >= candidate.startDay && day <= candidate.endDay
  )
  if (!stage) throw new Error(`Day ${day} 未分配到任何阶段`)
  return stage
}

function lessonHref(fileName: string, day: number): string {
  const match = fileName.match(LESSON_FILE_PATTERN)
  if (!match || Number(match[1]) !== day) {
    throw new Error(`${fileName}: 文件名与 Day 不一致或包含危险字符`)
  }
  return `/sources/lessons/${fileName}`
}

function canonicalLessonId(fileName: string): string {
  const match = fileName.match(/^day-\d{2}-(.+)\.md$/)
  if (!match) throw new Error(`${fileName}: 无法取得稳定 Lesson ID`)
  return match[1]
}

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`
}

export async function buildPublicArtifacts(
  options: PublicCourseBuildOptions = {}
): Promise<CourseData> {
  const lessonsDirectory = options.lessonsDirectory ?? LESSONS_DIRECTORY
  const progressFile = options.progressFile ?? PROGRESS_FILE
  const outputDirectory = options.outputDirectory ?? GENERATED_PUBLIC_DIRECTORY

  const entries = await readdir(lessonsDirectory, { withFileTypes: true })
  const lessonEntries = entries
    .filter((entry) => entry.name.startsWith("day-") && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name))
  if (lessonEntries.some((entry) => entry.isSymbolicLink())) {
    throw new Error("课程目录包含不允许的符号链接")
  }
  if (lessonEntries.some((entry) => !entry.isFile() || !LESSON_FILE_PATTERN.test(entry.name))) {
    throw new Error("课程目录包含不符合白名单命名的 Day Markdown")
  }

  const parsedLessons = await Promise.all(
    lessonEntries.map(async (entry) => {
      const sourceMarkdown = await readSafeRegularFile(
        lessonsDirectory,
        path.join(lessonsDirectory, entry.name)
      )
      const markdown = projectPublicLessonMarkdown(sourceMarkdown, entry.name)
      return {
        ...parseLessonMarkdown(markdown, entry.name),
        fileName: entry.name,
        markdown,
      }
    })
  )
  parsedLessons.sort((left, right) => left.day - right.day)
  if (
    parsedLessons.length !== 37 ||
    parsedLessons.some((lesson, index) => lesson.day !== index)
  ) {
    throw new Error("课程文件必须连续覆盖 Day 0-36，且不得缺失或重复")
  }

  const progressSource = await readSafeRegularFile(
    path.dirname(progressFile),
    progressFile
  )
  let progressJson: unknown
  try {
    progressJson = JSON.parse(progressSource)
  } catch {
    throw new Error("progress.public.json 不是合法 JSON")
  }
  const progress = parsePublicProgress(progressJson)

  const lessons: CourseLesson[] = parsedLessons.map((lesson) => {
    const stage = stageForDay(lesson.day)
    const progressRecord = progress[lesson.day]
    return {
      id: `day-${String(lesson.day).padStart(2, "0")}`,
      day: lesson.day,
      dayLabel: `Day ${lesson.day}`,
      title: lesson.title,
      englishTitle: lesson.englishTitle,
      objective: lesson.objective,
      goals: lesson.goals,
      stageId: stage.id,
      status: progressRecord.status,
      referenceScore: progressRecord.referenceScore,
      lessonHref: lessonHref(lesson.fileName, lesson.day),
    }
  })
  const stages: CourseStage[] = STAGE_DEFINITIONS.map((stage, index) => ({
    ...stage,
    order: index + 1,
    lessonDays: lessons
      .filter((lesson) => lesson.stageId === stage.id)
      .map((lesson) => lesson.day),
  }))
  const data = parseCourseData({
    schemaVersion: 3,
    title: "Go 36 天学习路线图",
    dayRange: { start: 0, end: 36 },
    stages,
    lessons,
  })

  const lessonByDay = new Map(
    parsedLessons.map((lesson) => [lesson.day, lesson])
  )
  const sourceCourse: SourceCourse = {
    schemaVersion: 1,
    courseId: "go-backend",
    title: "Go 36 天学习路线图",
    description: "从 Go 语言基础到后端服务与 Agent 工程实践。",
    language: { id: "go", label: "Go" },
    lifecycle: "published",
    replacementCourseId: null,
    evaluationPolicyPath: "evaluation/policy.md",
    commandProfilePath: "evaluation/command-profile.json",
    publicResources: [],
    internalResources: [],
    tracks: TRACK_DEFINITIONS.map((track) => ({
      trackId: track.trackId,
      title: track.title,
      description: track.description,
      stages: track.stageIndexes.map((stageIndex) => {
        const stage = STAGE_DEFINITIONS[stageIndex]
        return {
          stageId: CANONICAL_STAGE_IDS[stageIndex],
          title: stage.title,
          description: stage.description,
          lessons: Array.from(
            { length: stage.endDay - stage.startDay + 1 },
            (_, offset) => {
              const day = stage.startDay + offset
              const lesson = lessonByDay.get(day)!
              const lessonId = canonicalLessonId(lesson.fileName)
              return {
                lessonId,
                lifecycle: "active" as const,
                day,
                title: lesson.title,
                objective: lesson.objective,
                goals: lesson.goals,
                contentPath: `lessons/${lessonId}.md`,
                exerciseTemplatePath: null,
                evaluation: {
                  competencies: [
                    {
                      competencyId: `complete-${lessonId}`,
                      title: `完成 ${lesson.title}`,
                    },
                  ],
                  requiredEvidence: ["notes", "exercise"],
                  scoringBasis: ["准确", "可验证"],
                },
              }
            }
          ),
        }
      }),
    })),
  }
  const authoringFiles: AuthoringFiles = {
    "evaluation/policy.md": "Legacy Go adapter policy v1\n",
    "evaluation/command-profile.json":
      '{"commands":[["go","test","./..."],["go","test","-race","./..."],["go","vet","./..."],["go","test","./...","-run","TestName"]]}\n',
    ...Object.fromEntries(
      parsedLessons.map((lesson) => [
        `lessons/${canonicalLessonId(lesson.fileName)}.md`,
        lesson.markdown,
      ])
    ),
  }
  const sourceCatalog: SourceCatalog = {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: [
      {
        courseId: sourceCourse.courseId,
        title: sourceCourse.title,
        language: sourceCourse.language,
        lifecycle: sourceCourse.lifecycle,
        replacementCourseId: sourceCourse.replacementCourseId,
        manifestPath: "courses/go-backend/course.json",
      },
    ],
  }
  const compiled = compileCourseContract(sourceCourse, authoringFiles)
  const snapshot = parseReleaseProgressSnapshot({
    schemaVersion: 1,
    courseId: sourceCourse.courseId,
    courseRevision: compiled.courseRevision,
    privateInputDigest: sha256({ adapter: "legacy-go-v1", progress }),
    lessons: compiled.lessons.map((lesson) => {
      const record = progress[lesson.day!]
      return {
        lessonId: lesson.lessonId,
        status: record.status,
        referenceScore: record.referenceScore,
      }
    }),
  })

  await buildMultiCoursePublicArtifacts({
    sourceCatalog,
    courses: [{ sourceCourse, authoringFiles, snapshot }],
    outputDirectory,
    legacy: {
      courseId: "go-backend",
      courseData: data,
      lessons: parsedLessons.map((lesson) => ({
        lessonId: canonicalLessonId(lesson.fileName),
        legacyHref: lessonHref(lesson.fileName, lesson.day),
      })),
    },
  })
  return data
}
