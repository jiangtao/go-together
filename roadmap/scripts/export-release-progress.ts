import { randomUUID } from "node:crypto"
import {
  lstat,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  compileCourseContract,
  exportReleaseProgressSnapshot,
  listAuthoringPaths,
  parseEvaluationRecord,
  parseSourceCourse,
  type AuthoringFiles,
  type EvaluationRecord,
  type ReleaseProgressSnapshot,
  type SourceCourse,
} from "./lib/course-contract.ts"
import { COURSE_STATUSES } from "../src/types/course.ts"

interface ExportOptions {
  courseFile: string
  learningRecordsDirectory: string
  outputFile: string
}

interface ExportSummary {
  command: "export-progress"
  courseId: string
  lessonCount: number
  statusCounts: Record<string, number>
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

async function assertPhysicalDirectory(directory: string, context: string): Promise<void> {
  const resolved = path.resolve(directory)
  const metadata = await lstat(resolved)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${context} 必须是非 symlink 目录`)
  }
}

async function readRegularFile(file: string, context: string): Promise<string> {
  const metadata = await lstat(file)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${context} 必须是非 symlink 普通文件`)
  }
  return readFile(file, "utf8")
}

async function readCourseFile(
  courseDirectory: string,
  relative: string
): Promise<string> {
  let current = courseDirectory
  for (const [index, segment] of relative.split("/").entries()) {
    current = path.join(current, segment)
    const metadata = await lstat(current)
    if (metadata.isSymbolicLink()) {
      throw new Error(`authoring input 拒绝 symlink: ${relative}`)
    }
    const final = index === relative.split("/").length - 1
    if (final ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`authoring input 不是预期普通路径: ${relative}`)
    }
  }
  return readFile(current, "utf8")
}

async function loadAuthoringFiles(
  courseDirectory: string,
  course: SourceCourse
): Promise<AuthoringFiles> {
  const entries = await Promise.all(
    listAuthoringPaths(course).map(async (relative) => [
      relative,
      await readCourseFile(courseDirectory, relative),
    ] as const)
  )
  return Object.fromEntries(entries)
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

function allLessonIds(course: SourceCourse): string[] {
  return course.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((lesson) => lesson.lessonId)
    )
  )
}

