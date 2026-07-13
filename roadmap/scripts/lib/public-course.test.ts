import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  buildPublicArtifacts,
  LESSONS_DIRECTORY,
  parseLessonMarkdown,
  parsePublicProgress,
  PROGRESS_FILE,
  projectPublicLessonMarkdown,
} from "./public-course.ts"

const temporaryDirectories: string[] = []

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "roadmap-public-course-"))
  temporaryDirectories.push(root)
  const lessonsDirectory = path.join(root, "lessons")
  const progressFile = path.join(root, "content", "progress.public.json")
  const outputDirectory = path.join(root, "output")
  await mkdir(lessonsDirectory, { recursive: true })
  await mkdir(path.dirname(progressFile), { recursive: true })

  const progress = Array.from({ length: 37 }, (_, day) => ({
    day,
    status: day === 0 ? "通过" : "未开始",
    referenceScore: day === 0 ? 92 : null,
  }))
  await writeFile(progressFile, `${JSON.stringify(progress, null, 2)}\n`)
  await Promise.all(
    Array.from({ length: 37 }, (_, day) => {
      const paddedDay = String(day).padStart(2, "0")
      return writeFile(
        path.join(lessonsDirectory, `day-${paddedDay}-lesson-${paddedDay}.md`),
        `# Day ${paddedDay}：课程 ${day}\n\nEnglish title: **Day ${paddedDay}: Lesson ${day}**\n\n### 学习目标\n\n今天完成 Day ${day}。\n\n- 目标 ${day}A\n- 目标 ${day}B\n`
      )
    })
  )
  return { root, lessonsDirectory, progressFile, outputDirectory, progress }
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

describe("安全公开课程生成器", () => {
  it("只生成 schema v3 课程摘要和 Day 0-36 教程", async () => {
    const fixture = await makeFixture()
    const course = await buildPublicArtifacts(fixture)

    expect(course.schemaVersion).toBe(3)
    expect(course.lessons).toHaveLength(37)
    expect(course.lessons[0]).toMatchObject({
      day: 0,
      status: "通过",
      referenceScore: 92,
      lessonHref: "/sources/lessons/day-00-lesson-00.md",
    })
    expect(Object.keys(course.lessons[0]).sort()).toEqual(
      [
        "day",
        "dayLabel",
        "englishTitle",
        "goals",
        "id",
        "lessonHref",
        "objective",
        "referenceScore",
        "stageId",
        "status",
        "title",
      ].sort()
    )
    await expect(
      readFile(
        path.join(
          fixture.outputDirectory,
          "sources/lessons/day-36-lesson-36.md"
        ),
        "utf8"
      )
    ).resolves.toContain("# Day 36")
  })

  it("连续两次生成得到逐字节一致的文件树", async () => {
    const fixture = await makeFixture()
    await buildPublicArtifacts(fixture)
    const first = await directorySnapshot(fixture.outputDirectory)
    await buildPublicArtifacts(fixture)
    const second = await directorySnapshot(fixture.outputDirectory)
    expect(second).toEqual(first)
  })

  it.each([
    ["额外字段", (records: Record<string, unknown>[]) => (records[0].privateNote = "secret")],
    ["重复 Day", (records: Record<string, unknown>[]) => (records[1].day = 0)],
    ["越界 Day", (records: Record<string, unknown>[]) => (records[36].day = 37)],
    ["非法状态", (records: Record<string, unknown>[]) => (records[0].status = "已完成")],
    ["非法分数", (records: Record<string, unknown>[]) => (records[0].referenceScore = 101)],
  ])("拒绝 progress 的%s", async (_name, mutate) => {
    const fixture = await makeFixture()
    const records = structuredClone(fixture.progress) as unknown as Record<
      string,
      unknown
    >[]
    mutate(records)
    await writeFile(fixture.progressFile, JSON.stringify(records))
    await expect(buildPublicArtifacts(fixture)).rejects.toThrow()
  })

  it("拒绝缺失、重复或危险命名的课程文件", async () => {
    const missing = await makeFixture()
    await rm(path.join(missing.lessonsDirectory, "day-36-lesson-36.md"))
    await expect(buildPublicArtifacts(missing)).rejects.toThrow("Day 0-36")

    const duplicate = await makeFixture()
    await writeFile(
      path.join(duplicate.lessonsDirectory, "day-00-duplicate.md"),
      "# Day 00：重复"
    )
    await expect(buildPublicArtifacts(duplicate)).rejects.toThrow("不得缺失或重复")

    const dangerous = await makeFixture()
    await writeFile(
      path.join(dangerous.lessonsDirectory, "day-00-bad%2fname.md"),
      "# Day 00：危险"
    )
    await expect(buildPublicArtifacts(dangerous)).rejects.toThrow("白名单命名")
  })

  it("拒绝课程或进度符号链接", async () => {
    const lessonFixture = await makeFixture()
    const lessonPath = path.join(
      lessonFixture.lessonsDirectory,
      "day-00-lesson-00.md"
    )
    const outsideLesson = path.join(lessonFixture.root, "outside.md")
    await writeFile(outsideLesson, "# Day 00：越界")
    await rm(lessonPath)
    await symlink(outsideLesson, lessonPath)
    await expect(buildPublicArtifacts(lessonFixture)).rejects.toThrow("符号链接")

    const progressFixture = await makeFixture()
    const outsideProgress = path.join(progressFixture.root, "outside.json")
    await writeFile(outsideProgress, JSON.stringify(progressFixture.progress))
    await rm(progressFixture.progressFile)
    await symlink(outsideProgress, progressFixture.progressFile)
    await expect(buildPublicArtifacts(progressFixture)).rejects.toThrow("符号链接")
  })

  it("拒绝课程根目录或进度父目录通过符号链接越界", async () => {
    const lessonFixture = await makeFixture()
    const relocatedLessons = path.join(lessonFixture.root, "outside-lessons")
    await rename(lessonFixture.lessonsDirectory, relocatedLessons)
    await symlink(relocatedLessons, lessonFixture.lessonsDirectory)
    await expect(buildPublicArtifacts(lessonFixture)).rejects.toThrow(
      "符号链接目录"
    )

    const progressFixture = await makeFixture()
    const progressDirectory = path.dirname(progressFixture.progressFile)
    const relocatedProgress = path.join(progressFixture.root, "outside-content")
    await rename(progressDirectory, relocatedProgress)
    await symlink(relocatedProgress, progressDirectory)
    await expect(buildPublicArtifacts(progressFixture)).rejects.toThrow(
      "符号链接目录"
    )
  })
})

