import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  compileCourseContract,
  deriveCourseProgress,
  exportReleaseProgressSnapshot,
  parseEvaluationRecord,
  parsePublicCatalog,
  parsePublicCourse,
  parsePublicProgress,
  parseReleaseProgressSnapshot,
  parseSourceCatalog,
  parseSourceCourse,
  validateReleaseSnapshotForAuthoring,
  validateReleaseSnapshotForPublicCourse,
  validatePublicReleaseBundle,
  validateSourceCatalogTransition,
  validateSourceCourseTransition,
  type AuthoringFiles,
  type EvaluationRecord,
  type PublicCourse,
  type SourceCatalog,
  type SourceCourse,
} from "./course-contract.ts"
import {
  exportReleaseSnapshotFromWorkspace,
  runProgressExporter,
} from "../export-release-progress.ts"

function sourceCourse(
  overrides: Partial<SourceCourse> = {}
): SourceCourse {
  return {
    schemaVersion: 1,
    courseId: "go-backend",
    title: "Go 后端工程课程",
    description: "从语言基础到可运行服务。",
    language: { id: "go", label: "Go" },
    lifecycle: "published",
    replacementCourseId: null,
    evaluationPolicyPath: "evaluation/policy.md",
    commandProfilePath: "evaluation/command-profile.json",
    publicResources: [
      {
        resourceId: "setup-guide",
        label: "环境准备",
        path: "resources/public/setup.md",
      },
    ],
    internalResources: [
      {
        resourceId: "author-rubric",
        label: "作者评测依据",
        path: "resources/internal/rubric.md",
      },
    ],
    tracks: [
      {
        trackId: "language-and-web",
        title: "语言与 Web",
        description: "建立语言和服务边界。",
        stages: [
          {
            stageId: "language-foundations",
            title: "语言基础",
            description: "先理解值模型。",
            lessons: [
              {
                lessonId: "motivation-and-setup",
                lifecycle: "active",
                day: 0,
                title: "动机与环境",
                objective: "建立学习动机与工具链。",
                goals: ["解释 Go 的工程取舍", "运行基础工具链"],
                contentPath: "lessons/motivation-and-setup.md",
                exerciseTemplatePath:
                  "exercise-templates/motivation-and-setup/main.go",
                evaluation: {
                  competencies: [
                    {
                      competencyId: "explain-tradeoffs",
                      title: "解释工程取舍",
                    },
                  ],
                  requiredEvidence: ["notes", "exercise"],
                  scoringBasis: ["准确", "可验证"],
                },
              },
              {
                lessonId: "values-and-types",
                lifecycle: "active",
                day: 1,
                title: "值与类型",
                objective: "理解 Go 值模型。",
                goals: ["区分值与引用语义"],
                contentPath: "lessons/values-and-types.md",
                exerciseTemplatePath: null,
                evaluation: {
                  competencies: [
                    { competencyId: "reason-about-values", title: "推理值语义" },
                  ],
                  requiredEvidence: ["notes"],
                  scoringBasis: ["边界清晰"],
                },
              },
              {
                lessonId: "retired-pointers",
                lifecycle: "retired",
                day: 2,
                title: "旧指针课",
                objective: "保留历史可读性。",
                goals: ["读取旧内容"],
                contentPath: "lessons/retired-pointers.md",
                exerciseTemplatePath: null,
                evaluation: {
                  competencies: [
                    { competencyId: "read-history", title: "读取历史" },
                  ],
                  requiredEvidence: ["notes"],
                  scoringBasis: ["历史完整"],
                },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

function authoringFiles(): AuthoringFiles {
  return {
    "evaluation/policy.md": "# Policy\n\nAll competencies score 0-4.\n",
    "evaluation/command-profile.json":
      '{"commands":[["go","test","./..."]]}\n',
    "resources/public/setup.md": "# Setup\n",
    "resources/internal/rubric.md": "PRIVATE RUBRIC TOP_SECRET\n",
    "lessons/motivation-and-setup.md": "# Motivation\n\nLearn why.\n",
    "lessons/values-and-types.md": "# Values\n\nLearn values.\n",
    "lessons/retired-pointers.md": "# Retired\n\nHistorical.\n",
    "exercise-templates/motivation-and-setup/main.go":
      "package main\n",
  }
}

function sourceCatalog(
  overrides: Partial<SourceCatalog> = {}
): SourceCatalog {
  return {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: [
      {
        courseId: "go-backend",
        title: "Go 后端工程课程",
        language: { id: "go", label: "Go" },
        lifecycle: "published",
        replacementCourseId: null,
        manifestPath: "courses/go-backend/course.json",
      },
    ],
    ...overrides,
  }
}

function evaluation(
  evaluationRevision: string,
  overrides: Partial<EvaluationRecord> = {}
): EvaluationRecord {
  return {
    schemaVersion: 1,
    courseId: "go-backend",
    lessonId: "motivation-and-setup",
    history: [
      {
        evaluationRevision,
        status: "通过",
        referenceScore: 88,
        competencies: [{ competencyId: "explain-tradeoffs", score: 4 }],
      },
    ],
    ...overrides,
  }
}

function publicCourse(compiled = compileCourseContract(sourceCourse(), authoringFiles())): PublicCourse {
  return {
    schemaVersion: 1,
    courseId: compiled.course.courseId,
    courseRevision: compiled.courseRevision,
    title: compiled.course.title,
    description: compiled.course.description,
    language: compiled.course.language,
    lifecycle: "published",
    replacementCourseId: null,
    tracks: compiled.course.tracks.map((track) => ({
      trackId: track.trackId,
      title: track.title,
      description: track.description,
      stages: track.stages.map((stage) => ({
        stageId: stage.stageId,
        title: stage.title,
        description: stage.description,
        lessons: stage.lessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          lifecycle: lesson.lifecycle,
          day: lesson.day,
          title: lesson.title,
          objective: lesson.objective,
          goals: lesson.goals,
          contentRevision: compiled.lessons.find(
            (candidate) => candidate.lessonId === lesson.lessonId
          )!.contentRevision,
          lessonHref: `/courses/go-backend/lessons/${lesson.lessonId}.md`,
        })),
      })),
    })),
  }
}

function revisePublicCourse(
  course: PublicCourse,
  overrides: Partial<PublicCourse>
): PublicCourse {
  return { ...course, ...overrides }
}

function publicLessonFiles(course: PublicCourse): Record<string, string> {
  const files = authoringFiles()
  return Object.fromEntries(
    course.tracks.flatMap((track) =>
      track.stages.flatMap((stage) =>
        stage.lessons.map((lesson) => [
          lesson.lessonHref,
          files[`lessons/${lesson.lessonId}.md`],
        ])
      )
    )
  )
}

describe("multi-course domain contracts", () => {
  it("uses independent v1 exact-key parsers for every source and public contract", () => {
    const compiled = compileCourseContract(sourceCourse(), authoringFiles())
    const course = publicCourse(compiled)
    const snapshot = exportReleaseProgressSnapshot(compiled, [], authoringFiles())
    const publicProgress = {
      schemaVersion: 1,
      courseId: "go-backend",
      courseRevision: compiled.courseRevision,
      lessons: snapshot.lessons,
    }
    const catalog = {
      schemaVersion: 1,
      defaultCourseId: "go-backend",
      courses: [
        {
          courseId: "go-backend",
          courseRevision: compiled.courseRevision,
          title: "Go 后端工程课程",
          description: "从语言基础到可运行服务。",
          language: { id: "go", label: "Go" },
          lifecycle: "published",
          replacementCourseId: null,
          pageHref: "/courses/go-backend",
          courseHref: "/courses/go-backend/course.json",
          progressHref: "/courses/go-backend/progress.json",
        },
      ],
    }

    expect(parseSourceCatalog(sourceCatalog())).toEqual(sourceCatalog())
    expect(parseSourceCourse(sourceCourse())).toEqual(sourceCourse())
    expect(parsePublicCatalog(catalog)).toEqual(catalog)
    expect(parsePublicCourse(course)).toEqual(course)
    expect(parsePublicProgress(publicProgress)).toEqual(publicProgress)
    expect(parseReleaseProgressSnapshot(snapshot)).toEqual(snapshot)

    for (const [name, parser, value] of [
      ["source catalog", parseSourceCatalog, sourceCatalog()],
      ["source course", parseSourceCourse, sourceCourse()],
      ["public catalog", parsePublicCatalog, catalog],
      ["public course", parsePublicCourse, course],
      ["public progress", parsePublicProgress, publicProgress],
      ["release snapshot", parseReleaseProgressSnapshot, snapshot],
    ] as const) {
      expect(() => parser({ ...value, unexpected: name })).toThrow(
        "非白名单字段"
      )
      expect(() => parser({ ...value, schemaVersion: 2 })).toThrow(
        "schemaVersion"
      )
      const missing = structuredClone(value) as unknown as Record<string, unknown>
      delete missing[Object.keys(missing).find((key) => key !== "schemaVersion")!]
      expect(() => parser(missing)).toThrow("缺失或非白名单字段")
    }
  })

  it("enforces catalog identity, a published default, same-language acyclic replacements", () => {
    const retired = {
      courseId: "go-foundations",
      title: "Go 基础旧课",
      language: { id: "go", label: "Go" },
      lifecycle: "retired" as const,
      replacementCourseId: "go-backend",
      manifestPath: "courses/go-foundations/course.json",
    }
    expect(
      parseSourceCatalog({
        ...sourceCatalog(),
        courses: [sourceCatalog().courses[0], retired],
      }).courses.map((course) => course.courseId)
    ).toEqual(["go-backend", "go-foundations"])

    expect(() =>
      parseSourceCatalog({
        ...sourceCatalog(),
        courses: [
          { ...sourceCatalog().courses[0], lifecycle: "draft" },
        ],
      })
    ).toThrow("Default Course 必须 Published")
    expect(() =>
      parseSourceCatalog({
        ...sourceCatalog(),
        defaultCourseId: "go-main",
        courses: [
          {
            ...sourceCatalog().courses[0],
            courseId: "go-main",
            manifestPath: "courses/go-main/course.json",
          },
          {
            ...sourceCatalog().courses[0],
            lifecycle: "retired",
            replacementCourseId: "go-foundations",
          },
          { ...retired, replacementCourseId: "go-backend" },
        ],
      })
    ).toThrow("Replacement Course 必须 Published")
    expect(() =>
      parseSourceCatalog({
        ...sourceCatalog(),
        courses: [
          sourceCatalog().courses[0],
          {
            ...retired,
            language: { id: "rust", label: "Rust" },
          },
        ],
      })
    ).toThrow("同一 Language")
    expect(() =>
      parseSourceCatalog({
        ...sourceCatalog(),
        courses: [
          sourceCatalog().courses[0],
          { ...retired, language: { id: "go", label: "Golang" } },
        ],
      })
    ).toThrow("稳定 label")
    expect(() =>
      parseSourceCatalog({
        ...sourceCatalog(),
        courses: [
          sourceCatalog().courses[0],
          {
            ...sourceCatalog().courses[0],
            lifecycle: "draft",
            courseId: "go-next",
            manifestPath: "courses/go-next/course.json",
          },
          { ...retired, replacementCourseId: "go-next" },
        ],
      })
    ).toThrow("Replacement Course 必须 Published")
  })

  it("allows only monotonic Course lifecycle transitions and preserves durable IDs", () => {
    const published = sourceCatalog()
    const retired = {
      ...published,
      defaultCourseId: "go-next",
      courses: [
        {
          ...published.courses[0],
          lifecycle: "retired" as const,
          replacementCourseId: "go-next",
        },
        {
          ...published.courses[0],
          courseId: "go-next",
          manifestPath: "courses/go-next/course.json",
        },
      ],
    }
    expect(validateSourceCatalogTransition(published, retired)).toEqual(retired)
    expect(() => validateSourceCatalogTransition(retired, published)).toThrow(
      "单向推进"
    )
    const withHistorical = {
      ...published,
      courses: [
        published.courses[0],
        {
          ...published.courses[0],
          courseId: "go-old",
          lifecycle: "retired" as const,
          replacementCourseId: "go-backend",
          manifestPath: "courses/go-old/course.json",
        },
      ],
    }
    expect(() =>
      validateSourceCatalogTransition(withHistorical, published)
    ).toThrow("永久保留")
    expect(() =>
      validateSourceCatalogTransition(published, {
        ...published,
        courses: [{ ...published.courses[0], lifecycle: "draft" }],
      })
    ).toThrow("Default Course 必须 Published")
    expect(() =>
      validateSourceCatalogTransition(published, {
        ...published,
        courses: [
          {
            ...published.courses[0],
            language: { id: "rust", label: "Rust" },
          },
        ],
      })
    ).toThrow("不可重绑")
  })

  it("keeps Retired Course readable while excluding Draft from public contracts", () => {
    const course = publicCourse()
    expect(
      parsePublicCourse(revisePublicCourse(course, {
        lifecycle: "retired",
        replacementCourseId: "go-successor",
      })).lifecycle
    ).toBe("retired")
    expect(() =>
      parsePublicCourse({ ...course, lifecycle: "draft" })
    ).toThrow("Published 或 Retired")
    expect(() =>
      exportReleaseProgressSnapshot(
        compileCourseContract(
          sourceCourse({ lifecycle: "draft" }),
          authoringFiles()
        ),
        [],
        authoringFiles()
      )
    ).toThrow("Draft Course")
  })

  it("freezes published child IDs and keeps Retired Lesson terminal", () => {
    const previous = sourceCourse()
    const reordered = structuredClone(previous)
    reordered.tracks[0].stages[0].lessons.reverse()
    expect(validateSourceCourseTransition(previous, reordered)).toEqual(reordered)

    const removed = structuredClone(previous)
    removed.tracks[0].stages[0].lessons.splice(1, 1)
    expect(() => validateSourceCourseTransition(previous, removed)).toThrow(
      "Published Lesson ID 必须永久保留"
    )
    const revived = structuredClone(previous)
    revived.tracks[0].stages[0].lessons[2].lifecycle = "active"
    expect(() => validateSourceCourseTransition(previous, revived)).toThrow(
      "Retired Lesson 是终态"
    )
    const draft = sourceCourse({ lifecycle: "draft" })
    const rewrittenDraft = sourceCourse({
      lifecycle: "draft",
      tracks: [sourceCourse().tracks[0]],
    })
    expect(validateSourceCourseTransition(draft, rewrittenDraft)).toEqual(
      rewrittenDraft
    )
  })

  it("keeps IDs course-local, preserves order, permits absent Day, and rejects path identity", () => {
    const noDayCourse = sourceCourse({
      courseId: "systems-thinking",
      language: { id: "language-agnostic", label: "Language Agnostic" },
      tracks: [
        {
          trackId: "foundations",
          title: "Foundations",
          description: "No Day curriculum.",
          stages: [
            {
              stageId: "models",
              title: "Models",
              description: "Stable models.",
              lessons: [
                {
                  ...sourceCourse().tracks[0].stages[0].lessons[0],
                  lessonId: "boundaries",
                  day: null,
                  contentPath: "lessons/boundaries.md",
                  exerciseTemplatePath: null,
                },
              ],
            },
          ],
        },
      ],
    })
    expect(parseSourceCourse(noDayCourse).tracks[0].stages[0].lessons[0].day).toBeNull()

    const duplicated = structuredClone(sourceCourse())
    duplicated.tracks[0].stages[0].lessons[1].lessonId =
      duplicated.tracks[0].stages[0].lessons[0].lessonId
    duplicated.tracks[0].stages[0].lessons[1].contentPath =
      duplicated.tracks[0].stages[0].lessons[0].contentPath
    expect(() => parseSourceCourse(duplicated)).toThrow("重复 lessonId")

    const duplicateDay = structuredClone(sourceCourse())
    duplicateDay.tracks[0].stages[0].lessons[1].day = 0
    expect(() => parseSourceCourse(duplicateDay)).toThrow("重复 Day")

    const malicious = structuredClone(sourceCourse())
    malicious.tracks[0].stages[0].lessons[0].contentPath =
      "../../private/answer.md"
    expect(() => parseSourceCourse(malicious)).toThrow("安全相对 POSIX 路径")
  })

  it("derives stable learning identity only from courseId and lessonId", () => {
    const compiled = compileCourseContract(sourceCourse(), authoringFiles())
    const lesson = compiled.lessons[0]
    const record = evaluation(lesson.evaluationRevision)
    const before = structuredClone(record)
    const result = deriveCourseProgress(compiled, [record])

    expect(result.progress.lessons[0]).toMatchObject({
      lessonId: "motivation-and-setup",
      status: "通过",
    })
    expect(record).toEqual(before)
    expect(() =>
      parseEvaluationRecord({ ...record, lessonId: "day-0" })
    ).not.toThrow()
    expect(() => deriveCourseProgress(compiled, [{ ...record, lessonId: "day-0" }])).toThrow(
      "未知 Lesson"
    )

    const movedSource = structuredClone(sourceCourse())
    const lessons = movedSource.tracks[0].stages[0].lessons
    lessons[0].title = "标题可以变化"
    lessons.reverse()
    const moved = compileCourseContract(movedSource, authoringFiles())
    expect(
      deriveCourseProgress(moved, [record]).progress.lessons.find(
        (candidate) => candidate.lessonId === record.lessonId
      )
    ).toMatchObject({ status: "通过" })
  })

  it("treats Passed as terminal for the same evaluation revision", () => {
    const compiled = compileCourseContract(sourceCourse(), authoringFiles())
    const record = evaluation(compiled.lessons[0].evaluationRevision)
    expect(() =>
      parseEvaluationRecord({
        ...record,
        history: [
          ...record.history,
          { ...record.history[0], status: "重新学习", referenceScore: 60 },
        ],
      })
    ).toThrow("一旦通过便不可回退")
    expect(() =>
      parseEvaluationRecord({
        ...record,
        history: [
          ...record.history,
          {
            ...record.history[0],
            evaluationRevision: `sha256:${"7".repeat(64)}`,
            status: "重新学习",
            referenceScore: 60,
          },
        ],
      })
    ).not.toThrow()
  })

  it("separates content, evaluation, and course revisions deterministically", () => {
    const base = compileCourseContract(sourceCourse(), authoringFiles())
    const formattingFiles = authoringFiles()
    formattingFiles["lessons/motivation-and-setup.md"] += "\n"
    const formatting = compileCourseContract(sourceCourse(), formattingFiles)
    const policyFiles = authoringFiles()
    policyFiles["evaluation/policy.md"] += "Evidence rules changed.\n"
    const policy = compileCourseContract(sourceCourse(), policyFiles)
    const templateFiles = authoringFiles()
    templateFiles[
      "exercise-templates/motivation-and-setup/main.go"
    ] += "// contract changed\n"
    const template = compileCourseContract(sourceCourse(), templateFiles)
    const commandFiles = authoringFiles()
    commandFiles["evaluation/command-profile.json"] =
      '{"commands":[["go","test","-race","./..."]]}\n'
    const command = compileCourseContract(sourceCourse(), commandFiles)

    expect(base.courseRevision).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(formatting.lessons[0].contentRevision).not.toBe(
      base.lessons[0].contentRevision
    )
    expect(formatting.lessons[0].evaluationRevision).toBe(
      base.lessons[0].evaluationRevision
    )
    expect(formatting.courseRevision).not.toBe(base.courseRevision)
    expect(policy.lessons[0].contentRevision).toBe(
      base.lessons[0].contentRevision
    )
    expect(policy.lessons[0].evaluationRevision).not.toBe(
      base.lessons[0].evaluationRevision
    )
    expect(policy.courseRevision).not.toBe(base.courseRevision)
    expect(template.lessons[0].evaluationRevision).not.toBe(
      base.lessons[0].evaluationRevision
    )
    expect(command.lessons[0].evaluationRevision).not.toBe(
      base.lessons[0].evaluationRevision
    )
    expect(compileCourseContract(sourceCourse(), authoringFiles())).toEqual(base)
  })

  it("derives current progress from the latest matching Evaluation and excludes retired lessons from summary", () => {
    const compiled = compileCourseContract(sourceCourse(), authoringFiles())
    const current = compiled.lessons[0]
    const oldRevision = `sha256:${"0".repeat(64)}`
    const oldRecord = evaluation(oldRevision)
    const oldResult = deriveCourseProgress(compiled, [oldRecord])
    expect(oldResult.progress.lessons[0]).toEqual({
      lessonId: "motivation-and-setup",
      status: "未开始",
      referenceScore: null,
    })

    const currentResult = deriveCourseProgress(compiled, [
      evaluation(current.evaluationRevision),
      evaluation(compiled.lessons[2].evaluationRevision, {
        lessonId: "retired-pointers",
      }),
    ])
    expect(currentResult.summary).toEqual({ activeLessons: 2, passed: 1 })
    expect(currentResult.recommendedLessonId).toBe("values-and-types")
    expect(currentResult.progress.lessons).toHaveLength(3)
  })

  it("exports only a deterministic safe snapshot and rejects private or forged fields", () => {
    const files = authoringFiles()
    const compiled = compileCourseContract(sourceCourse(), files)
    const record = evaluation(compiled.lessons[0].evaluationRevision)
    const snapshot = exportReleaseProgressSnapshot(compiled, [record], files)
    const serialized = JSON.stringify(snapshot)

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      courseId: "go-backend",
      courseRevision: compiled.courseRevision,
    })
    expect(snapshot.privateInputDigest).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(serialized).not.toContain("TOP_SECRET")
    expect(serialized).not.toMatch(/notes|evidence|attempt|answer|path|time/i)
    expect(() =>
      parseEvaluationRecord({ ...record, answer: "private" })
    ).toThrow("非白名单字段")

    expect(
      exportReleaseProgressSnapshot(compiled, [record], files)
    ).toEqual(snapshot)
    expect(() =>
      validateReleaseSnapshotForAuthoring(
        { ...snapshot, privateInputDigest: `sha256:${"f".repeat(64)}` },
        compiled,
        [record],
        files
      )
    ).toThrow("私有输入摘要")
  })

  it("rejects missing, extra, reordered, stale, and manually rebound snapshot lessons", () => {
    const files = authoringFiles()
    const compiled = compileCourseContract(sourceCourse(), files)
    const snapshot = exportReleaseProgressSnapshot(compiled, [], files)
    const course = publicCourse(compiled)

    expect(() =>
      validateReleaseSnapshotForPublicCourse(
        { ...snapshot, courseRevision: `sha256:${"1".repeat(64)}` },
        course
      )
    ).toThrow("courseRevision")
    expect(() =>
      validateReleaseSnapshotForPublicCourse(
        { ...snapshot, lessons: snapshot.lessons.slice(1) },
        course
      )
    ).toThrow("Lesson 集合与顺序")
    expect(() =>
      validateReleaseSnapshotForPublicCourse(
        { ...snapshot, lessons: [...snapshot.lessons].reverse() },
        course
      )
    ).toThrow("Lesson 集合与顺序")
    expect(() =>
      validateReleaseSnapshotForPublicCourse(
        {
          ...snapshot,
          lessons: [
            ...snapshot.lessons,
            { lessonId: "extra", status: "未开始", referenceScore: null },
          ],
        },
        course
      )
    ).toThrow("Lesson 集合与顺序")
  })

  it("pairs Public Catalog, Course content digest, and Release Snapshot in public CI", () => {
    const compiled = compileCourseContract(sourceCourse(), authoringFiles())
    const course = publicCourse(compiled)
    const snapshot = exportReleaseProgressSnapshot(compiled, [], authoringFiles())
    const catalog = {
      schemaVersion: 1,
      defaultCourseId: course.courseId,
      courses: [
        {
          courseId: course.courseId,
          courseRevision: course.courseRevision,
          title: course.title,
          description: course.description,
          language: course.language,
          lifecycle: course.lifecycle,
          replacementCourseId: course.replacementCourseId,
          pageHref: `/courses/${course.courseId}`,
          courseHref: `/courses/${course.courseId}/course.json`,
          progressHref: `/courses/${course.courseId}/progress.json`,
        },
      ],
    }
    const files = publicLessonFiles(course)
    expect(
      validatePublicReleaseBundle({
        catalog,
        course,
        snapshot,
        publicLessonFiles: files,
      }).course
    ).toEqual(course)
    expect(() =>
      validatePublicReleaseBundle({
        catalog,
        course,
        snapshot,
        publicLessonFiles: {
          ...files,
          [course.tracks[0].stages[0].lessons[0].lessonHref]: "被篡改的正文",
        },
      })
    ).toThrow("内容摘要不一致")
    expect(() =>
      validatePublicReleaseBundle({
        catalog: {
          ...catalog,
          courses: [
            {
              ...catalog.courses[0],
              title: "被篡改的标题",
            },
          ],
        },
        course,
        snapshot,
        publicLessonFiles: files,
      })
    ).toThrow("声明不一致")
  })

  it("exports from explicit local authoring inputs without reading Notes or answers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "course-authoring-"))
    try {
      const courseDirectory = path.join(root, "courses/go-backend")
      const courseFile = path.join(courseDirectory, "course.json")
      const recordsDirectory = path.join(root, "learning-records/go-backend")
      await mkdir(courseDirectory, { recursive: true })
      await writeFile(courseFile, JSON.stringify(sourceCourse()))
      for (const [relative, content] of Object.entries(authoringFiles())) {
        const absolute = path.join(courseDirectory, relative)
        await mkdir(path.dirname(absolute), { recursive: true })
        await writeFile(absolute, content)
      }
      const compiled = compileCourseContract(sourceCourse(), authoringFiles())
      const lessonDirectory = path.join(
        recordsDirectory,
        "lessons/motivation-and-setup"
      )
      await mkdir(path.join(lessonDirectory, "workspace"), { recursive: true })
      await writeFile(
        path.join(lessonDirectory, "evaluation.json"),
        JSON.stringify(evaluation(compiled.lessons[0].evaluationRevision))
      )
      await writeFile(
        path.join(lessonDirectory, "notes.md"),
        "ANSWER_SECRET_FROM_NOTES\n"
      )
      await writeFile(
        path.join(lessonDirectory, "workspace/answer.go"),
        "ANSWER_SECRET_FROM_EXERCISE\n"
      )

      const outputDirectory = path.join(root, "release-progress")
      await mkdir(outputDirectory)
      const output = path.join(outputDirectory, "go-backend.json")
      const first = await exportReleaseSnapshotFromWorkspace({
        courseFile,
        learningRecordsDirectory: recordsDirectory,
        outputFile: output,
      })
      const serialized = await readFile(output, "utf8")
      expect(JSON.parse(serialized)).toEqual(first)
      expect(serialized).not.toContain("ANSWER_SECRET")

      await writeFile(
        path.join(lessonDirectory, "notes.md"),
        "CHANGED_PRIVATE_ANSWER\n"
      )
      const summary = await runProgressExporter([
        "--course",
        courseFile,
        "--learning-records",
        recordsDirectory,
        "--output",
        output,
      ])
      expect(summary).toMatchObject({
        command: "export-progress",
        courseId: "go-backend",
        lessonCount: 3,
      })
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(first)

      const manifestBefore = await readFile(courseFile, "utf8")
      await expect(
        exportReleaseSnapshotFromWorkspace({
          courseFile,
          learningRecordsDirectory: recordsDirectory,
          outputFile: courseFile,
        })
      ).rejects.toThrow("输出必须为 release-progress/go-backend.json")
      await expect(readFile(courseFile, "utf8")).resolves.toBe(manifestBefore)

      await mkdir(path.join(recordsDirectory, "lessons/unknown-lesson"), {
        recursive: true,
      })
      await expect(
        exportReleaseSnapshotFromWorkspace({
          courseFile,
          learningRecordsDirectory: recordsDirectory,
          outputFile: output,
        })
      ).rejects.toThrow("未知 Lesson")
      await rm(path.join(recordsDirectory, "lessons/unknown-lesson"), {
        recursive: true,
      })

      const lessonPath = path.join(
        courseDirectory,
        "lessons/motivation-and-setup.md"
      )
      const outside = path.join(root, "outside.md")
      await writeFile(outside, "# Outside\n")
      await rm(lessonPath)
      await symlink(outside, lessonPath)
      await expect(
        exportReleaseSnapshotFromWorkspace({
          courseFile,
          learningRecordsDirectory: recordsDirectory,
          outputFile: output,
        })
      ).rejects.toThrow("symlink")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