async function loadEvaluations(
  recordsDirectory: string,
  course: SourceCourse
): Promise<EvaluationRecord[]> {
  await assertPhysicalDirectory(recordsDirectory, "Learning Record Course 目录")
  if (path.basename(recordsDirectory) !== course.courseId) {
    throw new Error("Learning Record Course 目录必须与 courseId 一致")
  }
  const lessonIds = allLessonIds(course)
  const known = new Set(lessonIds)
  const lessonsDirectory = path.join(recordsDirectory, "lessons")
  if (!(await pathExists(lessonsDirectory))) return []
  const lessonsMetadata = await lstat(lessonsDirectory)
  if (lessonsMetadata.isSymbolicLink() || !lessonsMetadata.isDirectory()) {
    throw new Error("Learning Record lessons 必须是非 symlink 目录")
  }
  const entries = await readdir(lessonsDirectory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(`Learning Record Lesson 不是普通目录: ${entry.name}`)
    }
    if (!known.has(entry.name)) {
      throw new Error(`Learning Record 引用了未知 Lesson: ${entry.name}`)
    }
  }

  const evaluations: EvaluationRecord[] = []
  for (const lessonId of lessonIds) {
    const lessonDirectory = path.join(lessonsDirectory, lessonId)
    if (!(await pathExists(lessonDirectory))) continue
    const metadata = await lstat(lessonDirectory)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Learning Record Lesson 拒绝 symlink: ${lessonId}`)
    }
    const evaluationFile = path.join(lessonDirectory, "evaluation.json")
    if (!(await pathExists(evaluationFile))) continue
    const source = await readRegularFile(
      evaluationFile,
      `Evaluation ${lessonId}`
    )
    let value: unknown
    try {
      value = JSON.parse(source)
    } catch {
      throw new Error(`Evaluation ${lessonId} 不是有效 JSON`)
    }
    const evaluation = parseEvaluationRecord(value)
    if (
      evaluation.courseId !== course.courseId ||
      evaluation.lessonId !== lessonId
    ) {
      throw new Error(`Evaluation ${lessonId} 稳定 identity 不一致`)
    }
    evaluations.push(evaluation)
  }
  return evaluations
}

async function writeSnapshotAtomically(
  outputFile: string,
  snapshot: ReleaseProgressSnapshot
): Promise<void> {
  const resolved = path.resolve(outputFile)
  const parent = path.dirname(resolved)
  await assertPhysicalDirectory(parent, "Snapshot 输出目录")
  if (await pathExists(resolved)) {
    const metadata = await lstat(resolved)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("Snapshot 输出目标必须是普通文件或不存在")
    }
  }
  const temporary = path.join(parent, `.${path.basename(resolved)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
      flag: "wx",
    })
    await rename(temporary, resolved)
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function exportReleaseSnapshotFromWorkspace(
  options: ExportOptions
): Promise<ReleaseProgressSnapshot> {
  const courseFile = path.resolve(options.courseFile)
  const courseDirectory = path.dirname(courseFile)
  const recordsDirectory = path.resolve(options.learningRecordsDirectory)
  const outputFile = path.resolve(options.outputFile)
  await assertPhysicalDirectory(courseDirectory, "Course 目录")
  const source = await readRegularFile(courseFile, "Source Course manifest")
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error("Source Course manifest 不是有效 JSON")
  }
  const course = parseSourceCourse(value)
  if (path.basename(courseFile) !== "course.json") {
    throw new Error("Source Course manifest 文件名必须为 course.json")
  }
  if (path.basename(courseDirectory) !== course.courseId) {
    throw new Error("Source Course 目录必须与 courseId 一致")
  }
  const coursesDirectory = path.dirname(courseDirectory)
  if (path.basename(coursesDirectory) !== "courses") {
    throw new Error("Source Course 必须位于 <repository>/courses/<courseId>")
  }
  const repositoryDirectory = path.dirname(coursesDirectory)
  const canonicalOutput = path.join(
    repositoryDirectory,
    "release-progress",
    `${course.courseId}.json`
  )
  if (outputFile !== canonicalOutput) {
    throw new Error(
      `Release Snapshot 输出必须为 release-progress/${course.courseId}.json`
    )
  }
  const authoringInputPaths = [
    courseFile,
    ...listAuthoringPaths(course).map((relative) =>
      path.join(courseDirectory, ...relative.split("/"))
    ),
  ]
  const foldedAuthoringInputs = new Set(
    authoringInputPaths.map((input) =>
      path.resolve(input).toLocaleLowerCase("en-US")
    )
  )
  if (foldedAuthoringInputs.has(outputFile.toLocaleLowerCase("en-US"))) {
    throw new Error("Release Snapshot 不得覆盖 authoring input")
  }
  await assertPhysicalDirectory(recordsDirectory, "Learning Record Course 目录")
  const outputParent = path.dirname(outputFile)
  await assertPhysicalDirectory(outputParent, "Snapshot 输出目录")
  const physicalRecordsDirectory = await realpath(recordsDirectory)
  const physicalOutputFile = path.join(
    await realpath(outputParent),
    path.basename(outputFile)
  )
  const physicalAuthoringInputs = new Set(
    (
      await Promise.all(authoringInputPaths.map((input) => realpath(input)))
    ).map((input) => input.toLocaleLowerCase("en-US"))
  )
  if (
    isInside(recordsDirectory, outputFile) ||
    isInside(physicalRecordsDirectory, physicalOutputFile) ||
    physicalAuthoringInputs.has(
      physicalOutputFile.toLocaleLowerCase("en-US")
    )
  ) {
    throw new Error(
      "Release Snapshot 不得写入 Learning Record 或覆盖 authoring input"
    )
  }
  const files = await loadAuthoringFiles(courseDirectory, course)
  const compiled = compileCourseContract(course, files)
  const evaluations = await loadEvaluations(recordsDirectory, course)
  const snapshot = exportReleaseProgressSnapshot(
    compiled,
    evaluations,
    files
  )
  await writeSnapshotAtomically(outputFile, snapshot)
  return snapshot
}

function parseArguments(argv: string[]): ExportOptions {
  const allowed = new Set(["course", "learning-records", "output"])
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(
        "Usage: export-release-progress --course <course.json> --learning-records <course-record-dir> --output <snapshot.json>"
      )
    }
    const name = flag.slice(2)
    if (!allowed.has(name) || values.has(name)) {
      throw new Error(`未知或重复参数: --${name}`)
    }
    values.set(name, value)
  }
  for (const name of allowed) {
    if (!values.has(name)) throw new Error(`缺少参数: --${name}`)
  }
  return {
    courseFile: values.get("course")!,
    learningRecordsDirectory: values.get("learning-records")!,
    outputFile: values.get("output")!,
  }
}

export async function runProgressExporter(
  argv: string[]
): Promise<ExportSummary> {
  const snapshot = await exportReleaseSnapshotFromWorkspace(
    parseArguments(argv)
  )
  return {
    command: "export-progress",
    courseId: snapshot.courseId,
    lessonCount: snapshot.lessons.length,
    statusCounts: Object.fromEntries(
      [...COURSE_STATUSES].map((status) => [
        status,
        snapshot.lessons.filter((lesson) => lesson.status === status).length,
      ])
    ),
  }
}

async function main(): Promise<void> {
  const result = await runProgressExporter(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
}
