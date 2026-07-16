import { createHash } from "node:crypto"
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  buildPublicArtifacts,
  projectPublicLessonMarkdown,
} from "./public-course.ts"
import { createPublicCourseFixture } from "./public-course.test-fixture.ts"

const temporaryDirectories: string[] = []

async function makeFixture(options: { dayZeroPassed?: boolean } = {}) {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "roadmap-public-course-")
  )
  temporaryDirectories.push(repositoryRoot)
  const fixture = await createPublicCourseFixture(repositoryRoot, options)
  return { repositoryRoot, ...fixture }
}

async function directorySnapshot(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const snapshots = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          return (await directorySnapshot(entryPath)).map(
            (line) => `${entry.name}/${line}`
          )
        }
        return [`${entry.name}\0${await readFile(entryPath, "utf8")}`]
      })
  )
  return snapshots.flat()
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("Catalog-driven 公开课程生成器", () => {
  it("从规范 Course 与 Snapshot 生成 canonical 和永久 Go alias", async () => {
    const fixture = await makeFixture({ dayZeroPassed: true })
    const course = await buildPublicArtifacts(fixture)

    expect(course.schemaVersion).toBe(3)
    expect(course.lessons).toHaveLength(37)
    expect(course.lessons[0]).toMatchObject({
      id: "day-00",
      day: 0,
      status: "通过",
      referenceScore: 92,
      lessonHref: "/sources/lessons/day-00-lesson-00.md",
    })
    const catalog = JSON.parse(
      await readFile(
        path.join(fixture.outputDirectory, "courses/catalog.json"),
        "utf8"
      )
    ) as { courses: Array<{ courseRevision: string }> }
    const canonical = JSON.parse(
      await readFile(
        path.join(
          fixture.outputDirectory,
          "courses/go-backend/course.json"
        ),
        "utf8"
      )
    ) as { courseRevision: string; tracks: unknown[] }
    expect(canonical.tracks).toHaveLength(3)
    expect(catalog.courses[0].courseRevision).toBe(canonical.courseRevision)
    const legacy = await readFile(
      path.join(
        fixture.outputDirectory,
        "sources/lessons/day-00-lesson-00.md"
      ),
      "utf8"
    )
    const normalized = await readFile(
      path.join(
        fixture.outputDirectory,
        "courses/go-backend/sources/lessons/lesson-00.md"
      ),
      "utf8"
    )
    expect(normalized).toBe(legacy)
  })

  it("连续两次生成得到逐字节一致的文件树", async () => {
    const fixture = await makeFixture()
    await buildPublicArtifacts(fixture)
    const first = await directorySnapshot(fixture.outputDirectory)
    await buildPublicArtifacts(fixture)
    expect(await directorySnapshot(fixture.outputDirectory)).toEqual(first)
  })

  it("拒绝 Catalog、Lesson 或兼容映射 symlink/漂移", async () => {
    const lessonFixture = await makeFixture()
    const lesson = path.join(
      lessonFixture.repositoryRoot,
      "courses/go-backend/lessons/lesson-00.md"
    )
    const outside = path.join(lessonFixture.repositoryRoot, "outside.md")
    await writeFile(outside, "# Outside\n")
    await rm(lesson)
    await symlink(outside, lesson)
    await expect(buildPublicArtifacts(lessonFixture)).rejects.toThrow(
      "符号链接"
    )

    const mappingFixture = await makeFixture()
    const compatibilityFile = path.join(
      mappingFixture.repositoryRoot,
      "courses/go-backend/compatibility.json"
    )
    const compatibility = JSON.parse(
      await readFile(compatibilityFile, "utf8")
    ) as { lessons: Array<{ lessonId: string }> }
    compatibility.lessons[0].lessonId = "invented"
    await writeFile(compatibilityFile, JSON.stringify(compatibility))
    await expect(buildPublicArtifacts(mappingFixture)).rejects.toThrow(
      "explicit compatibility"
    )
  })
})

describe("公开 Markdown 结构化投影", () => {
  it("移除治理材料并保持源字节不变", () => {
    const source =
      "# final review\n\n" +
      "返回：[目录](README.md) | [主教程](../course.md)\n\n" +
      "## 学习目标\n\n先按 capstone rubric 完成自评。继续解释 shutdown。\n\n" +
      "## 实践步骤\n\n1. 阅读 `cmd/agent/main.go`。\n2. 写入 `docs/go-learning/private.md`。\n3. 验证 `internal/service/runner.go`。\n\n" +
      "## 参考答案\n\n这里是标准答案。\n\n" +
      "## 常见误区\n\n- 只看结果。\n"
    const before = createHash("sha256").update(source).digest("hex")
    const projected = projectPublicLessonMarkdown(source, "final-review.md")
    expect(projected).toContain("继续解释 shutdown。")
    expect(projected).toContain("`cmd/agent/main.go`")
    expect(projected).toContain("`internal/service/runner.go`")
    expect(projected).toContain("## 常见误区")
    expect(projected).not.toMatch(/rubric|自评|参考答案/i)
    expect(projected).not.toContain("docs/go-learning/")
    expect(projected).not.toContain("README.md")
    expect(createHash("sha256").update(source).digest("hex")).toBe(before)
  })
})
