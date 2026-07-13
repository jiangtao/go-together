import { execFile, spawn } from "node:child_process"
import { lstat, readFile, rm } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

import { inspectPortListener } from "./lib/course-migration.ts"
import { createCandidateFingerprint } from "./lib/e2e-evidence.ts"
import { assertCanonicalInputTree } from "./lib/canonical-input-tree.ts"
import { parseSourceCatalog } from "./lib/course-contract.ts"
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
  type ProtectedInvariant,
  type ReleaseReceiptOptions,
  type ReleaseToolchainValidation,
} from "./lib/release-gate.ts"

const executeFile = promisify(execFile)
const roadmapDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const repositoryRoot = path.resolve(roadmapDirectory, "..")
const evidenceDirectory = path.join(
  roadmapDirectory,
  ".generated/e2e-evidence"
)
const receiptFile = path.join(roadmapDirectory, ".generated/release-receipt.json")
const prebuiltManifest = path.join(
  roadmapDirectory,
  ".generated/prebuilt-manifest.json"
)
const prebuiltOutput = path.join(roadmapDirectory, ".vercel/output")
const requestedCandidateHead = process.env.RELEASE_CANDIDATE_HEAD?.trim()
const protectedRoots = [
  ".agents/skills/evaluate-course-lesson",
  ".agents/skills/evaluate-go-day",
  "NOTES.md",
  "courses",
  "docs/go-learning",
  "docs/learning-records",
  "exercise",
  "learning-records",
  "release-progress",
  "roadmap/content",
  "roadmap/src/data/course.json",
]

function baseEnvironment(fixed: Record<string, string> = {}): NodeJS.ProcessEnv {
  return createReleaseEnvironment(process.env, {
    E2E_EVIDENCE_DIR: evidenceDirectory,
    NPM_CONFIG_USERCONFIG: path.join(roadmapDirectory, ".npmrc"),
    PYTHONDONTWRITEBYTECODE: "1",
    PLAYWRIGHT_ARTIFACT_DIR: path.join(
      roadmapDirectory,
      ".generated/playwright"
    ),
    ...fixed,
  })
}

async function execute(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  trim = true
): Promise<string> {
  const result = await executeFile(command, args, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 16 * 1024 * 1024,
  })
  return trim ? result.stdout.trim() : result.stdout
}

async function runStep(
  command: readonly string[],
  environment: NodeJS.ProcessEnv
): Promise<void> {
  const [executable, ...args] = command
  if (!executable) throw new Error("release gate step 缺少命令")
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: roadmapDirectory,
      env: environment,
      stdio: "inherit",
    })
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(
        new Error(`${command.join(" ")} 失败：code=${code} signal=${signal}`)
      )
    })
  })
}

