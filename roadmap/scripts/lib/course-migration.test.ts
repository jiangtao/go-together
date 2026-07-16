import { execFile } from "node:child_process"
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createServer } from "node:net"
import { promisify } from "node:util"

import { afterEach, describe, expect, it } from "vitest"

import {
  applyMigrationPlan,
  createMigrationBaseline,
  inspectPortListener,
  planMigration,
  rollbackMigration,
  type MigrationRequest,
} from "./course-migration.ts"

const execute = promisify(execFile)
const temporaryDirectories: string[] = []

async function git(workspace: string, ...args: string[]): Promise<string> {
  const result = await execute("git", args, {
    cwd: workspace,
    encoding: "utf8",
  })
  return result.stdout
}

async function makeFixture(
  options: { includeHistoricalSurfaces?: boolean } = {}
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "course-migration-"))
  temporaryDirectories.push(root)
  const workspace = path.join(root, "workspace")
  const backupDirectory = path.join(root, "backup")
  await mkdir(path.join(workspace, "legacy/lessons"), { recursive: true })
  await mkdir(path.join(workspace, "exercise/day0"), { recursive: true })
  if (options.includeHistoricalSurfaces) {
    await mkdir(path.join(workspace, "exercise/day1"), { recursive: true })
    await mkdir(path.join(workspace, "roadmap/src/data"), { recursive: true })
  }
  await writeFile(
    path.join(workspace, ".gitignore"),
    [
      "learning-records/*/lessons/",
      "courses/*/resources/internal/",
      "exercise/",
      "",
    ].join("\n")
  )
  await writeFile(
    path.join(workspace, "legacy/lessons/day-00-intro.md"),
    "# Day 00：Intro\n"
  )
  await chmod(
    path.join(workspace, "legacy/lessons/day-00-intro.md"),
    0o640
  )
  await writeFile(
    path.join(workspace, "exercise/day0/notes.md"),
    "课程：[Day 0](../../legacy/lessons/day-00-intro.md)\n"
  )
  await writeFile(path.join(workspace, "user-document.md"), "before\n")
  if (options.includeHistoricalSurfaces) {
    await writeFile(
      path.join(workspace, "exercise/day1/answer.go"),
      "package day1\n"
    )
    await writeFile(
      path.join(workspace, "exercise/day0/notes-eval.md"),
      "# Day 0 Evaluation\n\nPrivate evidence.\n"
    )
    await writeFile(
      path.join(workspace, "legacy/progress.json"),
      '{"day":0,"status":"passed"}\n'
    )
    await writeFile(
      path.join(workspace, "roadmap/src/data/course.json"),
      '{"schemaVersion":3,"days":[]}\n'
    )
  }
  await git(workspace, "init", "-q")
  await git(workspace, "config", "user.name", "Migration Test")
  await git(workspace, "config", "user.email", "migration@example.test")
  await git(
    workspace,
    "add",
    ".gitignore",
    "legacy/lessons/day-00-intro.md",
    "user-document.md"
  )
  if (options.includeHistoricalSurfaces) {
    await git(
      workspace,
      "add",
      "legacy/progress.json",
      "roadmap/src/data/course.json"
    )
  }
  await git(workspace, "commit", "-qm", "fixture")
  await writeFile(path.join(workspace, "user-document.md"), "user dirty work\n")

  return { root, workspace, backupDirectory }
}

