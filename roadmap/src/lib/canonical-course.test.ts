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

describe("canonical Course runtime loader", () => {
  it("resolves only the root alias and exact canonical Course paths", () => {
    expect(resolveCoursePath("/")).toEqual({
      courseId: "go-backend",
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
    expect(canonical.courseRevision).toBe(REVISION)
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

  it("projects a structurally different Course without Day labels", async () => {
    const course = {
      schemaVersion: 1,
      courseId: "python-core",
      courseRevision: REVISION,
      title: "Python Core",
      description: "Python language foundations",
      language: { id: "python", label: "Python" },
      lifecycle: "published",
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