async function assertCandidatePreflight(
  environment: NodeJS.ProcessEnv,
  expectedHead?: string
): Promise<{
  head: string
  fingerprint: Awaited<ReturnType<typeof createCandidateFingerprint>>
  toolchain: ReleaseToolchainValidation
}> {
  const head = await execute(
    "git",
    ["rev-parse", "HEAD"],
    repositoryRoot,
    environment
  )
  if (!/^[a-f0-9]{40}$/.test(head)) {
    throw new Error("候选 HEAD 不是 40 位提交标识")
  }
  if (expectedHead && expectedHead !== head) {
    throw new Error(`候选 HEAD 不匹配：${head} != ${expectedHead}`)
  }

  const tracked = (
    await execute(
      "git",
      ["ls-files", "-z"],
      repositoryRoot,
      environment,
      false
    )
  )
    .split("\0")
    .filter(Boolean)
  const privateTracked = findPrivateTrackedPaths(tracked)
  if (privateTracked.length > 0) {
    throw new Error(`候选仍跟踪 private/internal 文件：${privateTracked.join(", ")}`)
  }

  const status = await execute(
    "git",
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      ".vercelignore",
      ".github/workflows",
      ".agents/skills/evaluate-course-lesson",
      ".agents/skills/evaluate-go-day",
      "courses",
      "release-progress",
      "roadmap",
    ],
    repositoryRoot,
    environment,
    false
  )
  const unexpected = findUnexpectedCandidateChanges(
    parseCandidateStatusPorcelainZ(status)
  )
  if (unexpected.length > 0) {
    throw new Error(
      `候选相关 working tree 不干净：${unexpected
        .map(({ status: state, path: file, originalPath }) =>
          `${state} ${originalPath ? `${originalPath} -> ` : ""}${file}`
        )
        .join(" | ")}`
    )
  }

  const packageSource = JSON.parse(
    await readFile(path.join(roadmapDirectory, "package.json"), "utf8")
  ) as {
    packageManager?: string
    engines?: { node?: string; npm?: string }
    devDependencies?: { vercel?: string }
  }
  const lockSource = JSON.parse(
    await readFile(path.join(roadmapDirectory, "package-lock.json"), "utf8")
  ) as {
    packages?: Record<
      string,
      { version?: string; devDependencies?: { vercel?: string } }
    >
  }
  const installedVercel = JSON.parse(
    await readFile(
      path.join(roadmapDirectory, "node_modules/vercel/package.json"),
      "utf8"
    )
  ) as { version?: string }
  const declaredVercel = packageSource.devDependencies?.vercel ?? ""
  if (
    lockSource.packages?.[""]?.devDependencies?.vercel !== declaredVercel ||
    lockSource.packages?.["node_modules/vercel"]?.version !== declaredVercel
  ) {
    throw new Error("Vercel CLI 必须以 exact version 固定在 package-lock.json")
  }
  const toolchain = {
    packageManager: packageSource.packageManager ?? "",
    nodeEngine: packageSource.engines?.node ?? "",
    npmEngine: packageSource.engines?.npm ?? "",
    declaredVercel,
    actualNode: process.version.replace(/^v/, ""),
    actualNpm: await execute(
      "npm",
      ["--version"],
      roadmapDirectory,
      environment
    ),
    actualVercel: installedVercel.version ?? "",
  }
  validateReleaseToolchain(toolchain)
  return {
    head,
    fingerprint: await createCandidateFingerprint(repositoryRoot),
    toolchain,
  }
}

async function inspectReleasePort() {
  const inspected = await inspectPortListener(5173)
  if (inspected.status !== "unavailable") return inspected
  return new Promise<{ status: "none" }>((resolve, reject) => {
    const server = createServer()
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error("无法识别既有 5173 listener 的 PID/command"))
      } else {
        reject(error)
      }
    })
    server.listen(5173, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve({ status: "none" })))
    })
  })
}

async function releaseSnapshotFiles(): Promise<
  Array<{ name: string; file: string }>
> {
  let catalogValue: unknown
  try {
    catalogValue = JSON.parse(
      await readFile(path.join(repositoryRoot, "courses/catalog.json"), "utf8")
    )
  } catch {
    throw new Error("候选 Course Catalog 不是合法 JSON")
  }
  const catalog = parseSourceCatalog(catalogValue)
  const tree = await assertCanonicalInputTree(repositoryRoot, catalog)
  return tree.releaseSnapshots.map(({ file }) => ({
    name: path.relative(repositoryRoot, file).split(path.sep).join("/"),
    file,
  }))
}

