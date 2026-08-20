import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { parseSourceCourse } from "./lib/course-contract.ts"
import { buildPublicArtifacts } from "./lib/public-course.ts"

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const coursePath = path.join(
  workspaceRoot,
  "courses/algorithm/course.json"
)

async function loadAlgorithmReviewCourse() {
  const raw = JSON.parse(await readFile(coursePath, "utf8")) as unknown
  return parseSourceCourse(raw)
}

describe("算法复习 37 天课程规格", () => {
  it("固定 30 天经典算法主线、7 天 Agent 周与 Local-only 发布边界", async () => {
    const course = await loadAlgorithmReviewCourse()
    const catalog = JSON.parse(
      await readFile(path.join(workspaceRoot, "courses/catalog.json"), "utf8")
    ) as { courses: Array<{ courseId: string; distribution: string }> }
    const lessons = course.tracks.flatMap((track) =>
      track.stages.flatMap((stage) => stage.lessons)
    )

    expect(course.lifecycle).toBe("published")
    expect(course.visibility).toBe("unlisted")
    expect(
      catalog.courses.find((entry) => entry.courseId === "algorithm")
        ?.distribution
    ).toBe("local-only")
    expect(lessons.map((lesson) => lesson.day)).toEqual(
      Array.from({ length: 37 }, (_, index) => index + 1)
    )

    const agentTrack = course.tracks.find(
      (track) => track.trackId === "agent-era-algorithms"
    )
    expect(agentTrack).toBeDefined()
    expect(
      agentTrack?.stages.flatMap((stage) => stage.lessons).map((lesson) => lesson.day)
    ).toEqual([31, 32, 33, 34, 35, 36, 37])
    expect(lessons.filter((lesson) => lesson.day !== null && lesson.day <= 30)).toHaveLength(30)
  })

  it("公开投影零算法产物，本地投影仍可直达完整课程", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "algorithm-distribution-"))
    const publicDirectory = path.join(root, "public")
    const localDirectory = path.join(root, "local")
    try {
      await buildPublicArtifacts({ outputDirectory: publicDirectory })
      const publicCatalog = JSON.parse(
        await readFile(path.join(publicDirectory, "courses/catalog.json"), "utf8")
      ) as { courses: Array<{ courseId: string }> }
      expect(publicCatalog.courses.map((entry) => entry.courseId)).not.toContain(
        "algorithm"
      )
      await expect(
        readFile(path.join(publicDirectory, "courses/algorithm/course.json"))
      ).rejects.toMatchObject({ code: "ENOENT" })

      await buildPublicArtifacts({
        outputDirectory: localDirectory,
        includeLocalOnly: true,
      })
      const localCourse = JSON.parse(
        await readFile(
          path.join(localDirectory, "courses/algorithm/course.json"),
          "utf8"
        )
      ) as { courseId: string; title: string }
      expect(localCourse).toMatchObject({
        courseId: "algorithm",
        title: "算法回顾",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("让每节课程维持不重复的三层题组、限时与复盘", async () => {
    const course = await loadAlgorithmReviewCourse()
    const lessons = course.tracks.flatMap((track) =>
      track.stages.flatMap((stage) => stage.lessons)
    )
    const headings = [
      "### 简单恢复",
      "### 经典模板（Hot 100 优先）",
      "### 深入迁移",
      "## 限时与复盘",
    ]

    await Promise.all(
      lessons.map(async (lesson) => {
        const content = await readFile(
          path.join(workspaceRoot, "courses/algorithm", lesson.contentPath),
          "utf8"
        )
        const positions = headings.map((heading) => content.indexOf(heading))
        expect(positions.every((position) => position >= 0), lesson.lessonId).toBe(true)
        expect(positions).toEqual([...positions].sort((left, right) => left - right))

        const problems = [...content.matchAll(/\]\((https:\/\/leetcode\.cn\/problems\/[^)]+)\)/g)].map(
          (match) => match[1]
        )
        expect(new Set(problems).size, lesson.lessonId).toBe(problems.length)
        if (lesson.day !== null && lesson.day <= 30) {
          expect(problems.length, lesson.lessonId).toBeGreaterThanOrEqual(10)
        }
      })
    )
  })
})
