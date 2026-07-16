import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  compileCourseContract,
  type AuthoringFiles,
  type SourceCourse,
} from "./course-contract.ts"

const STAGES = [
  ["language-foundations", "stage-1", 0, 6],
  ["http-and-data-entry", "stage-2", 7, 12],
  ["data-boundaries-and-contracts", "stage-3", 13, 18],
  ["grpc-service-chain", "stage-4", 19, 22],
  ["concurrency-and-operability", "stage-5", 23, 28],
  ["agent-slice-and-review", "stage-6", 29, 36],
] as const

const TRACKS = [
  ["language-and-web", [0, 1]],
  ["data-and-service-contracts", [2, 3]],
  ["runtime-and-agent", [4, 5]],
] as const

export async function createPublicCourseFixture(
  repositoryRoot: string,
  options: { dayZeroPassed?: boolean } = {}
): Promise<{
  outputDirectory: string
  sourceCourse: SourceCourse
}> {
  const courseDirectory = path.join(repositoryRoot, "courses/go-backend")
  const outputDirectory = path.join(repositoryRoot, "public")
  const authoringFiles: AuthoringFiles = {
    "evaluation/policy.md": "# Test policy\n",
    "evaluation/command-profile.json":
      '{"schemaVersion":1,"profileId":"test","environment":{},"commands":[]}\n',
  }
  for (let day = 0; day <= 36; day += 1) {
    const lessonId = `lesson-${String(day).padStart(2, "0")}`
    authoringFiles[`lessons/${lessonId}.md`] =
      `# Day ${String(day).padStart(2, "0")}：课程 ${day}\n\n` +
      `### 学习目标\n\n- 完成目标 ${day}\n`
  }
  const sourceCourse: SourceCourse = {
    schemaVersion: 1,
    courseId: "go-backend",
    title: "Go Test Course",
    description: "A canonical Go fixture.",
    language: { id: "go", label: "Go" },
    lifecycle: "published",
    replacementCourseId: null,
    evaluationPolicyPath: "evaluation/policy.md",
    commandProfilePath: "evaluation/command-profile.json",
    publicResources: [],
    internalResources: [],
    tracks: TRACKS.map(([trackId, stageIndexes]) => ({
      trackId,
      title: trackId,
      description: `${trackId} description`,
      stages: stageIndexes.map((stageIndex) => {
        const [stageId, , startDay, endDay] = STAGES[stageIndex]
        return {
          stageId,
          title: stageId,
          description: `${stageId} description`,
          lessons: Array.from(
            { length: endDay - startDay + 1 },
            (_, offset) => {
              const day = startDay + offset
              const lessonId = `lesson-${String(day).padStart(2, "0")}`
              return {
                lessonId,
                lifecycle: "active" as const,
                day,
                title: `课程 ${day}`,
                objective: `完成目标 ${day}`,
                goals: [`完成目标 ${day}`],
                contentPath: `lessons/${lessonId}.md`,
                exerciseTemplatePath: null,
                evaluation: {
                  competencies: [
                    { competencyId: "lesson-requirements", title: "完成要求" },
                  ],
                  requiredEvidence: ["notes"],
                  scoringBasis: ["准确"],
                },
              }
            }
          ),
        }
      }),
    })),
  }
  const compiled = compileCourseContract(sourceCourse, authoringFiles)
  const catalog = {
    schemaVersion: 1,
    defaultCourseId: "go-backend",
    courses: [
      {
        courseId: "go-backend",
        title: sourceCourse.title,
        language: sourceCourse.language,
        lifecycle: sourceCourse.lifecycle,
        replacementCourseId: null,
        manifestPath: "courses/go-backend/course.json",
      },
    ],
  }
  const compatibility = {
    schemaVersion: 1,
    courseId: "go-backend",
    legacyTitle: sourceCourse.title,
    dayRange: { start: 0, end: 36 },
    stages: STAGES.map(([canonicalStageId, stageId]) => ({
      stageId,
      canonicalStageId,
      title: stageId,
      description: `${stageId} description`,
    })),
    lessons: Array.from({ length: 37 }, (_, day) => ({
      lessonId: `lesson-${String(day).padStart(2, "0")}`,
      legacyId: `day-${String(day).padStart(2, "0")}`,
      legacyHref: `/sources/lessons/day-${String(day).padStart(2, "0")}-lesson-${String(day).padStart(2, "0")}.md`,
      englishTitle: `Day ${String(day).padStart(2, "0")}: Lesson ${day}`,
    })),
  }
  const snapshot = {
    schemaVersion: 1,
    courseId: "go-backend",
    courseRevision: compiled.courseRevision,
    privateInputDigest: `sha256:${"2".repeat(64)}`,
    lessons: compiled.lessons.map(({ lessonId }, index) => ({
      lessonId,
      status: index === 0 && options.dayZeroPassed ? "通过" : "未开始",
      referenceScore: index === 0 && options.dayZeroPassed ? 92 : null,
    })),
  }

  await mkdir(courseDirectory, { recursive: true })
  await mkdir(path.join(repositoryRoot, "release-progress"), { recursive: true })
  await Promise.all(
    Object.entries(authoringFiles).map(async ([relative, content]) => {
      const target = path.join(courseDirectory, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    })
  )
  await writeFile(
    path.join(repositoryRoot, "courses/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`
  )
  await writeFile(
    path.join(courseDirectory, "course.json"),
    `${JSON.stringify(sourceCourse, null, 2)}\n`
  )
  await writeFile(
    path.join(courseDirectory, "compatibility.json"),
    `${JSON.stringify(compatibility, null, 2)}\n`
  )
  await writeFile(
    path.join(repositoryRoot, "release-progress/go-backend.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`
  )
  return { outputDirectory, sourceCourse }
}
