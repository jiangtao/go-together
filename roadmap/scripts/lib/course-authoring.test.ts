import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  compileCourseContract,
  exportReleaseProgressSnapshot,
  type AuthoringFiles,
  type SourceCatalog,
  type SourceCourse,
} from "./course-contract.ts"
import { buildMultiCoursePublicArtifacts } from "./multi-course-public.ts"
import {
  assertAuthoringTargetsAvailable,
  authoringTargets,
  validateCoursePublication,
  validateDraftCourse,
  validateDraftLessonAddition,
} from "./course-authoring.ts"

const temporaryDirectories: string[] = []

function lesson(lessonId: string, day: number | null = null) {
  return {
    lessonId,
    lifecycle: "active" as const,
    day,
    title: `${lessonId} lesson`,
    objective: `Learn ${lessonId}.`,
    goals: [`Explain ${lessonId}.`],
    contentPath: `lessons/${lessonId}.md`,
    exerciseTemplatePath: null,
    evaluation: {
      competencies: [{ competencyId: `explain-${lessonId}`, title: "Explain" }],
      requiredEvidence: ["notes"],
      scoringBasis: ["accurate"],
    },
  }
}

function course(
  courseId: string,
  lifecycle: "draft" | "published" = "draft",
  lessons = [lesson("intro")]
): SourceCourse {
  return {
    schemaVersion: 1,
    courseId,
    title: `${courseId} course`,
    description: `${courseId} description`,
    language: { id: courseId === "go-backend" ? "go" : "python", label: courseId === "go-backend" ? "Go" : "Python" },
    lifecycle,
    replacementCourseId: null,
    evaluationPolicyPath: "evaluation/policy.md",
    commandProfilePath: "evaluation/command-profile.json",
    publicResources: [],
    internalResources: [],
    tracks: [
      {
        trackId: "foundations",
        title: "Foundations",
        description: "Foundations",
        stages: [
          {
            stageId: "basics",
            title: "Basics",
            description: "Basics",
            lessons,
          },
        ],
      },
    ],
  }
}

function files(source: SourceCourse): AuthoringFiles {
  const lessonFiles = source.tracks.flatMap((track) =>
    track.stages.flatMap((stage) =>
      stage.lessons.map((entry) => [
        entry.contentPath,
        `# ${entry.title}\n\nSafe lesson.\n`,
      ] as const)
    )
  )
  return Object.fromEntries([
    [source.evaluationPolicyPath, "# Policy\n"],
    [source.commandProfilePath, '{"commands":[]}\n'],
    ...lessonFiles,
  ])
}

function catalog(courses: SourceCourse[]): SourceCatalog {
  return {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: courses.map((entry) => ({
      courseId: entry.courseId,
      title: entry.title,
      language: entry.language,
      lifecycle: entry.lifecycle,
      replacementCourseId: entry.replacementCourseId,
      manifestPath: `courses/${entry.courseId}/course.json`,
    })),
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("course authoring contract", () => {
  it("accepts an explicit draft and refuses duplicate or occupied authoring targets", () => {
    const baseCatalog = catalog([course("go-backend", "published")])
    const draft = course("python-backend")
    const validated = validateDraftCourse({
      catalog: baseCatalog,
      course: draft,
      authoringFiles: files(draft),
    })

    expect(validated.course.lifecycle).toBe("draft")
    expect(validated.catalog.courses.map((entry) => entry.courseId)).toEqual([
      "go-backend",
      "python-backend",
    ])

    expect(() =>
      validateDraftCourse({
        catalog: validated.catalog,
        course: draft,
        authoringFiles: files(draft),
      })
    ).toThrow("already exists")

    const targets = authoringTargets(draft)
    expect(targets).toContain("courses/python-backend/course.json")
    expect(() => assertAuthoringTargetsAvailable(targets, [targets[0]])).toThrow(
      "authoring target already exists"
    )
  })

  it("requires schema-safe lesson additions to a draft and rejects published mutation", () => {
    const current = course("python-backend")
    const next = course("python-backend", "draft", [lesson("intro"), lesson("http", 1)])
    const result = validateDraftLessonAddition({
      currentCourse: current,
      nextCourse: next,
      currentFiles: files(current),
      nextFiles: files(next),
    })
    expect(result.compiled.lessons.map((entry) => entry.lessonId)).toEqual([
      "intro",
      "http",
    ])

    expect(() =>
      validateDraftLessonAddition({
        currentCourse: course("python-backend", "published"),
        nextCourse: next,
        currentFiles: files(course("python-backend", "published")),
        nextFiles: files(next),
      })
    ).toThrow("draft courses")

    expect(() =>
      validateDraftLessonAddition({
        currentCourse: current,
        nextCourse: course("python-backend", "draft", [lesson("intro")]),
        currentFiles: files(current),
        nextFiles: files(current),
      })
    ).toThrow("new lessonId")

    expect(() =>
      validateDraftLessonAddition({
        currentCourse: current,
        nextCourse: course("python-backend", "draft", [lesson("http", 1)]),
        currentFiles: files(current),
        nextFiles: files(course("python-backend", "draft", [lesson("http", 1)])),
      })
    ).toThrow("preserve existing lessons")
  })

  it("publishes only a complete draft transition", () => {
    const draft = course("python-backend")
    const published = course("python-backend", "published")
    const previousCatalog = catalog([course("go-backend", "published"), draft])
    const nextCatalog = catalog([course("go-backend", "published"), published])
    const result = validateCoursePublication({
      previousCatalog,
      nextCatalog,
      previousCourse: draft,
      nextCourse: published,
      authoringFiles: files(published),
    })
    expect(result.compiled.course.lifecycle).toBe("published")

    const incomplete = files(published)
    delete incomplete["lessons/intro.md"]
    expect(() =>
      validateCoursePublication({
        previousCatalog,
        nextCatalog,
        previousCourse: draft,
        nextCourse: published,
        authoringFiles: incomplete,
      })
    ).toThrow("authoringFiles")
  })

  it("keeps draft courses out of the public roadmap projection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-authoring-public-"))
    temporaryDirectories.push(root)
    const published = course("go-backend", "published")
    const draft = course("python-backend")
    const publishedFiles = files(published)
    const compiled = compileCourseContract(published, publishedFiles)
    const outputDirectory = path.join(root, "public")

    await buildMultiCoursePublicArtifacts({
      sourceCatalog: catalog([published, draft]),
      courses: [
        {
          sourceCourse: published,
          authoringFiles: publishedFiles,
          publicLessonFiles: { "lessons/intro.md": publishedFiles["lessons/intro.md"] },
          snapshot: exportReleaseProgressSnapshot(compiled, [], publishedFiles),
        },
        {
          sourceCourse: draft,
          authoringFiles: files(draft),
          publicLessonFiles: { "lessons/intro.md": files(draft)["lessons/intro.md"] },
        },
      ],
      outputDirectory,
    })

    const publicCatalog = JSON.parse(
      await readFile(path.join(outputDirectory, "courses/catalog.json"), "utf8")
    ) as { courses: Array<{ courseId: string }> }
    expect(publicCatalog.courses.map((entry) => entry.courseId)).toEqual([
      "go-backend",
    ])
  })
})