function migrationRequest(): MigrationRequest {
  return {
    schemaVersion: 1,
    ownedRoots: ["legacy", "exercise/day0"],
    identities: [
      {
        courseId: "go-backend",
        lessonId: "intro",
        legacyDay: 0,
        source: "legacy/lessons/day-00-intro.md",
        destination: "courses/go-backend/lessons/intro.md",
      },
    ],
    operations: [
      {
        kind: "copy",
        source: "legacy/lessons/day-00-intro.md",
        destination: "courses/go-backend/lessons/intro.md",
      },
      {
        kind: "rewrite",
        source: "exercise/day0/notes.md",
        destination:
          "learning-records/go-backend/lessons/intro/notes.md",
        replacements: [
          {
            from: "../../legacy/lessons/day-00-intro.md",
            to: "../../../../courses/go-backend/lessons/intro.md",
            expectedMatches: 1,
          },
        ],
      },
      { kind: "delete", path: "legacy/lessons/day-00-intro.md" },
      { kind: "delete", path: "exercise/day0/notes.md" },
    ],
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("Course migration transaction", () => {
  it("records a listener PID and command when platform inspection is available", async () => {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", resolve)
    })
    try {
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("test listener did not expose a TCP port")
      }
      const listener = await inspectPortListener(address.port)
      if (listener.status === "unavailable") return
      expect(listener).toMatchObject({
        status: "listening",
        pid: process.pid,
      })
      expect(listener.status === "listening" && listener.command.length).toBeGreaterThan(0)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it("exposes baseline and dry-run planning through the public CLI without workspace writes", async () => {
    const fixture = await makeFixture()
    const statusBefore = await git(
      fixture.workspace,
      "status",
      "--porcelain=v1",
      "--untracked-files=all"
    )
    const script = path.resolve("scripts/course-migration.ts")
    const baselineResult = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        script,
        "baseline",
        "--workspace",
        fixture.workspace,
        "--backup",
        fixture.backupDirectory,
        "--root",
        "legacy",
        "--root",
        "exercise",
        "--root",
        "user-document.md",
      ],
      { encoding: "utf8" }
    )
    expect(JSON.parse(baselineResult.stdout)).toMatchObject({
      command: "baseline",
      fileCount: 3,
      privateTrackedCount: 0,
    })

    const requestFile = path.join(fixture.root, "request.json")
    const planFile = path.join(fixture.root, "plan.json")
    await writeFile(requestFile, JSON.stringify(migrationRequest()))
    const planResult = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        script,
        "plan",
        "--workspace",
        fixture.workspace,
        "--backup",
        fixture.backupDirectory,
        "--request",
        requestFile,
        "--output",
        planFile,
      ],
      { encoding: "utf8" }
    )
    expect(JSON.parse(planResult.stdout)).toMatchObject({
      command: "plan",
      identityCount: 1,
      operationCount: 4,
    })
    const journalFile = path.join(fixture.root, "cli-journal.json")
    const applyResult = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        script,
        "apply",
        "--workspace",
        fixture.workspace,
        "--backup",
        fixture.backupDirectory,
        "--plan",
        planFile,
        "--journal",
        journalFile,
      ],
      { encoding: "utf8" }
    )
    expect(JSON.parse(applyResult.stdout)).toMatchObject({ command: "apply" })
    const rollbackResult = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        script,
        "rollback",
        "--workspace",
        fixture.workspace,
        "--backup",
        fixture.backupDirectory,
        "--plan",
        planFile,
        "--journal",
        journalFile,
      ],
      { encoding: "utf8" }
    )
    expect(JSON.parse(rollbackResult.stdout)).toMatchObject({
      command: "rollback",
    })
    expect(
      await git(
        fixture.workspace,
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
      )
    ).toBe(statusBefore)
  })

  it("captures a dirty-tree baseline and a verified repository-external backup", async () => {
    const fixture = await makeFixture({ includeHistoricalSurfaces: true })
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: [
        ".gitignore",
        "legacy",
        "exercise",
        "roadmap/src/data/course.json",
        "user-document.md",
      ],
    })

    expect(baseline.head).toMatch(/^[a-f0-9]{40}$/)
    expect(
      Buffer.from(baseline.gitStatusBase64, "base64").toString("utf8")
    ).toContain("user-document.md")
    expect(baseline.files.map((file) => file.path)).toEqual([
      ".gitignore",
      "exercise/day0/notes-eval.md",
      "exercise/day1/answer.go",
      "exercise/day0/notes.md",
      "legacy/lessons/day-00-intro.md",
      "legacy/progress.json",
      "roadmap/src/data/course.json",
      "user-document.md",
    ].sort())
    expect(baseline.privacy.trackedPaths).toEqual([])
    expect(
      baseline.files.find(
        (file) => file.path === "legacy/lessons/day-00-intro.md"
      )
    ).toMatchObject({ type: "file", mode: 0o640 })
    expect(baseline.privacy.probes.every((probe) => probe.ignored)).toBe(true)
    await expect(
      readFile(
        path.join(
          fixture.backupDirectory,
          "files/legacy/lessons/day-00-intro.md"
        ),
        "utf8"
      )
    ).resolves.toBe("# Day 00：Intro\n")
    await expect(
      readFile(path.join(fixture.backupDirectory, "baseline.json"), "utf8")
    ).resolves.toContain(baseline.fingerprint)
    const hashManifest = await readFile(
      path.join(fixture.backupDirectory, "files.sha256"),
      "utf8"
    )
    for (const file of baseline.files) {
      expect(hashManifest).toContain(
        `${file.sha256}  files/${file.path}\n`
      )
    }
    expect(["none", "listening", "unavailable"]).toContain(
      baseline.listener5173.status
    )
  })

  it("plans every classified file without changing the workspace", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const statusBefore = await git(
      fixture.workspace,
      "status",
      "--porcelain=v1",
      "--untracked-files=all"
    )

    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })

    expect(plan.identities).toEqual(migrationRequest().identities)
    expect(plan.operations).toHaveLength(4)
    expect(plan.operations[0]).toMatchObject({
      kind: "copy",
      source: "legacy/lessons/day-00-intro.md",
      destination: "courses/go-backend/lessons/intro.md",
    })
    expect(plan.operations[1]).toMatchObject({
      kind: "rewrite",
      replacements: [{ expectedMatches: 1, actualMatches: 1 }],
    })
    expect(
      await git(
        fixture.workspace,
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
      )
    ).toBe(statusBefore)
  })

  it("classifies all 37 Lessons and every historical surface in one dry-run plan", async () => {
    const fixture = await makeFixture({ includeHistoricalSurfaces: true })
    const baseRequest = migrationRequest()
    const identities = [...baseRequest.identities]
    const operations: MigrationRequest["operations"] = [
      baseRequest.operations[0]!,
      baseRequest.operations[1]!,
      {
        kind: "copy",
        source: "exercise/day0/notes-eval.md",
        destination:
          "learning-records/go-backend/lessons/intro/evaluation.md",
      },
      {
        kind: "copy",
        source: "exercise/day1/answer.go",
        destination:
          "learning-records/go-backend/lessons/day-01/workspace/answer.go",
      },
    ]
    const lessonSources = ["legacy/lessons/day-00-intro.md"]
    for (let day = 1; day <= 36; day += 1) {
      const dayText = String(day).padStart(2, "0")
      const source = `legacy/lessons/day-${dayText}.md`
      const destination = `courses/go-backend/lessons/day-${dayText}.md`
      await writeFile(
        path.join(fixture.workspace, source),
        `# Day ${dayText}\n`
      )
      identities.push({
        courseId: "go-backend",
        lessonId: `day-${dayText}`,
        legacyDay: day,
        source,
        destination,
      })
      lessonSources.push(source)
      operations.push({ kind: "copy", source, destination })
    }
    operations.push(
      ...lessonSources.map((source) => ({
        kind: "delete" as const,
        path: source,
      })),
      { kind: "delete", path: "legacy/progress.json" },
      { kind: "delete", path: "exercise/day0/notes.md" },
      { kind: "delete", path: "exercise/day0/notes-eval.md" },
      { kind: "delete", path: "exercise/day1/answer.go" },
      { kind: "delete", path: "roadmap/src/data/course.json" }
    )
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "roadmap/src/data/course.json"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: {
        schemaVersion: 1,
        ownedRoots: ["legacy", "exercise", "roadmap/src/data/course.json"],
        identities,
        operations,
      },
    })

    expect(plan.identities).toHaveLength(37)
    expect(plan.operations).toHaveLength(82)
  })

  it("rejects unknown files and baseline drift before applying", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    await writeFile(path.join(fixture.workspace, "legacy/unknown.md"), "unknown\n")

    await expect(
      planMigration({
        workspace: fixture.workspace,
        baseline,
        request: migrationRequest(),
      })
    ).rejects.toThrow("unclassified")

    await rm(path.join(fixture.workspace, "legacy/unknown.md"))
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })
    await writeFile(
      path.join(fixture.workspace, "legacy/lessons/day-00-intro.md"),
      "changed after plan\n"
    )
    await expect(
      applyMigrationPlan({
        workspace: fixture.workspace,
        backupDirectory: fixture.backupDirectory,
        baseline,
        plan,
        journalFile: path.join(fixture.root, "journal.json"),
      })
    ).rejects.toThrow("baseline drift")
  })

  it("rejects unsafe roots, destinations, and unprotected private targets", async () => {
    const symlinkFixture = await makeFixture()
    await symlink(
      path.join(symlinkFixture.workspace, "user-document.md"),
      path.join(symlinkFixture.workspace, "legacy/link.md")
    )
    await expect(
      createMigrationBaseline({
        workspace: symlinkFixture.workspace,
        backupDirectory: symlinkFixture.backupDirectory,
        roots: ["legacy"],
      })
    ).rejects.toThrow("symlink")

    const nonRegularFixture = await makeFixture()
    await execute(
      "mkfifo",
      [path.join(nonRegularFixture.workspace, "legacy/pipe")],
      { encoding: "utf8" }
    )
    await expect(
      createMigrationBaseline({
        workspace: nonRegularFixture.workspace,
        backupDirectory: nonRegularFixture.backupDirectory,
        roots: ["legacy"],
      })
    ).rejects.toThrow("non-regular")

    const collisionFixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: collisionFixture.workspace,
      backupDirectory: collisionFixture.backupDirectory,
      roots: ["legacy", "exercise"],
    })
    const collisionRequest = migrationRequest()
    collisionRequest.operations.splice(1, 0, {
      kind: "copy",
      source: "legacy/lessons/day-00-intro.md",
      destination: "courses/go-backend/lessons/INTRO.md",
    })
    await expect(
      planMigration({
        workspace: collisionFixture.workspace,
        baseline,
        request: collisionRequest,
      })
    ).rejects.toThrow("case-colliding")

    const workspaceCollisionFixture = await makeFixture()
    await mkdir(path.join(workspaceCollisionFixture.workspace, "Courses"))
    const workspaceCollisionBaseline = await createMigrationBaseline({
      workspace: workspaceCollisionFixture.workspace,
      backupDirectory: workspaceCollisionFixture.backupDirectory,
      roots: ["legacy", "exercise"],
    })
    await expect(
      planMigration({
        workspace: workspaceCollisionFixture.workspace,
        baseline: workspaceCollisionBaseline,
        request: migrationRequest(),
      })
    ).rejects.toThrow("case-collides with workspace")

    const escapeRequest = migrationRequest()
    escapeRequest.operations[0] = {
      kind: "copy",
      source: "legacy/lessons/day-00-intro.md",
      destination: "../outside.md",
    }
    await expect(
      planMigration({
        workspace: collisionFixture.workspace,
        baseline,
        request: escapeRequest,
      })
    ).rejects.toThrow("escapes")

    await writeFile(
      path.join(collisionFixture.workspace, ".gitignore"),
      "exercise/\n"
    )
    const unprotectedBaselineDirectory = path.join(
      collisionFixture.root,
      "unprotected-backup"
    )
    const unprotectedBaseline = await createMigrationBaseline({
      workspace: collisionFixture.workspace,
      backupDirectory: unprotectedBaselineDirectory,
      roots: ["legacy", "exercise"],
    })
    await expect(
      planMigration({
        workspace: collisionFixture.workspace,
        baseline: unprotectedBaseline,
        request: migrationRequest(),
      })
    ).rejects.toThrow("private destination is not ignored")

    const incompleteBackupFixture = await makeFixture()
    const incompleteBaseline = await createMigrationBaseline({
      workspace: incompleteBackupFixture.workspace,
      backupDirectory: incompleteBackupFixture.backupDirectory,
      roots: ["exercise"],
    })
    await expect(
      planMigration({
        workspace: incompleteBackupFixture.workspace,
        baseline: incompleteBaseline,
        request: migrationRequest(),
      })
    ).rejects.toThrow("absent from baseline backup")

    const arbitraryRewrite = migrationRequest()
    arbitraryRewrite.operations[1] = {
      kind: "rewrite",
      source: "legacy/lessons/day-00-intro.md",
      destination: "learning-records/go-backend/lessons/intro/notes.md",
      replacements: [{ from: "Intro", to: "Changed", expectedMatches: 1 }],
    }
    const rewriteFixture = await makeFixture()
    const rewriteBaseline = await createMigrationBaseline({
      workspace: rewriteFixture.workspace,
      backupDirectory: rewriteFixture.backupDirectory,
      roots: ["legacy", "exercise"],
    })
    await expect(
      planMigration({
        workspace: rewriteFixture.workspace,
        baseline: rewriteBaseline,
        request: arbitraryRewrite,
      })
    ).rejects.toThrow("only allowed for an identified Notes file")

    const codeFenceFixture = await makeFixture()
    await writeFile(
      path.join(codeFenceFixture.workspace, "exercise/day0/notes.md"),
      "```md\n[Course](../../legacy/lessons/day-00-intro.md)\n```\n"
    )
    const codeFenceBaseline = await createMigrationBaseline({
      workspace: codeFenceFixture.workspace,
      backupDirectory: codeFenceFixture.backupDirectory,
      roots: ["legacy", "exercise"],
    })
    await expect(
      planMigration({
        workspace: codeFenceFixture.workspace,
        baseline: codeFenceBaseline,
        request: migrationRequest(),
      })
    ).rejects.toThrow("not a Markdown link")
  })

  it("automatically restores the exact dirty baseline after every injected step failure", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })
    const statusBefore = await git(
      fixture.workspace,
      "status",
      "--porcelain=v1",
      "--untracked-files=all"
    )

    for (let failAfter = 1; failAfter <= plan.operations.length; failAfter += 1) {
      await expect(
        applyMigrationPlan({
          workspace: fixture.workspace,
          backupDirectory: fixture.backupDirectory,
          baseline,
          plan,
          journalFile: path.join(fixture.root, `journal-${failAfter}.json`),
          afterOperation(completedOperations) {
            if (completedOperations === failAfter) {
              throw new Error(`injected failure ${failAfter}`)
            }
          },
        })
      ).rejects.toThrow(`injected failure ${failAfter}`)
      const failedJournal = JSON.parse(
        await readFile(
          path.join(fixture.root, `journal-${failAfter}.json`),
          "utf8"
        )
      ) as { state: string; operations: unknown[] }
      expect(failedJournal).toMatchObject({ state: "rolled-back" })
      expect(failedJournal.operations).toHaveLength(failAfter)
      expect(
        await git(
          fixture.workspace,
          "status",
          "--porcelain=v1",
          "--untracked-files=all"
        )
      ).toBe(statusBefore)
      await expect(
        readFile(
          path.join(fixture.workspace, "legacy/lessons/day-00-intro.md"),
          "utf8"
        )
      ).resolves.toBe("# Day 00：Intro\n")
      await expect(
        readFile(
          path.join(fixture.workspace, "courses/go-backend/lessons/intro.md")
        )
      ).rejects.toThrow()
    }
  })

  it("stops when ignored files or unsafe destination parents appear after planning", async () => {
    const unknownFixture = await makeFixture()
    const unknownBaseline = await createMigrationBaseline({
      workspace: unknownFixture.workspace,
      backupDirectory: unknownFixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const unknownPlan = await planMigration({
      workspace: unknownFixture.workspace,
      baseline: unknownBaseline,
      request: migrationRequest(),
    })
    await writeFile(
      path.join(unknownFixture.workspace, "exercise/day0/unclassified.md"),
      "ignored but unknown\n"
    )
    await expect(
      applyMigrationPlan({
        workspace: unknownFixture.workspace,
        backupDirectory: unknownFixture.backupDirectory,
        baseline: unknownBaseline,
        plan: unknownPlan,
        journalFile: path.join(unknownFixture.root, "unknown-journal.json"),
      })
    ).rejects.toThrow("unclassified")

    const symlinkFixture = await makeFixture()
    const symlinkBaseline = await createMigrationBaseline({
      workspace: symlinkFixture.workspace,
      backupDirectory: symlinkFixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const symlinkPlan = await planMigration({
      workspace: symlinkFixture.workspace,
      baseline: symlinkBaseline,
      request: migrationRequest(),
    })
    const externalCourse = path.join(symlinkFixture.root, "external-course")
    await mkdir(externalCourse)
    await writeFile(path.join(externalCourse, "sentinel.txt"), "keep\n")
    await mkdir(
      path.join(
        symlinkFixture.workspace,
        "learning-records/go-backend/lessons"
      ),
      { recursive: true }
    )
    await symlink(
      externalCourse,
      path.join(
        symlinkFixture.workspace,
        "learning-records/go-backend/lessons/intro"
      )
    )
    await expect(
      applyMigrationPlan({
        workspace: symlinkFixture.workspace,
        backupDirectory: symlinkFixture.backupDirectory,
        baseline: symlinkBaseline,
        plan: symlinkPlan,
        journalFile: path.join(symlinkFixture.root, "symlink-journal.json"),
      })
    ).rejects.toThrow(/baseline drift|destination parent is unsafe/)
    await expect(
      readFile(path.join(externalCourse, "sentinel.txt"), "utf8")
    ).resolves.toBe("keep\n")
  })

  it("applies and rolls back only planned paths while preserving user dirty work", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })
    const journalFile = path.join(fixture.root, "journal.json")

    await applyMigrationPlan({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    const appliedJournal = JSON.parse(
      await readFile(journalFile, "utf8")
    ) as { state: string; operations: unknown[] }
    expect(appliedJournal).toMatchObject({ state: "applied" })
    expect(appliedJournal.operations).toHaveLength(plan.operations.length)

    await expect(
      readFile(
        path.join(fixture.workspace, "courses/go-backend/lessons/intro.md"),
        "utf8"
      )
    ).resolves.toBe("# Day 00：Intro\n")
    await expect(
      readFile(
        path.join(
          fixture.workspace,
          "learning-records/go-backend/lessons/intro/notes.md"
        ),
        "utf8"
      )
    ).resolves.toContain("../../../../courses/go-backend/lessons/intro.md")
    await expect(
      readFile(path.join(fixture.workspace, "user-document.md"), "utf8")
    ).resolves.toBe("user dirty work\n")
    expect(
      (await lstat(
        path.join(fixture.workspace, "courses/go-backend/lessons/intro.md")
      )).mode & 0o777
    ).toBe(0o640)

    await rollbackMigration({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    await expect(readFile(journalFile, "utf8")).resolves.toContain(
      '"state": "rolled-back"'
    )

    await expect(
      readFile(
        path.join(fixture.workspace, "legacy/lessons/day-00-intro.md"),
        "utf8"
      )
    ).resolves.toBe("# Day 00：Intro\n")
    await expect(
      readFile(path.join(fixture.workspace, "exercise/day0/notes.md"), "utf8")
    ).resolves.toContain("../../legacy/lessons/day-00-intro.md")
    expect(
      (await lstat(
        path.join(fixture.workspace, "legacy/lessons/day-00-intro.md")
      )).mode & 0o777
    ).toBe(0o640)
    await expect(
      readFile(path.join(fixture.workspace, "user-document.md"), "utf8")
    ).resolves.toBe("user dirty work\n")
    await expect(
      readFile(
        path.join(fixture.workspace, "courses/go-backend/lessons/intro.md")
      )
    ).rejects.toThrow()
  })

  it("includes Day 0 Evaluation in plan, apply, and rollback coverage", async () => {
    const fixture = await makeFixture()
    const evaluationSource = "exercise/day0/notes-eval.md"
    const evaluationDestination =
      "learning-records/go-backend/lessons/intro/evaluation.md"
    await writeFile(
      path.join(fixture.workspace, evaluationSource),
      "# Day 0 Evaluation\n\nPrivate evidence.\n"
    )
    const request = migrationRequest()
    request.operations.splice(2, 0, {
      kind: "copy",
      source: evaluationSource,
      destination: evaluationDestination,
    })
    request.operations.push({ kind: "delete", path: evaluationSource })
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request,
    })
    const journalFile = path.join(fixture.root, "evaluation-journal.json")

    await applyMigrationPlan({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    await expect(
      readFile(path.join(fixture.workspace, evaluationDestination), "utf8")
    ).resolves.toContain("Private evidence")
    await rollbackMigration({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    await expect(
      readFile(path.join(fixture.workspace, evaluationSource), "utf8")
    ).resolves.toContain("Private evidence")
  })

  it("refuses to erase a destination changed by the user after apply", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })
    const journalFile = path.join(fixture.root, "journal.json")
    await applyMigrationPlan({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    const changedDestination = path.join(
      fixture.workspace,
      "courses/go-backend/lessons/intro.md"
    )
    await writeFile(changedDestination, "user changed destination\n")

    await expect(
      rollbackMigration({
        workspace: fixture.workspace,
        backupDirectory: fixture.backupDirectory,
        baseline,
        plan,
        journalFile,
      })
    ).rejects.toThrow("rollback drift")
    await expect(readFile(changedDestination, "utf8")).resolves.toBe(
      "user changed destination\n"
    )
  })

  it("rejects a tampered external journal before resolving any path", async () => {
    const fixture = await makeFixture()
    const baseline = await createMigrationBaseline({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      roots: ["legacy", "exercise", "user-document.md"],
    })
    const plan = await planMigration({
      workspace: fixture.workspace,
      baseline,
      request: migrationRequest(),
    })
    const journalFile = path.join(fixture.root, "tampered-journal.json")
    await applyMigrationPlan({
      workspace: fixture.workspace,
      backupDirectory: fixture.backupDirectory,
      baseline,
      plan,
      journalFile,
    })
    const outsideDirectory = path.join(fixture.root, "outside-directory")
    await mkdir(outsideDirectory)
    const journal = JSON.parse(await readFile(journalFile, "utf8")) as {
      createdDirectories: string[]
    }
    journal.createdDirectories.push("../outside-directory")
    await writeFile(journalFile, JSON.stringify(journal))

    await expect(
      rollbackMigration({
        workspace: fixture.workspace,
        backupDirectory: fixture.backupDirectory,
        baseline,
        plan,
        journalFile,
      })
    ).rejects.toThrow("journal is invalid")
    expect((await lstat(outsideDirectory)).isDirectory()).toBe(true)
  })
})
