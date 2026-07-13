import {
  mkdtemp,
  mkdir,
  lstat,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import { execFile } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { afterEach, describe, expect, it } from "vitest"

import { inspectDeterministicTree } from "./deterministic-tree.ts"
import {
  RELEASE_STEPS,
  auditReleaseReceipt,
  createProtectedInvariant,
  createReleaseEnvironment,
  createReleaseReceipt,
  findPrivateTrackedPaths,
  findUnexpectedCandidateChanges,
  parseCandidateStatusPorcelainZ,
  resetEvidenceDirectory,
  validateReleaseToolchain,
  writeReleaseReceiptAtomically,
} from "./release-gate.ts"

const temporaryDirectories: string[] = []
const executeFile = promisify(execFile)

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

async function createReceiptFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-receipt-"))
  temporaryDirectories.push(root)
  const files = new Map<string, string>([
    ["package-lock.json", "{\"lockfileVersion\":3}\n"],
    [
      "generated/courses/catalog.json",
      `${JSON.stringify({
        courses: [
          {
            courseId: "go-backend",
            courseRevision: `sha256:${"a".repeat(64)}`,
          },
          {
            courseId: "python-fixture",
            courseRevision: `sha256:${"b".repeat(64)}`,
          },
        ],
      })}\n`,
    ],
    ["generated/course.json", "{\"schemaVersion\":3}\n"],
    ["dist/index.html", "<!doctype html><title>Roadmap</title>\n"],
    ["determinism.json", "{\"files\":[]}\n"],
    ["prebuilt.json", "{\"files\":[]}\n"],
    ["evidence.json", "{\"images\":[]}\n"],
    ["snapshots/go.json", "{\"courseId\":\"go-backend\"}\n"],
    ["snapshots/python.json", "{\"courseId\":\"python-fixture\"}\n"],
  ])
  for (const [relative, content] of files) {
    const target = path.join(root, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content, "utf8")
  }
  await writeFile(
    path.join(root, "determinism.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        files: await inspectDeterministicTree(path.join(root, "generated")),
      },
      null,
      2
    )}\n`,
    "utf8"
  )
  return {
    root,
    receiptFile: path.join(root, "release-receipt.json"),
    options: {
      candidate: {
        head: "1".repeat(40),
        workingTreeFingerprint: "2".repeat(64),
        fingerprintFileCount: 42,
      },
      toolchain: {
        node: "24.11.0",
        npm: "11.6.1",
        vercel: "50.27.1",
      },
      lockfile: path.join(root, "package-lock.json"),
      catalog: path.join(root, "generated/courses/catalog.json"),
      releaseSnapshots: [
        { name: "snapshots/go.json", file: path.join(root, "snapshots/go.json") },
        {
          name: "snapshots/python.json",
          file: path.join(root, "snapshots/python.json"),
        },
      ],
      determinismManifest: path.join(root, "determinism.json"),
      generatedDirectory: path.join(root, "generated"),
      distDirectory: path.join(root, "dist"),
      prebuiltManifest: path.join(root, "prebuilt.json"),
      evidenceManifest: path.join(root, "evidence.json"),
      passedSteps: RELEASE_STEPS.map(({ id }) => id),
    },
  }
}

describe("fail-closed release gate", () => {
  it("固定唯一门禁的顺序", () => {
    expect(RELEASE_STEPS.map(({ id }) => id)).toEqual([
      "candidate-preflight",
      "lint",
      "typecheck",
      "unit",
      "evaluation",
      "determinism",
      "generate-public",
      "audit-generated",
      "build-app",
      "audit-dist",
      "package-prebuilt",
      "audit-prebuilt",
      "playwright",
      "evidence-manifest",
    ])
  })

  it("拒绝 tracked private/internal 路径并只忽略受保护旧 Course 数据", () => {
    expect(
      findPrivateTrackedPaths([
        "learning-records/0001.md",
        "exercise/day0/notes.md",
        "courses/go-backend/learning-record/why-go/notes.md",
        "courses/go-backend/internal/capstone.md",
        "courses/go-backend/resources/internal/author-rubric.md",
        "docs/go-learning/daily-lessons/README.md",
        "docs/go-learning/sprint-36-day/capstone-rubric.md",
        "roadmap/src/App.tsx",
      ])
    ).toEqual([
      "courses/go-backend/internal/capstone.md",
      "courses/go-backend/learning-record/why-go/notes.md",
      "courses/go-backend/resources/internal/author-rubric.md",
      "docs/go-learning/daily-lessons/README.md",
      "docs/go-learning/sprint-36-day/capstone-rubric.md",
      "exercise/day0/notes.md",
      "learning-records/0001.md",
    ])
    const records = parseCandidateStatusPorcelainZ(
      " M roadmap/src/App.tsx\0 M roadmap/src/data/course.json\0" +
        "?? courses/go-backend/course.json\0" +
        "R  roadmap/src/data/course.json\0roadmap/src/App.tsx\0"
    )
    expect(findUnexpectedCandidateChanges(records)).toEqual([
      { status: " M", path: "roadmap/src/App.tsx" },
      { status: "??", path: "courses/go-backend/course.json" },
      {
        status: "R ",
        path: "roadmap/src/data/course.json",
        originalPath: "roadmap/src/App.tsx",
      },
    ])
  })

  it("即使 git add -f 也识别 canonical internal resource", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "release-private-track-"))
    temporaryDirectories.push(root)
    const privateFile = path.join(
      root,
      "courses/go-backend/resources/internal/rubric.md"
    )
    await mkdir(path.dirname(privateFile), { recursive: true })
    await writeFile(
      path.join(root, ".gitignore"),
      "/courses/*/resources/internal/\n"
    )
    await writeFile(privateFile, "private\n")
    await executeFile("git", ["init", "-q"], { cwd: root })
    await executeFile(
      "git",
      ["add", "-f", "courses/go-backend/resources/internal/rubric.md"],
      { cwd: root }
    )
    const { stdout } = await executeFile("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
    })
    expect(findPrivateTrackedPaths(stdout.split("\0").filter(Boolean))).toEqual([
      "courses/go-backend/resources/internal/rubric.md",
    ])
  })

  it("要求 Node/npm 主版本与 lockfile 中 exact Vercel CLI 一致", () => {
    expect(() =>
      validateReleaseToolchain({
        packageManager: "npm@11.6.1",
        nodeEngine: "24.x",
        npmEngine: "11.x",
        declaredVercel: "50.27.1",
        actualNode: "24.11.0",
        actualNpm: "11.6.1",
        actualVercel: "50.27.1",
      })
    ).not.toThrow()
    expect(() =>
      validateReleaseToolchain({
        packageManager: "npm@11.6.1",
        nodeEngine: "24.x",
        npmEngine: "11.x",
        declaredVercel: "^50.27.1",
        actualNode: "24.11.0",
        actualNpm: "11.6.1",
        actualVercel: "50.27.1",
      })
    ).toThrow("Vercel CLI")
  })

  it("release 子进程使用最小环境并固定本地 4173 与 evidence 路径", () => {
    const environment = createReleaseEnvironment(
      {
        PATH: "/bin",
        HOME: "/home/release",
        PLAYWRIGHT_BASE_URL: "https://attacker.example",
        E2E_EVIDENCE_DIR: "/tmp/stale",
        SECRET_TOKEN: "secret",
      },
      {
        E2E_EVIDENCE_DIR: "/candidate/evidence",
        E2E_CANDIDATE_HEAD: "1".repeat(40),
        PYTHONDONTWRITEBYTECODE: "1",
      }
    )
    expect(environment).toEqual({
      PATH: "/bin",
      HOME: "/home/release",
      E2E_EVIDENCE_DIR: "/candidate/evidence",
      E2E_CANDIDATE_HEAD: "1".repeat(40),
      PYTHONDONTWRITEBYTECODE: "1",
    })
    expect(environment.PLAYWRIGHT_BASE_URL).toBeUndefined()
    expect(environment.SECRET_TOKEN).toBeUndefined()
  })

  it("evaluation 在固定环境中不改写受保护 Skill tree", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "release-python-skill-"))
    temporaryDirectories.push(root)
    const scripts = path.join(root, "skill/scripts")
    await mkdir(scripts, { recursive: true })
    await writeFile(path.join(scripts, "core.py"), "VALUE = 1\n", "utf8")
    await writeFile(
      path.join(scripts, "test_core.py"),
      "import unittest\nfrom core import VALUE\n\nclass TestCore(unittest.TestCase):\n    def test_value(self):\n        self.assertEqual(VALUE, 1)\n",
      "utf8"
    )
    const before = await createProtectedInvariant(root, ["skill"])
    const environment = createReleaseEnvironment(process.env, {
      PYTHONDONTWRITEBYTECODE: "1",
    })
    await executeFile(
      "python3",
      ["-m", "unittest", "discover", "-s", scripts, "-p", "test_*.py"],
      { cwd: root, env: environment }
    )
    const after = await createProtectedInvariant(root, ["skill"])
    expect(after).toEqual(before)
    await expect(
      lstat(path.join(scripts, "__pycache__"))
    ).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("fresh evidence 清除历史同名文件且受保护输入变化可检测", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "release-invariant-"))
    temporaryDirectories.push(root)
    const evidence = path.join(root, "evidence")
    await mkdir(evidence)
    await writeFile(path.join(evidence, "desktop-normal.png"), "historical")
    await resetEvidenceDirectory(evidence)
    await expect(readdir(evidence)).resolves.toEqual([])

    await mkdir(path.join(root, "courses/go-backend"), { recursive: true })
    await writeFile(path.join(root, "courses/go-backend/course.json"), "one")
    const before = await createProtectedInvariant(root, ["courses", "exercise"])
    await writeFile(path.join(root, "courses/go-backend/course.json"), "two")
    const after = await createProtectedInvariant(root, ["courses", "exercise"])
    expect(after.sha256).not.toBe(before.sha256)
    expect(before.entries.some((entry) => entry.type === "missing")).toBe(true)
  })

  it("Receipt 绑定候选、输入、Course Revision、制品、测试与证据 hash", async () => {
    const fixture = await createReceiptFixture()
    const receipt = await createReleaseReceipt(fixture.options)
    expect(receipt.schemaVersion).toBe(1)
    expect(receipt.candidate.head).toBe("1".repeat(40))
    expect(receipt.inputs.courses).toEqual([
      { courseId: "go-backend", courseRevision: `sha256:${"a".repeat(64)}` },
      {
        courseId: "python-fixture",
        courseRevision: `sha256:${"b".repeat(64)}`,
      },
    ])
    expect(receipt.inputs.releaseSnapshots).toHaveLength(2)
    expect(receipt.artifacts.generatedTree.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.tests.passedSteps).toEqual(
      RELEASE_STEPS.map(({ id }) => id)
    )

    await writeReleaseReceiptAtomically(fixture.receiptFile, receipt)
    await expect(
      auditReleaseReceipt(fixture.receiptFile, fixture.options)
    ).resolves.toBeUndefined()
    expect(JSON.parse(await readFile(fixture.receiptFile, "utf8"))).toEqual(
      receipt
    )

    await writeFile(
      path.join(fixture.root, "dist/index.html"),
      "<!doctype html><title>Changed</title>\n",
      "utf8"
    )
    await expect(
      auditReleaseReceipt(fixture.receiptFile, fixture.options)
    ).rejects.toThrow("Release Receipt")
  })

  it("拒绝与双生成 manifest 不一致的实际 generated tree", async () => {
    const fixture = await createReceiptFixture()
    await writeFile(
      path.join(fixture.root, "generated/course.json"),
      "{\"schemaVersion\":4}\n",
      "utf8"
    )
    await expect(createReleaseReceipt(fixture.options)).rejects.toThrow(
      "双生成 manifest"
    )
  })
})
