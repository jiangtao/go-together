import { describe, expect, it, vi } from "vitest"

import {
  loadCanonicalCourse,
  resolveCoursePath,
} from "@/lib/canonical-course"

const REVISION = `sha256:${"1".repeat(64)}`
const CONTENT_REVISION = `sha256:${"2".repeat(64)}`

function canonicalFixture() {
  const ranges = [
    [0, 6],
    [7, 12],
    [13, 18],
    [19, 22],
    [23, 28],
    [29, 36],
  ] as const
  const stages = ranges.map(([start, end], index) => ({
    stageId: `stage-${index + 1}`,
    title: `Stage ${index + 1}`,
    description: `Stage ${index + 1} description`,
    lessons: Array.from({ length: end - start + 1 }, (_, offset) => {
      const day = start + offset
      const lessonId = `lesson-${String(day).padStart(2, "0")}`
      return {
        lessonId,
        lifecycle: "active",
        day,
        title: `Lesson ${day}`,
        objective: `Objective ${day}`,
        goals: [`Goal ${day}`],
        contentRevision: CONTENT_REVISION,
        lessonHref: `/courses/go-backend/sources/lessons/${lessonId}.md`,
      }
    }),
  }))
  const course = {
    schemaVersion: 1,
    courseId: "go-backend",
    courseRevision: REVISION,
    title: "Go Backend",
    description: "Go backend course",
    language: { id: "go", label: "Go" },
    lifecycle: "published",
    visibility: "listed",
    replacementCourseId: null,
    tracks: [
      {
        trackId: "language-and-web",
        title: "Language and Web",
        description: "Language track",
        stages: stages.slice(0, 2),
      },
      {
        trackId: "data-and-contracts",
        title: "Data and Contracts",
        description: "Data track",
        stages: stages.slice(2, 4),
      },
      {
        trackId: "runtime-and-agent",
        title: "Runtime and Agent",
        description: "Runtime track",
        stages: stages.slice(4),
      },
    ],
  }
  const lessons = stages.flatMap((stage) =>
    stage.lessons.map((lesson) => ({
      lessonId: lesson.lessonId,
      status: lesson.day === 0 ? "通过" : "未开始",
      referenceScore: lesson.day === 0 ? 90 : null,
    }))
  )
  const progress = {
    schemaVersion: 1,
    courseId: "go-backend",
    courseRevision: REVISION,
    lessons,
  }
  const catalog = {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: [
      {
        courseId: "go-backend",
        courseRevision: REVISION,
        title: course.title,
        description: course.description,
        language: course.language,
        lifecycle: "published",
        visibility: "listed",
        replacementCourseId: null,
        pageHref: "/courses/go-backend",
        courseHref: "/courses/go-backend/course.json",
        progressHref: "/courses/go-backend/progress.json",
      },
    ],
  }
  return { catalog, course, progress }
}

function fetcher(fixture = canonicalFixture()) {
  const byPath = new Map<string, unknown>([
    ["/courses/catalog.json", fixture.catalog],
    ["/courses/go-backend/course.json", fixture.course],
    ["/courses/go-backend/progress.json", fixture.progress],
  ])
  return vi.fn<typeof fetch>(async (input) => {
    const href = String(input)
    const value = byPath.get(href)
    return value === undefined
      ? new Response("missing", { status: 404 })
      : Response.json(value)
  })
}

