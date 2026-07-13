import { lstat, readFile, readdir } from "node:fs/promises"
import path from "node:path"

import {
  parseReleaseProgressSnapshot,
  type SourceCatalog,
} from "./course-contract.ts"

export interface CanonicalInputTree {
  releaseSnapshots: Array<{ courseId: string; file: string }>
}

async function assertExactDirectory(
  directory: string,
  expected: Map<string, "file" | "directory">,
  context: string
): Promise<void> {
  const root = await lstat(directory)
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error(`${context}必须是非 symlink 目录`)
  }
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`${context}拒绝 symlink：${entry.name}`)
    }
  }
  const actualNames = entries.map((entry) => entry.name).sort()
  const expectedNames = [...expected.keys()].sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `${context}集合必须与 Catalog 精确一致：expected ${expectedNames.join(", ")}; got ${actualNames.join(", ")}`
    )
  }
  for (const entry of entries) {
    const expectedType = expected.get(entry.name)
    const matches =
      expectedType === "file" ? entry.isFile() : entry.isDirectory()
    if (!matches) {
      throw new Error(`${context}条目类型错误：${entry.name}`)
    }
  }
}

export async function assertCanonicalInputTree(
  repositoryRoot: string,
  catalog: SourceCatalog
): Promise<CanonicalInputTree> {
  const courseEntries = new Map<string, "file" | "directory">([
    ["catalog.json", "file"],
  ])
  for (const course of catalog.courses) {
    if (course.manifestPath !== `courses/${course.courseId}/course.json`) {
      throw new Error(
        `Catalog manifestPath 必须匹配规范 Course 目录：${course.courseId}`
      )
    }
    courseEntries.set(course.courseId, "directory")
  }
  await assertExactDirectory(
    path.join(repositoryRoot, "courses"),
    courseEntries,
    "Course 根"
  )

  const publicCourses = catalog.courses.filter(
    (course) => course.lifecycle !== "draft"
  )
  const snapshotEntries = new Map<string, "file">(
    publicCourses.map((course) => [`${course.courseId}.json`, "file"])
  )
  const releaseDirectory = path.join(repositoryRoot, "release-progress")
  await assertExactDirectory(
    releaseDirectory,
    snapshotEntries,
    "Snapshot 根"
  )

  const releaseSnapshots = []
  for (const course of publicCourses) {
    const file = path.join(releaseDirectory, `${course.courseId}.json`)
    let value: unknown
    try {
      value = JSON.parse(await readFile(file, "utf8"))
    } catch {
      throw new Error(`Snapshot ${course.courseId} 不是合法 JSON`)
    }
    const snapshot = parseReleaseProgressSnapshot(value)
    if (snapshot.courseId !== course.courseId) {
      throw new Error(`Snapshot 文件名与 courseId 不一致：${course.courseId}`)
    }
    releaseSnapshots.push({ courseId: course.courseId, file })
  }
  return { releaseSnapshots }
}
