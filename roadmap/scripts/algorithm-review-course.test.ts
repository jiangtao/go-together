import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { parseSourceCourse } from "./lib/course-contract.ts"

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const coursePath = path.join(
  workspaceRoot,
  "courses/algorithm-review/course.json"
)

async function loadAlgorithmReviewCourse() {
  const raw = JSON.parse(await readFile(coursePath, "utf8")) as unknown
  return parseSourceCourse(raw)
}

describe("算法复习 37 天课程规格", () => {
  it("固定 30 天经典算法主线、7 天 Agent 周与 Unlisted 发布边界", async () => {
    const course = await loadAlgorithmReviewCourse()
    const lessons = course.tracks.flatMap((track) =>
      track.stages.flatMap((stage) => stage.lessons)
    )

    expect(course.lifecycle).toBe("published")
    expect(course.visibility).toBe("unlisted")
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
          path.join(workspaceRoot, "courses/algorithm-review", lesson.contentPath),
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