function secondaryFixture(
  status: "未开始" | "定向回炉" | "重新学习" | "通过" = "未开始"
) {
  const course = {
    schemaVersion: 1,
    courseId: "python-core",
    courseRevision: REVISION,
    title: "Python Core",
    description: "Python language foundations",
    language: { id: "python", label: "Python" },
    lifecycle: "published",
    visibility: "listed",
    replacementCourseId: null,
    tracks: [
      {
        trackId: "language-model",
        title: "Language model",
        description: "Understand Python semantics",
        stages: [
          {
            stageId: "functions",
            title: "Functions",
            description: "Functions and decorators",
            lessons: [
              {
                lessonId: "decorators",
                lifecycle: "active",
                day: null,
                title: "Decorators",
                objective: "Explain decorator composition",
                goals: ["Compose two decorators"],
                contentRevision: CONTENT_REVISION,
                lessonHref:
                  "/courses/python-core/sources/lessons/decorators.md",
              },
            ],
          },
        ],
      },
    ],
  }
  const progress = {
    schemaVersion: 1,
    courseId: "python-core",
    courseRevision: REVISION,
    lessons: [
      {
        lessonId: "decorators",
        status,
        referenceScore: status === "通过" ? 90 : null,
      },
    ],
  }
  const declaration = {
    courseId: "python-core",
    courseRevision: REVISION,
    title: course.title,
    description: course.description,
    language: course.language,
    lifecycle: "published",
    visibility: "listed",
    replacementCourseId: null,
    pageHref: "/courses/python-core",
    courseHref: "/courses/python-core/course.json",
    progressHref: "/courses/python-core/progress.json",
  }
  return { course, progress, declaration }
}

function multiCourseFixture(options: {
  goComplete?: boolean
  pythonStatus?: "未开始" | "定向回炉" | "重新学习" | "通过"
} = {}) {
  const go = canonicalFixture()
  if (options.goComplete) {
    go.progress.lessons.forEach((lesson) => {
      lesson.status = "通过"
      lesson.referenceScore = 90
    })
  }
  const python = secondaryFixture(options.pythonStatus)
  const catalog = {
    ...go.catalog,
    // defaultCourseId 不参与运行时默认选择，声明顺序才是稳定创建顺序。
    defaultCourseId: "python-core",
    courses: [go.catalog.courses[0], python.declaration],
  }
  const byPath = new Map<string, unknown>([
    ["/courses/catalog.json", catalog],
    ["/courses/go-backend/course.json", go.course],
    ["/courses/go-backend/progress.json", go.progress],
    ["/courses/python-core/course.json", python.course],
    ["/courses/python-core/progress.json", python.progress],
  ])
  const mockFetch = vi.fn<typeof fetch>(async (input) => {
    const value = byPath.get(String(input))
    return value === undefined
      ? new Response("missing", { status: 404 })
      : Response.json(value)
  })
  return { catalog, go, python, fetcher: mockFetch }
}

