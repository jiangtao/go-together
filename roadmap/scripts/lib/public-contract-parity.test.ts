import { describe, expect, it } from "vitest"

import {
  parsePublicCatalog as parseBrowserCatalog,
  parsePublicCourse as parseBrowserCourse,
  parsePublicProgress as parseBrowserProgress,
} from "../../src/lib/public-course-contract.ts"
import {
  parsePublicCatalog as parseNodeCatalog,
  parsePublicCourse as parseNodeCourse,
  parsePublicProgress as parseNodeProgress,
} from "./course-contract.ts"

const REVISION = `sha256:${"1".repeat(64)}`

function invalidFixtures() {
  const catalog = {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: [
      {
        courseId: "go-backend",
        courseRevision: REVISION,
        title: "Go Backend",
        description: "Go backend course",
        language: { id: "go", label: "Go" },
        lifecycle: "published",
        replacementCourseId: "go-next",
        pageHref: "/courses/go-backend",
        courseHref: "/courses/go-backend/course.json",
        progressHref: "/courses/go-backend/progress.json",
      },
    ],
  }
  const course = {
    schemaVersion: 1,
    courseId: "go-backend",
    courseRevision: REVISION,
    title: "Go Backend",
    description: "Go backend course",
    language: { id: "go", label: "Go" },
    lifecycle: "published",
    replacementCourseId: "go-next",
    tracks: [
      {
        trackId: "foundations",
        title: "Foundations",
        description: "Foundation track",
        stages: [
          {
            stageId: "basics",
            title: "Basics",
            description: "Basic stage",
            lessons: [
              {
                lessonId: "first-lesson",
                lifecycle: "active",
                day: 0,
                title: "First lesson",
                objective: "Learn the first concept",
                goals: ["Explain the concept"],
                contentRevision: REVISION,
                lessonHref:
                  "/courses/go-backend/sources/lessons/first-lesson.md",
              },
            ],
          },
        ],
      },
    ],
  }
  const progress = {
    schemaVersion: 1,
    courseId: "go-backend",
    courseRevision: REVISION,
    lessons: [
      { lessonId: "first-lesson", status: "未开始", referenceScore: 80 },
    ],
  }
  return { catalog, course, progress }
}

function errorMessage(operation: () => unknown): string {
  try {
    operation()
    throw new Error("expected parser to reject fixture")
  } catch (error) {
    return (error as Error).message
  }
}

describe("Public Contract Node/browser parser parity", () => {
  it("rejects the same invalid catalog, course, and progress fixtures", () => {
    const { catalog, course, progress } = invalidFixtures()
    const pairs: Array<[() => unknown, () => unknown]> = [
      [() => parseBrowserCatalog(catalog), () => parseNodeCatalog(catalog)],
      [() => parseBrowserCourse(course), () => parseNodeCourse(course)],
      [() => parseBrowserProgress(progress), () => parseNodeProgress(progress)],
    ]
    for (const [browserParser, nodeParser] of pairs) {
      const browserMessage = errorMessage(browserParser)
      const nodeMessage = errorMessage(nodeParser)
      expect(nodeMessage).toBe(browserMessage)
      expect(browserMessage).not.toBe("expected parser to reject fixture")
    }
  })
})
