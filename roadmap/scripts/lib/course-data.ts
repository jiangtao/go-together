import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type {
  CourseData,
  CourseLesson,
  CourseStage,
  CourseStatus,
} from "../../src/types/course.ts"

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
export const ROADMAP_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "../..")
export const REPOSITORY_ROOT = path.resolve(ROADMAP_DIRECTORY, "..")
export const LESSONS_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "docs/go-learning/daily-lessons"
)
export const EXERCISE_DIRECTORY = path.join(REPOSITORY_ROOT, "exercise")
export const GENERATED_DATA_FILE = path.join(
  ROADMAP_DIRECTORY,
  "src/data/course.json"
)
export const GENERATED_SOURCES_DIRECTORY = path.join(
  ROADMAP_DIRECTORY,
  "public/sources"
)

const LESSON_FILE_PATTERN = /^day-(\d{2})-.+\.md$/
const STATUS_PATTERN = /(未开始|定向回炉|重新学习|通过)/

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

export interface ParsedLessonMarkdown {
  day: number
  title: string
  englishTitle: string | null
  objective: string
  goals: string[]
}

export interface ParsedEvaluation {
  status: CourseStatus
  referenceScore: number | null
}

function removeCodeFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "")
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

  if (headingIndex < 0) {
    return []
  }

  const section: string[] = []
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^#{1,3}\s+/.test(lines[index])) {
      break
    }
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
  const paragraphs = lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split(/\r?\n/)
        .filter((line) => !/^\s*[-*+]\s+/.test(line))
        .join(" ")
    )
    .map(stripInlineMarkdown)
    .filter(
      (paragraph) =>
        paragraph.length > 0 &&
        !paragraph.endsWith("：") &&
        !paragraph.endsWith(":")
    )

  return paragraphs[0] ?? null
}

function extractIntroObjective(markdown: string): string | null {
  const intro = removeCodeFences(markdown).split(/^#{2,3}\s+/m)[0]
  const paragraphs = intro
    .split(/\n\s*\n/)
    .map(stripInlineMarkdown)
    .filter(Boolean)

  return (
    paragraphs.find(
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
  const sectionObjective = extractFirstParagraph(goalSection)
  const introObjective = extractIntroObjective(markdown)
  const objective =
    sectionObjective ?? introObjective ?? bulletGoals[0] ?? "完成当日课程与验证。"
  const goals = bulletGoals.length > 0 ? bulletGoals : [objective]
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
    goals,
  }
}

export function normalizeStatus(value: string | null | undefined): CourseStatus {
  if (!value) {
    return "未开始"
  }
  const match = stripInlineMarkdown(value).match(STATUS_PATTERN)
  return (match?.[1] as CourseStatus | undefined) ?? "未开始"
}

export function parseEvaluationMarkdown(markdown: string): ParsedEvaluation {
  const content = removeCodeFences(markdown)
  const lines = content.split(/\r?\n/)
  const plainContent = lines.map(stripInlineMarkdown).join("\n")
  const labelledStatuses: CourseStatus[] = []
  const standaloneStatuses: CourseStatus[] = []

  for (const line of lines) {
    const plainLine = stripInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ""))
    const labelledMatch = plainLine.match(
      /(?:学习状态|评测状态|评估状态|状态|评测结论|评估结论|结论|结果)\s*[:：]\s*(未开始|定向回炉|重新学习|通过)/
    )
    if (labelledMatch) {
      labelledStatuses.push(labelledMatch[1] as CourseStatus)
      continue
    }

    const standaloneMatch = plainLine.match(/^(未开始|定向回炉|重新学习|通过)$/)
    if (standaloneMatch) {
      standaloneStatuses.push(standaloneMatch[1] as CourseStatus)
    }
  }

  const scoreMatches = [
    ...plainContent.matchAll(
      /(?:参考分数|参考评分)\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:\/\s*100|分)?/g
    ),
  ]
  const parsedScore = scoreMatches.at(-1)?.[1]
  const numericScore = parsedScore === undefined ? null : Number(parsedScore)
  const referenceScore =
    numericScore !== null &&
    Number.isFinite(numericScore) &&
    numericScore >= 0 &&
    numericScore <= 100
      ? numericScore
      : null

  return {
    status:
      labelledStatuses.at(-1) ?? standaloneStatuses.at(-1) ?? "未开始",
    referenceScore,
  }
}