describe("canonical Course runtime loader", () => {
  it("resolves only the root alias and exact canonical Course paths", () => {
    expect(resolveCoursePath("/")).toEqual({
      courseId: null,
      canonicalPath: "/",
      shouldNormalize: false,
    })
    expect(resolveCoursePath("/courses/python-core")).toEqual({
      courseId: "python-core",
      canonicalPath: "/courses/python-core",
      shouldNormalize: false,
    })
    expect(resolveCoursePath("/courses/python-core/")).toEqual({
      courseId: "python-core",
      canonicalPath: "/courses/python-core",
      shouldNormalize: true,
    })
    expect(() => resolveCoursePath("/courses/Python")).toThrow("URL 无效")
    expect(() => resolveCoursePath("/courses/python-core/extra")).toThrow(
      "URL 无效"
    )
  })

  it("loads root and canonical Go routes from Catalog/Course/Progress only", async () => {
    const mockFetch = fetcher()
    const root = await loadCanonicalCourse("/", { fetcher: mockFetch })
    const canonical = await loadCanonicalCourse("/courses/go-backend", {
      fetcher: mockFetch,
    })

    expect(root.courseRevision).toBe(REVISION)
    expect(root.selectionReason).toBe("catalog-first")
    expect(root.canonicalPath).toBe("/courses/go-backend")
    expect(canonical.courseRevision).toBe(REVISION)
    expect(canonical.selectionReason).toBe("explicit")
    expect(canonical.courseData).toEqual(root.courseData)
    expect(root.courseData.lessons).toHaveLength(37)
    expect(root.courseData.lessons[0]).toMatchObject({
      status: "通过",
      lessonHref:
        "/courses/go-backend/sources/lessons/lesson-00.md",
    })
    const requests = mockFetch.mock.calls.map(([input]) => String(input))
    expect(requests).not.toContain("/course.json")
    expect(new Set(requests)).toEqual(
      new Set([
        "/courses/catalog.json",
        "/courses/go-backend/course.json",
        "/courses/go-backend/progress.json",
      ])
    )
  })

  it("根路径选择 Catalog 中第一门 Published Course", async () => {
    const fixture = multiCourseFixture()
    const events: string[] = []
    const orderedFetch = vi.fn<typeof fetch>(async (input, init) => {
      events.push(String(input))
      return fixture.fetcher(input, init)
    })
    const result = await loadCanonicalCourse("/", {
      fetcher: orderedFetch,
      onCanonicalPath: (pathname) => events.push(`replace:${pathname}`),
    })

    expect(result.courseId).toBe("go-backend")
    expect(result.selectionReason).toBe("catalog-first")
    expect(result.canonicalPath).toBe("/courses/go-backend")
    expect(events).toEqual([
      "/courses/catalog.json",
      "replace:/courses/go-backend",
      "/courses/go-backend/course.json",
      "/courses/go-backend/progress.json",
    ])
  })

  it("第一门 Course 已完成时仍按 Catalog 顺序选择第一门", async () => {
    const fixture = multiCourseFixture({
      goComplete: true,
      pythonStatus: "定向回炉",
    })
    const result = await loadCanonicalCourse("/", {
      fetcher: fixture.fetcher,
    })

    expect(result.courseId).toBe("go-backend")
    expect(result.selectionReason).toBe("catalog-first")
    expect(result.canonicalPath).toBe("/courses/go-backend")
    expect(fixture.fetcher.mock.calls.map(([input]) => String(input))).not.toContain(
      "/courses/python-core/progress.json"
    )
  })

  it("显式有效 courseId 永远优先且不读取其他 Course 的进度", async () => {
    const fixture = multiCourseFixture()
    const result = await loadCanonicalCourse("/courses/python-core", {
      fetcher: fixture.fetcher,
    })
    const requests = fixture.fetcher.mock.calls.map(([input]) => String(input))

    expect(result.courseId).toBe("python-core")
    expect(result.selectionReason).toBe("explicit")
    expect(result.canonicalPath).toBe("/courses/python-core")
    expect(requests).not.toContain("/courses/go-backend/course.json")
    expect(requests).not.toContain("/courses/go-backend/progress.json")
  })

  it("无效 courseId 确定性回退到 Catalog 第一门 Published Course", async () => {
    const fixture = multiCourseFixture({
      goComplete: true,
      pythonStatus: "重新学习",
    })
    const result = await loadCanonicalCourse("/courses/not-registered", {
      fetcher: fixture.fetcher,
    })

    expect(result.courseId).toBe("go-backend")
    expect(result.selectionReason).toBe("invalid-course-fallback")
    expect(result.canonicalPath).toBe("/courses/go-backend")
    expect(result.selectionNotice).toContain("未找到课程“not-registered”")
    expect(result.selectionNotice).toContain("Go Backend")
    expect(fixture.fetcher.mock.calls.map(([input]) => String(input))).not.toContain(
      "/courses/python-core/course.json"
    )
  })

  it("Catalog 为空时单次读取后进入无 Published 课程结果", async () => {
    const emptyCatalogFetch = vi.fn<typeof fetch>(async (input) => {
      if (String(input) !== "/courses/catalog.json") {
        return new Response("unexpected", { status: 500 })
      }
      return Response.json({
        schemaVersion: 1,
        defaultCourseId: "go-backend",
        courses: [],
      })
    })

    await expect(
      loadCanonicalCourse("/", { fetcher: emptyCatalogFetch })
    ).rejects.toThrow("当前没有可公开的 Published 课程")
    expect(emptyCatalogFetch).toHaveBeenCalledTimes(1)
  })

  it("生产运行时拒绝包含 Draft 的 Public Catalog，避免污染默认候选", async () => {
    const fixture = multiCourseFixture()
    fixture.catalog.courses.push({
      ...fixture.python.declaration,
      courseId: "draft-course",
      title: "Draft Course",
      lifecycle: "draft",
      visibility: "listed",
      pageHref: "/courses/draft-course",
      courseHref: "/courses/draft-course/course.json",
      progressHref: "/courses/draft-course/progress.json",
    })

    await expect(
      loadCanonicalCourse("/", { fetcher: fixture.fetcher })
    ).rejects.toThrow("Published 或 Retired")
  })

  it("projects a structurally different Course without Day labels", async () => {
    const course = {
      schemaVersion: 1,
      courseId: "python-core",
      courseRevision: REVISION,
      title: "Python Core",
      description: "Python language foundations",
      language: { id: "python", label: "Python" },
      lifecycle: "published",
      visibility: "listed",
      replacementCourseId: null,
      tracks: [
        {
          trackId: "language-model",
          title: "Language model",
          description: "Understand Python semantics",
          stages: [
            {
              stageId: "functions",
              title: "Functions",
              description: "Functions and decorators",
              lessons: [
                {
                  lessonId: "decorators",
                  lifecycle: "active",
                  day: null,
                  title: "Decorators",
                  objective: "Explain decorator composition",
                  goals: ["Compose two decorators"],
                  contentRevision: CONTENT_REVISION,
                  lessonHref:
                    "/courses/python-core/sources/lessons/decorators.md",
                },
              ],
            },
          ],
        },
      ],
    }
    const progress = {
      schemaVersion: 1,
      courseId: "python-core",
      courseRevision: REVISION,
      lessons: [
        {
          lessonId: "decorators",
          status: "未开始",
          referenceScore: null,
        },
      ],
    }
    const catalog = {
      schemaVersion: 1,
      defaultCourseId: "go-backend",
      courses: [
        canonicalFixture().catalog.courses[0],
        {
          courseId: "python-core",
          courseRevision: REVISION,
          title: course.title,
          description: course.description,
          language: course.language,
          lifecycle: "published",
          visibility: "listed",
          replacementCourseId: null,
          pageHref: "/courses/python-core",
          courseHref: "/courses/python-core/course.json",
          progressHref: "/courses/python-core/progress.json",
        },
      ],
    }
    const byPath = new Map<string, unknown>([
      ["/courses/catalog.json", catalog],
      ["/courses/python-core/course.json", course],
      ["/courses/python-core/progress.json", progress],
    ])
    const result = await loadCanonicalCourse("/courses/python-core", {
      fetcher: vi.fn<typeof fetch>(async (input) => {
        const value = byPath.get(String(input))
        return value === undefined
          ? new Response("missing", { status: 404 })
          : Response.json(value)
      }),
    })

    expect(result.courseData).toMatchObject({
      courseId: "python-core",
      title: "Python Core",
      tracks: [{ id: "language-model" }],
      stages: [{ id: "functions" }],
      lessons: [
        {
          courseId: "python-core",
          lessonId: "decorators",
          day: null,
          label: "课次 1",
        },
      ],
    })
  })

  it("fails closed on revision drift, unknown routes, and extra fields", async () => {
    const drift = canonicalFixture()
    drift.progress.courseRevision = `sha256:${"3".repeat(64)}`
    await expect(
      loadCanonicalCourse("/", { fetcher: fetcher(drift) })
    ).rejects.toThrow("不一致")
    await expect(
      loadCanonicalCourse("/unexpected", { fetcher: fetcher() })
    ).rejects.toThrow("URL 无效")

    const extra = canonicalFixture()
    Object.assign(extra.catalog, { privatePath: "/tmp/private" })
    await expect(
      loadCanonicalCourse("/", { fetcher: fetcher(extra) })
    ).rejects.toThrow("非白名单字段")
  })
})
