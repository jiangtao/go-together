import path from "node:path"

import { watch } from "chokidar"

import {
  EXERCISE_DIRECTORY,
  LESSONS_DIRECTORY,
  REPOSITORY_ROOT,
  ROADMAP_DIRECTORY,
  syncCourseData,
} from "./lib/course-data.ts"

const WATCHED_BRANCHES = [LESSONS_DIRECTORY, EXERCISE_DIRECTORY]
const LESSON_PATH_PATTERN =
  /^docs\/go-learning\/daily-lessons\/day-\d{2}-.+\.md$/
const EXERCISE_RESOURCE_PATH_PATTERN =
  /^exercise\/day(?:-?\d+)\/(?:notes|notes-eval|README)\.md$/
let debounceTimer: NodeJS.Timeout | undefined
let syncing = false
let queued = false

function normalizeRepositoryPath(absolutePath: string): string {
  return path.relative(REPOSITORY_ROOT, absolutePath).split(path.sep).join("/")
}

function isWatchedFile(absolutePath: string): boolean {
  const repositoryPath = normalizeRepositoryPath(absolutePath)
  return (
    LESSON_PATH_PATTERN.test(repositoryPath) ||
    EXERCISE_RESOURCE_PATH_PATTERN.test(repositoryPath)
  )
}

function shouldIgnore(candidatePath: string): boolean {
  const absolutePath = path.resolve(candidatePath)
  if (absolutePath === REPOSITORY_ROOT) {
    return false
  }

  return !WATCHED_BRANCHES.some(
    (branch) =>
      absolutePath === branch ||
      absolutePath.startsWith(`${branch}${path.sep}`) ||
      branch.startsWith(`${absolutePath}${path.sep}`)
  )
}

async function runSync(triggerPath: string): Promise<void> {
  if (syncing) {
    queued = true
    return
  }

  syncing = true
  try {
    const result = await syncCourseData()
    const generatedPath = path.relative(ROADMAP_DIRECTORY, result.file)
    const trigger = normalizeRepositoryPath(triggerPath)
    console.log(
      result.changed
        ? `[同步] ${trigger} → ${generatedPath}`
        : `[检查] ${trigger}（生成数据无变化）`
    )
  } catch (error) {
    console.error("[同步失败]", error)
  } finally {
    syncing = false
    if (queued) {
      queued = false
      await runSync(triggerPath)
    }
  }
}

function scheduleSync(triggerPath: string): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    void runSync(triggerPath)
  }, 100)
}

const watcher = watch(REPOSITORY_ROOT, {
  ignored: shouldIgnore,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 80,
    pollInterval: 20,
  },
})

watcher.on("all", (eventName, changedPath) => {
  if (
    (eventName === "add" || eventName === "change" || eventName === "unlink") &&
    isWatchedFile(changedPath)
  ) {
    scheduleSync(changedPath)
  }
})

watcher.on("ready", () => {
  console.log(
    "监听中：每日课程 Markdown 与 exercise/day*/{notes,notes-eval,README}.md"
  )
})

async function closeWatcher(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  await watcher.close()
}

process.once("SIGINT", () => {
  void closeWatcher()
})
process.once("SIGTERM", () => {
  void closeWatcher()
})