function toRepositoryPath(absolutePath: string): string {
  const relativePath = path.relative(REPOSITORY_ROOT, absolutePath)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`拒绝读取仓库外路径：${absolutePath}`)
  }
  return relativePath.split(path.sep).join("/")
}

export function sourceHrefForRepositoryPath(repositoryPath: string): string {
  const normalizedPath = path.posix.normalize(
    repositoryPath.replaceAll("\\", "/")
  )
  if (
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    path.posix.isAbsolute(normalizedPath)
  ) {
    throw new Error(`拒绝为仓库外路径生成资源地址：${repositoryPath}`)
  }

  return `/sources/${normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`
}

export function exerciseResourceCandidates(
  day: number,
  fileNames: string[]
): string[] {
  const paddedDay = String(day).padStart(2, "0")
  const directories = [
    `day${day}`,
    `day${paddedDay}`,
    `day-${paddedDay}`,
    `day-${day}`,
  ]

  return [...new Set(directories)].flatMap((directory) =>
    fileNames.map((fileName) =>
      path.posix.join("exercise", directory, fileName)
    )
  )
}

function evaluationCandidates(day: number): string[] {
  return exerciseResourceCandidates(day, ["notes-eval.md"]).map(
    (repositoryPath) => path.join(REPOSITORY_ROOT, repositoryPath)
  )
}

function notesCandidates(day: number): string[] {
  return exerciseResourceCandidates(day, ["notes.md", "README.md"]).map(
    (repositoryPath) => path.join(REPOSITORY_ROOT, repositoryPath)
  )
}

async function findOptionalSource(candidates: string[]): Promise<{
  path: string
  exists: boolean
}> {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return { path: candidate, exists: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }

  return { path: candidates[0], exists: false }
}

async function readEvaluation(day: number): Promise<{
  evaluation: ParsedEvaluation
  path: string
  exists: boolean
}> {
  const candidates = evaluationCandidates(day)
  const source = await findOptionalSource(candidates)
  if (source.exists) {
    const markdown = await readFile(source.path, "utf8")
    return {
      evaluation: parseEvaluationMarkdown(markdown),
      path: source.path,
      exists: true,
    }
  }

  return {
    evaluation: { status: "未开始", referenceScore: null },
    path: source.path,
    exists: false,
  }
}

function stageForDay(day: number): (typeof STAGE_DEFINITIONS)[number] {
  const stage = STAGE_DEFINITIONS.find(
    (candidate) => day >= candidate.startDay && day <= candidate.endDay
  )
  if (!stage) {
    throw new Error(`Day ${day} 未分配到任何阶段`)
  }
  return stage
}

function validateLessonDays(days: number[]): void {
  const expectedDays = Array.from({ length: 37 }, (_, index) => index)
  const actual = [...days].sort((left, right) => left - right)
  if (
    actual.length !== expectedDays.length ||
    actual.some((day, index) => day !== expectedDays[index])
  ) {
    throw new Error(
      `课程文件必须且只能覆盖 Day 0-36；实际为：${actual.join(", ")}`
    )
  }
}

