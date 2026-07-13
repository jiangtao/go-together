import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { auditPublicDirectory } from "./public-audit.ts"
import { buildPublicArtifacts } from "./public-course.ts"

const temporaryDirectories: string[] = []

async function generatedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "roadmap-public-audit-"))
  temporaryDirectories.push(root)
  const lessonsDirectory = path.join(root, "input/lessons")
  const progressFile = path.join(root, "input/progress.public.json")
  const outputDirectory = path.join(root, "public")
  await mkdir(lessonsDirectory, { recursive: true })
  await writeFile(
    progressFile,
    JSON.stringify(
      Array.from({ length: 37 }, (_, day) => ({
        day,
        status: "未开始",
        referenceScore: null,
      }))
    )
  )
  await Promise.all(
    Array.from({ length: 37 }, (_, day) => {
      const padded = String(day).padStart(2, "0")
      return writeFile(
        path.join(lessonsDirectory, `day-${padded}-lesson.md`),
        `# Day ${padded}：课程 ${day}\n\n### 学习目标\n\n- 完成目标 ${day}\n`
      )
    })
  )
  await buildPublicArtifacts({ lessonsDirectory, progressFile, outputDirectory })
  return { root, outputDirectory }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("公开产物审计", () => {
  it("接受生成目录和 Vite dist 白名单", async () => {
    const fixture = await generatedFixture()
    await expect(
      auditPublicDirectory(fixture.outputDirectory, "generated")
    ).resolves.toMatchObject({ files: 38, lessons: 37 })

    await writeFile(
      path.join(fixture.outputDirectory, "index.html"),
      '<div id="root"></div><script src="/assets/app.js"></script>'
    )
    await mkdir(path.join(fixture.outputDirectory, "assets"))
    await writeFile(path.join(fixture.outputDirectory, "assets/app.js"), "export {}")
    await writeFile(path.join(fixture.outputDirectory, "assets/font.woff2"), "font")
    await expect(
      auditPublicDirectory(fixture.outputDirectory, "dist")
    ).resolves.toMatchObject({ files: 41, lessons: 37 })
  })

  it("拒绝 source map、旧 schema 字段、私有路径和额外教程", async () => {
    const sourceMap = await generatedFixture()
    await writeFile(path.join(sourceMap.outputDirectory, "assets.map"), "{}")
    await expect(
      auditPublicDirectory(sourceMap.outputDirectory, "generated")
    ).rejects.toThrow("source map")

    const privatePath = await generatedFixture()
    await writeFile(
      path.join(
        privatePath.outputDirectory,
        "sources/lessons/day-00-lesson.md"
      ),
      "private/notes-eval.md"
    )
    await expect(
      auditPublicDirectory(privatePath.outputDirectory, "generated")
    ).rejects.toThrow("笔记或评测文件名")

    const localUrl = await generatedFixture()
    await writeFile(
      path.join(localUrl.outputDirectory, "sources/lessons/day-00-lesson.md"),
      "file:///private/course.md"
    )
    await expect(
      auditPublicDirectory(localUrl.outputDirectory, "generated")
    ).rejects.toThrow("本地文件协议")

    const extraLesson = await generatedFixture()
    await writeFile(
      path.join(
        extraLesson.outputDirectory,
        "sources/lessons/day-00-extra.md"
      ),
      "# Day 00：额外"
    )
    await expect(
      auditPublicDirectory(extraLesson.outputDirectory, "generated")
    ).rejects.toThrow("白名单不一致")
  })

  it.each([
    ["rubric 变体", "### Capstone-Rubric\n\n| 维度 | 证据 |"],
    ["参考答案", "### 参考答案\n\n这里给出标准实现。"],
    ["评测结果", "### 评测结果\n\n得分 100。"],
    ["教程治理路径", "请写入 `docs/go-learning/private.md`。"],
    ["旧课程路径", "读取 `roadmap/src/data/course.json`。"],
  ])("拒绝教程中的%s", async (_name, forbiddenContent) => {
    const fixture = await generatedFixture()
    await writeFile(
      path.join(fixture.outputDirectory, "sources/lessons/day-00-lesson.md"),
      `# Day 00：课程 0\n\n${forbiddenContent}\n`
    )
    await expect(
      auditPublicDirectory(fixture.outputDirectory, "generated")
    ).rejects.toThrow("命中禁止内容")
  })

  it("同时审计 course.json 中的公开目标与完成标准", async () => {
    const fixture = await generatedFixture()
    const coursePath = path.join(fixture.outputDirectory, "course.json")
    const course = JSON.parse(await readFile(coursePath, "utf8")) as {
      lessons: Array<{ objective: string; goals: string[] }>
    }
    course.lessons[0].objective = "Use the grading criteria as the answer key."
    course.lessons[0].goals = ["完成公开课程"]
    await writeFile(coursePath, JSON.stringify(course))
    await expect(
      auditPublicDirectory(fixture.outputDirectory, "generated")
    ).rejects.toThrow("答案或评测材料")
  })
})