describe("公开输入解析", () => {
  it("结构化投影移除治理材料并保留教学代码路径", () => {
    const projected = projectPublicLessonMarkdown(
      `# Day 36：final review\n\nEnglish title: **Day 36: final review**\n\n返回：[目录](README.md) | [主教程](../course.md)\n\n### 学习目标\n\n先按 capstone rubric 完成自评。继续解释 HTTP 到 shutdown 的链路。\n\n### 实践步骤\n\n1. 阅读 \`cmd/agent/main.go\`。\n2. 写入 \`docs/go-learning/private-review.md\`。\n3. 验证 \`internal/service/runner.go\`。\n\n### 参考答案\n\n这里是标准答案。\n\n### 评测标准\n\n| 维度 | 分数 |\n|---|---|\n| 实现 | 100 |\n\n### 常见误区\n\n- 只看结果，不解释取消链路。\n`,
      "day-36-final-review.md"
    )

    expect(projected).toContain("继续解释 HTTP 到 shutdown 的链路。")
    expect(projected).toContain("`cmd/agent/main.go`")
    expect(projected).toContain("`internal/service/runner.go`")
    expect(projected).toContain("### 常见误区")
    expect(projected).not.toMatch(/rubric|自评|参考答案|评测标准/i)
    expect(projected).not.toContain("docs/go-learning/")
    expect(projected).not.toContain("README.md")
  })

  it("实际 Day 36 投影连贯且生成过程不改源教程", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "roadmap-day36-public-"))
    temporaryDirectories.push(root)
    const sourcePath = path.join(
      LESSONS_DIRECTORY,
      "day-36-final-review.md"
    )
    const before = await readFile(sourcePath, "utf8")
    const beforeHash = createHash("sha256").update(before).digest("hex")
    expect(before).toContain("capstone rubric")
    expect(before).toContain("docs/go-learning/")

    const course = await buildPublicArtifacts({
      lessonsDirectory: LESSONS_DIRECTORY,
      progressFile: PROGRESS_FILE,
      outputDirectory: root,
    })
    const after = await readFile(sourcePath, "utf8")
    const publicDay36 = await readFile(
      path.join(root, "sources/lessons/day-36-final-review.md"),
      "utf8"
    )

    expect(createHash("sha256").update(after).digest("hex")).toBe(beforeHash)
    expect(publicDay36).toContain("# Day 36：final review")
    expect(publicDay36).toContain("### Go 核心心智")
    expect(publicDay36).toContain("### 实践步骤")
    expect(publicDay36).toContain("### 测试/验证命令")
    expect(publicDay36).toContain("### 常见误区")
    expect(publicDay36).toContain("HTTP/gRPC -> service -> sqlc repository")
    expect(publicDay36).not.toMatch(/rubric|自评|参考答案|评测标准/i)
    expect(publicDay36).not.toContain("docs/go-learning/")
    expect(publicDay36).not.toContain("### Capstone rubric 对齐")
    expect(publicDay36).not.toContain("它缺的是代码")
    expect(course.lessons[36].objective).toContain(
      "HTTP/gRPC -> service -> sqlc repository"
    )
    expect(course.lessons[36].objective).not.toMatch(/rubric|自评/i)
    expect(course.lessons[36].goals.join(" ")).not.toMatch(/rubric|自评/i)
  })

  it("从教程提取标题、目标和完成标准", () => {
    expect(
      parseLessonMarkdown(`# Day 07：HTTP Routing\n\nEnglish title: **Day 07: HTTP Routing**\n\n### 学习目标\n\n今天建立可测试路由。\n\n- 能注册路由。\n- 能解释边界。\n`)
    ).toEqual({
      day: 7,
      title: "HTTP Routing",
      englishTitle: "Day 07: HTTP Routing",
      objective: "今天建立可测试路由。",
      goals: ["能注册路由。", "能解释边界。"],
    })
  })

  it("progress 必须完整覆盖 37 天", () => {
    expect(() => parsePublicProgress([])).toThrow("37 条")
  })
})
