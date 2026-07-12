import { describe, expect, it } from "vitest"

import {
  buildCourseData,
  exerciseResourceCandidates,
  normalizeStatus,
  parseEvaluationMarkdown,
  parseLessonMarkdown,
  sourceHrefForRepositoryPath,
} from "./course-data.ts"

describe("课程 Markdown 解析", () => {
  it("提取 Day、双语标题、目标与目标列表", () => {
    const lesson = parseLessonMarkdown(
      `# Day 07：HTTP Routing

English title: **Day 07: HTTP Routing**

返回：[目录](README.md)

### 学习目标

今天要把路由边界变得可测试。

- 能注册一个最小路由。
- 能解释 handler 与 service 的边界。

### 实践步骤

1. 开始练习。
`,
      "day-07-http-routing.md"
    )

    expect(lesson).toEqual({
      day: 7,
      title: "HTTP Routing",
      englishTitle: "Day 07: HTTP Routing",
      objective: "今天要把路由边界变得可测试。",
      goals: ["能注册一个最小路由。", "能解释 handler 与 service 的边界。"],
    })
  })

  it("为没有学习目标章节的 Day 0 提取导语目标", () => {
    const lesson = parseLessonMarkdown(`# Day 00：为什么学 Go

English title: **Day 00: Why Go**

返回：[目录](README.md)

本文件是前言。今天不写代码，目标是搞清楚背景、动机和判断标准。

## 先把语言战争放下

正文。
`)

    expect(lesson.objective).toBe(
      "本文件是前言。今天不写代码，目标是搞清楚背景、动机和判断标准。"
    )
    expect(lesson.goals).toEqual([lesson.objective])
  })

  it("拒绝缺少合法 Day 标题的课程文件", () => {
    expect(() => parseLessonMarkdown("# 普通标题", "broken.md")).toThrow(
      "broken.md: 缺少合法的 Day 一级标题"
    )
  })
})

describe("评测状态归一", () => {
  it.each(["未开始", "定向回炉", "重新学习", "通过"] as const)(
    "识别 %s",
    (status) => {
      expect(normalizeStatus(`**${status}**`)).toBe(status)
    }
  )

  it("未知或缺失状态归一为未开始", () => {
    expect(normalizeStatus("优秀")).toBe("未开始")
    expect(normalizeStatus(undefined)).toBe("未开始")
  })

  it("优先读取明确标签并提取参考分数", () => {
    const evaluation = parseEvaluationMarkdown(`
# Day 8 评测

说明：状态可能是未开始、定向回炉、重新学习或通过。

- **评测状态**：定向回炉
- **参考分数**：72.5 / 100
`)

    expect(evaluation).toEqual({
      status: "定向回炉",
      referenceScore: 72.5,
    })
  })

  it("多次评测时采用最后一个明确结论和分数", () => {
    const evaluation = parseEvaluationMarkdown(`
状态：重新学习
参考分数：48

## 复评
结论：通过
参考分数：91分
`)

    expect(evaluation).toEqual({ status: "通过", referenceScore: 91 })
  })

  it("忽略代码块里的伪状态和越界分数", () => {
    const evaluation = parseEvaluationMarkdown(`
\`\`\`md
状态：通过
参考分数：100
\`\`\`

参考分数：120
`)

    expect(evaluation).toEqual({ status: "未开始", referenceScore: null })
  })
})

describe("课程资源定位", () => {
  it("按兼容目录名生成确定且去重的笔记候选路径", () => {
    const candidates = exerciseResourceCandidates(8, [
      "notes.md",
      "README.md",
    ])

    expect(candidates[0]).toBe("exercise/day8/notes.md")
    expect(candidates).toContain("exercise/day-08/README.md")
    expect(candidates).toContain("exercise/day-8/notes.md")
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it("只为仓库内路径生成静态 Markdown 地址", () => {
    expect(
      sourceHrefForRepositoryPath(
        "docs/go-learning/daily-lessons/day-08-json-dto.md"
      )
    ).toBe(
      "/sources/docs/go-learning/daily-lessons/day-08-json-dto.md"
    )
    expect(() => sourceHrefForRepositoryPath("../outside.md")).toThrow(
      "仓库外路径"
    )
  })

  it("为 Day 0-36 生成课程、笔记和评测资源契约", async () => {
    const data = await buildCourseData()

    expect(data.schemaVersion).toBe(2)
    expect(data.lessons).toHaveLength(37)
    for (const lesson of data.lessons) {
      expect(lesson.resources.map((resource) => resource.kind)).toEqual([
        "lesson",
        "notes",
        "evaluation",
      ])
      expect(lesson.resources[0].exists).toBe(true)
      expect(lesson.resources[0].href).toBe(
        sourceHrefForRepositoryPath(lesson.lessonPath)
      )
    }
  })
})