export async function buildCourseData(): Promise<CourseData> {
  const entries = await readdir(LESSONS_DIRECTORY, { withFileTypes: true })
  const lessonFiles = entries
    .filter((entry) => entry.isFile() && LESSON_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  const parsedLessons = await Promise.all(
    lessonFiles.map(async (fileName) => {
      const absolutePath = path.join(LESSONS_DIRECTORY, fileName)
      const markdown = await readFile(absolutePath, "utf8")
      return {
        ...parseLessonMarkdown(markdown, fileName),
        absolutePath,
      }
    })
  )

  validateLessonDays(parsedLessons.map((lesson) => lesson.day))

  const lessons: CourseLesson[] = await Promise.all(
    parsedLessons
      .sort((left, right) => left.day - right.day)
      .map(async (lesson) => {
        const stage = stageForDay(lesson.day)
        const evaluationSource = await readEvaluation(lesson.day)
        const notesSource = await findOptionalSource(
          notesCandidates(lesson.day)
        )
        const exercisePath = path.dirname(evaluationSource.path)
        const lessonPath = toRepositoryPath(lesson.absolutePath)
        const notesPath = toRepositoryPath(notesSource.path)
        const evaluationPath = toRepositoryPath(evaluationSource.path)

        return {
          id: `day-${String(lesson.day).padStart(2, "0")}`,
          day: lesson.day,
          dayLabel: `Day ${lesson.day}`,
          title: lesson.title,
          englishTitle: lesson.englishTitle,
          objective: lesson.objective,
          goals: lesson.goals,
          stageId: stage.id,
          lessonPath,
          exercisePath: toRepositoryPath(exercisePath),
          evaluationPath,
          evaluationSourceExists: evaluationSource.exists,
          resources: [
            {
              kind: "lesson" as const,
              label: "课程 Markdown",
              path: lessonPath,
              href: sourceHrefForRepositoryPath(lessonPath),
              exists: true,
            },
            {
              kind: "notes" as const,
              label: "学习笔记",
              path: notesPath,
              href: sourceHrefForRepositoryPath(notesPath),
              exists: notesSource.exists,
            },
            {
              kind: "evaluation" as const,
              label: "评测文件",
              path: evaluationPath,
              href: sourceHrefForRepositoryPath(evaluationPath),
              exists: evaluationSource.exists,
            },
          ],
          status: evaluationSource.evaluation.status,
          referenceScore: evaluationSource.evaluation.referenceScore,
        }
      })
  )

  const stages: CourseStage[] = STAGE_DEFINITIONS.map((stage, index) => ({
    ...stage,
    order: index + 1,
    lessonDays: lessons
      .filter((lesson) => lesson.stageId === stage.id)
      .map((lesson) => lesson.day),
  }))

  return {
    schemaVersion: 2,
    title: "Go 36 天学习路线图",
    dayRange: { start: 0, end: 36 },
    stages,
    lessons,
  }
}

async function listGeneratedSourceFiles(
  directory = GENERATED_SOURCES_DIRECTORY
): Promise<string[]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory()
        ? listGeneratedSourceFiles(entryPath)
        : [entryPath]
    })
  )
  return files.flat()
}

async function syncSourceFiles(data: CourseData): Promise<boolean> {
  const sourcePaths = [
    ...new Set(
      data.lessons.flatMap((lesson) =>
        lesson.resources
          .filter((resource) => resource.exists)
          .map((resource) => resource.path)
      )
    ),
  ].sort()
  const expectedTargets = new Set<string>()
  let changed = false

  for (const repositoryPath of sourcePaths) {
    const absoluteSource = path.resolve(REPOSITORY_ROOT, repositoryPath)
    const verifiedRepositoryPath = toRepositoryPath(absoluteSource)
    const target = path.join(
      GENERATED_SOURCES_DIRECTORY,
      ...verifiedRepositoryPath.split("/")
    )
    expectedTargets.add(target)
    const sourceContent = await readFile(absoluteSource, "utf8")
    const servedContent = sourceContent.startsWith("\uFEFF")
      ? sourceContent
      : `\uFEFF${sourceContent}`
    let targetContent = ""
    try {
      targetContent = await readFile(target, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }

    if (servedContent !== targetContent) {
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, servedContent, "utf8")
      changed = true
    }
  }

  const generatedFiles = await listGeneratedSourceFiles()
  for (const generatedFile of generatedFiles) {
    if (!expectedTargets.has(generatedFile)) {
      await rm(generatedFile)
      changed = true
    }
  }

  return changed
}

export async function syncCourseData(): Promise<{
  changed: boolean
  dataChanged: boolean
  sourcesChanged: boolean
  file: string
}> {
  const data = await buildCourseData()
  const serialized = `${JSON.stringify(data, null, 2)}\n`
  let current = ""
  try {
    current = await readFile(GENERATED_DATA_FILE, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }

  const dataChanged = current !== serialized
  if (dataChanged) {
    await mkdir(path.dirname(GENERATED_DATA_FILE), { recursive: true })
    await writeFile(GENERATED_DATA_FILE, serialized, "utf8")
  }

  const sourcesChanged = await syncSourceFiles(data)
  return {
    changed: dataChanged || sourcesChanged,
    dataChanged,
    sourcesChanged,
    file: GENERATED_DATA_FILE,
  }
}
