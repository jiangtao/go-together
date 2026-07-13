import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { buildPublicArtifacts } from "./public-course.ts"
import { createPublicCourseFixture } from "./public-course.test-fixture.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("canonical Course public generator", () => {
  it("只消费 Catalog、Course、Release Snapshot 与显式兼容映射", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "canonical-public-course-")
    )
    temporaryDirectories.push(repositoryRoot)
    const fixture = await createPublicCourseFixture(repositoryRoot, {
      dayZeroPassed: true,
    })

    const legacy = await buildPublicArtifacts({
      repositoryRoot,
      outputDirectory: fixture.outputDirectory,
    })

    expect(legacy.lessons).toHaveLength(37)
    expect(legacy.lessons[0]).toMatchObject({
      id: "day-00",
      status: "通过",
      referenceScore: 92,
      lessonHref: "/sources/lessons/day-00-lesson-00.md",
    })
    const canonical = JSON.parse(
      await readFile(
        path.join(
          fixture.outputDirectory,
          "courses/go-backend/course.json"
        ),
        "utf8"
      )
    ) as { tracks: unknown[] }
    expect(canonical.tracks).toHaveLength(3)
    await expect(
      readFile(
        path.join(
          fixture.outputDirectory,
          "courses/go-backend/sources/lessons/lesson-00.md"
        ),
        "utf8"
      )
    ).resolves.toContain("# Day 00")
  })
})