async function receiptOptions(
  environment: NodeJS.ProcessEnv,
  expectedHead: string
): Promise<ReleaseReceiptOptions> {
  const candidate = await assertCandidatePreflight(environment, expectedHead)
  return {
    candidate: {
      head: candidate.head,
      workingTreeFingerprint: candidate.fingerprint.sha256,
      fingerprintFileCount: candidate.fingerprint.fileCount,
    },
    toolchain: {
      node: candidate.toolchain.actualNode,
      npm: candidate.toolchain.actualNpm,
      vercel: candidate.toolchain.actualVercel,
    },
    lockfile: path.join(roadmapDirectory, "package-lock.json"),
    catalog: path.join(
      roadmapDirectory,
      ".generated/public/courses/catalog.json"
    ),
    releaseSnapshots: await releaseSnapshotFiles(),
    determinismManifest: path.join(
      roadmapDirectory,
      ".generated/determinism-manifest.json"
    ),
    generatedDirectory: path.join(roadmapDirectory, ".generated/public"),
    distDirectory: path.join(roadmapDirectory, "dist"),
    prebuiltManifest,
    evidenceManifest: path.join(evidenceDirectory, "evidence-manifest.json"),
    passedSteps: RELEASE_STEPS.map(({ id }) => id),
  }
}

async function removeDeployableArtifacts(): Promise<void> {
  await Promise.all([
    rm(receiptFile, { force: true }),
    rm(prebuiltManifest, { force: true }),
    rm(prebuiltOutput, { recursive: true, force: true }),
  ])
}

async function removeFreshEvidence(): Promise<void> {
  try {
    const metadata = await lstat(evidenceDirectory)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("拒绝清理非普通 evidence 目录")
    }
    await rm(evidenceDirectory, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

function combineFailure(current: unknown, next: unknown): unknown {
  if (!current) return next
  return new AggregateError([current, next], "verify:release 多重失败")
}

let failure: unknown
let listenerBefore: Awaited<ReturnType<typeof inspectReleasePort>> | undefined
let invariantBefore: ProtectedInvariant | undefined
let evidencePrepared = false
let successReceipt: string | undefined

try {
  listenerBefore = await inspectReleasePort()
  invariantBefore = await createProtectedInvariant(repositoryRoot, protectedRoots)
  await removeDeployableArtifacts()
  await resetEvidenceDirectory(evidenceDirectory)
  evidencePrepared = true

  const initial = await assertCandidatePreflight(
    baseEnvironment(),
    requestedCandidateHead
  )
  const environment = baseEnvironment({
    RELEASE_CANDIDATE_HEAD: initial.head,
    E2E_CANDIDATE_HEAD: initial.head,
    E2E_RUN_ID: `release-${initial.head}`,
  })
  for (const step of RELEASE_STEPS.slice(1)) {
    if (!step.command) continue
    console.log(`\n[verify:release] ${step.id}`)
    await runStep(step.command, environment)
  }

  const options = await receiptOptions(environment, initial.head)
  const receipt = await createReleaseReceipt(options)
  await writeReleaseReceiptAtomically(receiptFile, receipt)
  await auditReleaseReceipt(receiptFile, options)
  successReceipt = receiptFile
} catch (error) {
  failure = error
} finally {
  if (listenerBefore) {
    try {
      const listenerAfter = await inspectReleasePort()
      if (JSON.stringify(listenerAfter) !== JSON.stringify(listenerBefore)) {
        failure = combineFailure(
          failure,
          new Error("verify:release 改变了既有 5173 listener")
        )
      }
    } catch (error) {
      failure = combineFailure(failure, error)
    }
  }
  if (invariantBefore) {
    try {
      const invariantAfter = await createProtectedInvariant(
        repositoryRoot,
        protectedRoots
      )
      if (invariantAfter.sha256 !== invariantBefore.sha256) {
        failure = combineFailure(
          failure,
          new Error("verify:release 改写了 Course/Record/Snapshot 受保护输入")
        )
      }
    } catch (error) {
      failure = combineFailure(failure, error)
    }
  }
  if (failure) {
    try {
      await removeDeployableArtifacts()
      if (evidencePrepared) await removeFreshEvidence()
    } catch (error) {
      failure = combineFailure(failure, error)
    }
  }
}

if (failure) {
  console.error("verify:release 失败：", failure)
  process.exitCode = 1
} else {
  console.log(`\nverify:release 通过：${successReceipt}`)
}
