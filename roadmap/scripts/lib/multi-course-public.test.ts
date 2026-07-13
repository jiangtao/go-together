import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
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
import {
  buildMultiCoursePublicArtifacts,
  recoverInterruptedPublicSwap,
} from "./multi-course-public.ts"

const temporaryDirectories: string[] = []

function sourceCourse(
  courseId: string,
  lifecycle: "draft" | "published" | "retired" = "published"
): SourceCourse {
  return {
    schemaVersion: 1,
    courseId,
    title: `${courseId} Course`,
    description: `${courseId} description`,
    language: { id: courseId.startsWith("go") ? "go" : "python", label: courseId.startsWith("go") ? "Go" : "Python" },
    lifecycle,
    replacementCourseId: null,
    evaluationPolicyPath: "evaluation/policy.md",
    commandProfilePath: "evaluation/command-profile.json",
    publicResources: [
      {
        resourceId: "setup",
        label: "Setup",
        path: "resources/public/setup.md",
      },
    ],
    internalResources: [
      {
        resourceId: "rubric",
        label: "Private rubric",
        path: "resources/internal/rubric.md",
      },
    ],
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
                day: null,
                title: "First lesson",
                objective: "Learn the first concept.",
                goals: ["Explain the concept"],
                contentPath: "lessons/first-lesson.md",
                exerciseTemplatePath: null,
                evaluation: {
                  competencies: [
                    { competencyId: "explain-concept", title: "Explain concept" },
                  ],
                  requiredEvidence: ["notes"],
                  scoringBasis: ["accurate"],
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

function authoringFiles(): AuthoringFiles {
  return {
    "evaluation/policy.md": "Private policy\n",
    "evaluation/command-profile.json": '{"commands":[]}\n',
    "resources/public/setup.md": "# Public setup\n",
    "resources/internal/rubric.md": "PRIVATE_RUBRIC_SECRET\n",
    "lessons/first-lesson.md": "# First lesson\n\nSafe content.\n",
  }
}

function catalog(courses: SourceCourse[]): SourceCatalog {
  return {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: courses.map((course) => ({
      courseId: course.courseId,
      title: course.title,
      language: course.language,
      lifecycle: course.lifecycle,
      replacementCourseId: course.replacementCourseId,
      manifestPath: `courses/${course.courseId}/course.json`,
    })),
  }
}

function projection(course: SourceCourse) {
  const files = authoringFiles()
  const compiled = compileCourseContract(course, files)
  return {
    sourceCourse: course,
    authoringFiles: files,
    snapshot:
      course.lifecycle === "draft"
        ? undefined
        : exportReleaseProgressSnapshot(compiled, [], files),
  }
}

async function fileList(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return fileList(root, absolute)
      return [path.relative(root, absolute).split(path.sep).join("/")]
    })
  )
  return nested.flat().sort()
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("Catalog-driven public projection", () => {
  it("publishes only Published/Retired courses with exact v1 data and safe resources", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "multi-course-public-"))
    temporaryDirectories.push(root)
    const outputDirectory = path.join(root, "public")
    const published = sourceCourse("go-backend")
    const draft = sourceCourse("python-backend", "draft")

    await buildMultiCoursePublicArtifacts({
      sourceCatalog: catalog([published, draft]),
      courses: [projection(published), projection(draft)],
      outputDirectory,
    })

    const publicCatalog = JSON.parse(
      await readFile(path.join(outputDirectory, "courses/catalog.json"), "utf8")
    ) as { courses: Array<{ courseId: string }> }
    expect(publicCatalog.courses.map((course) => course.courseId)).toEqual([
      "go-backend",
    ])
    expect(await fileList(outputDirectory)).toEqual([
      "courses/catalog.json",
      "courses/go-backend/course.json",
      "courses/go-backend/progress.json",
      "courses/go-backend/sources/lessons/first-lesson.md",
      "courses/go-backend/sources/resources/setup.md",
    ])
    await expect(
      readFile(
        path.join(
          outputDirectory,
          "courses/go-backend/sources/lessons/first-lesson.md"
        ),
        "utf8"
      )
    ).resolves.toBe(authoringFiles()["lessons/first-lesson.md"])
    expect(JSON.stringify(await fileList(outputDirectory))).not.toContain(
      "internal"
    )
    expect(
      await readFile(
        path.join(outputDirectory, "courses/go-backend/course.json"),
        "utf8"
      )
    ).not.toContain("PRIVATE_RUBRIC_SECRET")
  })

  it("requires exact Catalog membership and a current Snapshot", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "multi-course-public-"))
    temporaryDirectories.push(root)
    const outputDirectory = path.join(root, "public")
    const course = sourceCourse("go-backend")
    const valid = projection(course)

    await expect(
      buildMultiCoursePublicArtifacts({
        sourceCatalog: catalog([course]),
        courses: [],
        outputDirectory,
      })
    ).rejects.toThrow("一一对应")
    await expect(
      buildMultiCoursePublicArtifacts({
        sourceCatalog: catalog([course]),
        courses: [{ ...valid, snapshot: undefined }],
        outputDirectory,
      })
    ).rejects.toThrow("Release Progress Snapshot")
    await expect(
      buildMultiCoursePublicArtifacts({
        sourceCatalog: catalog([course]),
        courses: [
          {
            ...valid,
            snapshot: {
              ...valid.snapshot!,
              courseRevision: `sha256:${"0".repeat(64)}`,
            },
          },
        ],
        outputDirectory,
      })
    ).rejects.toThrow("courseRevision")
  })

  it("rejects unsafe public bytes and preserves the last successful output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "multi-course-public-"))
    temporaryDirectories.push(root)
    const outputDirectory = path.join(root, "public")
    await mkdir(outputDirectory)
    await writeFile(path.join(outputDirectory, "sentinel.txt"), "last-good")
    const course = sourceCourse("go-backend")
    for (const content of [
      "# Unsafe\n\n[jump](javascript:alert(1))\n",
      "# Unsafe\n\n[jump](http://example.com/file)\n",
      "# Unsafe\n\nVisit http://example.com now.\n",
      "# Unsafe\n\n<HTTP://example.com>\n",
      "# Unsafe\n\nVisit www.example.com now.\n",
      "# Unsafe\n\n[jump](http&#58;//example.com/file)\n",
      "# Unsafe\n\n[jump](javascript&#58;alert(1))\n",
      "# Unsafe\n\n[jump](..&#47;private.md)\n",
      "# Unsafe\n\n[jump](./%2e%2e/secret.md)\n",
      "# Unsafe\n\n[jump](./%252e%252e/secret.md)\n",
      "# Unsafe\n\n<a href=\"https://example.com\">raw</a>\n",
    ]) {
      const unsafe = projection(course)
      unsafe.authoringFiles["lessons/first-lesson.md"] = content
      const unsafeCompiled = compileCourseContract(
        course,
        unsafe.authoringFiles
      )
      unsafe.snapshot = exportReleaseProgressSnapshot(
        unsafeCompiled,
        [],
        unsafe.authoringFiles
      )
      await expect(
        buildMultiCoursePublicArtifacts({
          sourceCatalog: catalog([course]),
          courses: [unsafe],
          outputDirectory,
        })
      ).rejects.toThrow(/危险|HTTPS|编码|HTML|越界/)
    }
    const disguisedBinaryCourse = sourceCourse("go-backend")
    disguisedBinaryCourse.publicResources[0].path =
      "resources/public/diagram.png"
    const disguisedFiles = authoringFiles()
    delete disguisedFiles["resources/public/setup.md"]
    disguisedFiles["resources/public/diagram.png"] = "not-a-real-png"
    const disguisedCompiled = compileCourseContract(
      disguisedBinaryCourse,
      disguisedFiles
    )
    await expect(
      buildMultiCoursePublicArtifacts({
        sourceCatalog: catalog([disguisedBinaryCourse]),
        courses: [
          {
            sourceCourse: disguisedBinaryCourse,
            authoringFiles: disguisedFiles,
            snapshot: exportReleaseProgressSnapshot(
              disguisedCompiled,
              [],
              disguisedFiles
            ),
          },
        ],
        outputDirectory,
      })
    ).rejects.toThrow("文本白名单")
    await expect(
      readFile(path.join(outputDirectory, "sentinel.txt"), "utf8")
    ).resolves.toBe("last-good")
  })

  it("recovers both interrupted swap states without losing the last complete directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "multi-course-recover-"))
    temporaryDirectories.push(root)
    const output = path.join(root, "public")
    const backup = `${output}.previous`
    await mkdir(backup)
    await writeFile(path.join(backup, "sentinel.txt"), "last-good")

    await recoverInterruptedPublicSwap(output)
    await expect(readFile(path.join(output, "sentinel.txt"), "utf8")).resolves.toBe(
      "last-good"
    )

    await mkdir(backup)
    await writeFile(path.join(backup, "sentinel.txt"), "older")
    await recoverInterruptedPublicSwap(output)
    await expect(readFile(path.join(output, "sentinel.txt"), "utf8")).resolves.toBe(
      "last-good"
    )
    await expect(readFile(path.join(backup, "sentinel.txt"), "utf8")).rejects.toThrow()
  })
})
