import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { assertCanonicalInputTree } from "./canonical-input-tree.ts"
import type { SourceCatalog } from "./course-contract.ts"

const temporaryDirectories: string[] = []

const catalog: SourceCatalog = {
  schemaVersion: 1,
  defaultCourseId: "go-backend",
  courses: [
    {
      courseId: "go-backend",
      title: "Go",
      language: { id: "go", label: "Go" },
      lifecycle: "published",
      replacementCourseId: null,
      manifestPath: "courses/go-backend/course.json",
    },
  ],
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "canonical-input-tree-"))
  temporaryDirectories.push(root)
  await mkdir(path.join(root, "courses/go-backend"), { recursive: true })
  await mkdir(path.join(root, "release-progress"))
  await writeFile(path.join(root, "courses/catalog.json"), "{}\n")
  await writeFile(path.join(root, "courses/go-backend/course.json"), "{}\n")
  await writeFile(
    path.join(root, "release-progress/go-backend.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      courseId: "go-backend",
      courseRevision: `sha256:${"1".repeat(64)}`,
      privateInputDigest: `sha256:${"2".repeat(64)}`,
      lessons: [
        {
          lessonId: "intro",
          status: "未开始",
          referenceScore: null,
        },
      ],
    })}\n`
  )
  return root
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("canonical authoring input tree", () => {
  it("accepts an exact Catalog/Course/Snapshot membership", async () => {
    const root = await fixture()
    await expect(assertCanonicalInputTree(root, catalog)).resolves.toEqual({
      releaseSnapshots: [
        {
          courseId: "go-backend",
          file: path.join(root, "release-progress/go-backend.json"),
        },
      ],
    })
  })

  it("rejects an unregistered Course directory", async () => {
    const root = await fixture()
    await mkdir(path.join(root, "courses/python-backend"))
    await expect(assertCanonicalInputTree(root, catalog)).rejects.toThrow(
      "Course 根集合"
    )
  })

  it("rejects extra and nested Snapshot entries", async () => {
    const root = await fixture()
    await mkdir(path.join(root, "release-progress/nested"))
    await expect(assertCanonicalInputTree(root, catalog)).rejects.toThrow(
      "Snapshot 根集合"
    )
  })

  it("rejects invalid Snapshot JSON", async () => {
    const root = await fixture()
    await writeFile(path.join(root, "release-progress/go-backend.json"), "nope\n")
    await expect(assertCanonicalInputTree(root, catalog)).rejects.toThrow(
      "不是合法 JSON"
    )
  })

  it("rejects a symlink Snapshot entry", async () => {
    const root = await fixture()
    const snapshot = path.join(root, "release-progress/go-backend.json")
    const outside = path.join(root, "outside.json")
    await writeFile(outside, await readFile(snapshot))
    await rm(snapshot)
    await symlink(outside, snapshot)
    await expect(assertCanonicalInputTree(root, catalog)).rejects.toThrow(
      "symlink"
    )
  })
})
