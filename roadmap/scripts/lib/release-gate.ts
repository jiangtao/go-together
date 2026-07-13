import { createHash } from "node:crypto"
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import { inspectDeterministicTree } from "./deterministic-tree.ts"

export const RELEASE_STEPS = [
  { id: "candidate-preflight", command: null },
  { id: "lint", command: ["npm", "run", "lint"] },
  { id: "typecheck", command: ["npm", "run", "typecheck"] },
  { id: "unit", command: ["npm", "run", "test"] },
  { id: "evaluation", command: ["npm", "run", "test:evaluation"] },
  { id: "determinism", command: ["npm", "run", "check:determinism"] },
  { id: "generate-public", command: ["npm", "run", "generate:public"] },
  { id: "audit-generated", command: ["npm", "run", "audit:generated"] },
  { id: "build-app", command: ["npm", "run", "build:app"] },
  { id: "audit-dist", command: ["npm", "run", "audit:dist"] },
  { id: "package-prebuilt", command: ["npm", "run", "package:prebuilt"] },
  { id: "audit-prebuilt", command: ["npm", "run", "audit:prebuilt"] },
  { id: "playwright", command: ["npx", "playwright", "test"] },
  { id: "evidence-manifest", command: ["npm", "run", "evidence:manifest"] },
] as const

export type ReleaseStepId = (typeof RELEASE_STEPS)[number]["id"]

const PRIVATE_TRACKED_PATTERNS = [
  /^learning-records(?:\/|$)/,
  /^exercise(?:\/|$)/,
  /^courses\/[^/]+\/(?:learning-record|learning-records|internal)(?:\/|$)/,
  /^docs\/go-learning\/daily-lessons\/README\.md$/,
  /^docs\/go-learning\/node-to-go-36-day-course\.md$/,
  /^docs\/go-learning\/sprint-36-day\/capstone-rubric\.md$/,
  /(?:^|\/)notes(?:-eval)?\.md$/i,
  /(?:^|\/)\.env(?:\.|$)/i,
] as const

const PROTECTED_LEGACY_COURSE = "roadmap/src/data/course.json"

export function findPrivateTrackedPaths(paths: string[]): string[] {
  return [...new Set(paths)]
    .filter((candidate) =>
      PRIVATE_TRACKED_PATTERNS.some((pattern) => pattern.test(candidate))
    )
    .sort()
}

export interface CandidateStatusRecord {
  status: string
  path: string
  originalPath?: string
}

export function parseCandidateStatusPorcelainZ(
  source: string
): CandidateStatusRecord[] {
  const records: CandidateStatusRecord[] = []
  let cursor = 0
  while (cursor < source.length) {
    const end = source.indexOf("\0", cursor)
    if (end === -1) throw new Error("git status porcelain -z 缺少终止符")
    const token = source.slice(cursor, end)
    cursor = end + 1
    if (token.length < 4 || token[2] !== " ") {
      throw new Error("git status porcelain -z 记录非法")
    }
    const status = token.slice(0, 2)
    const record: CandidateStatusRecord = { status, path: token.slice(3) }
    if (/[RC]/.test(status)) {
      const originalEnd = source.indexOf("\0", cursor)
      if (originalEnd === -1) {
        throw new Error("git status porcelain -z rename/copy 缺少原路径")
      }
      record.originalPath = source.slice(cursor, originalEnd)
      cursor = originalEnd + 1
    }
    records.push(record)
  }
  return records
}

export function findUnexpectedCandidateChanges(
  records: CandidateStatusRecord[]
): CandidateStatusRecord[] {
  return records.filter(
    (record) =>
      record.path !== PROTECTED_LEGACY_COURSE ||
      record.originalPath !== undefined ||
      /[RC]/.test(record.status)
  )
}

const RELEASE_ENVIRONMENT_ALLOWLIST = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "CI",
  "LANG",
  "LC_ALL",
  "SHELL",
  "SYSTEMROOT",
  "COMSPEC",
  "PATHEXT",
  "WINDIR",
  "USERPROFILE",
  "NO_COLOR",
  "FORCE_COLOR",
] as const

export function createReleaseEnvironment(
  source: NodeJS.ProcessEnv,
  fixed: Record<string, string>
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const key of RELEASE_ENVIRONMENT_ALLOWLIST) {
    if (source[key] !== undefined) environment[key] = source[key]
  }
  return { ...environment, ...fixed }
}

export async function resetEvidenceDirectory(directory: string): Promise<void> {
  try {
    const metadata = await lstat(directory)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("E2E evidence 根必须是普通目录且不得为符号链接")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true, mode: 0o700 })
}

interface ProtectedInvariantEntry {
  path: string
  type: "missing" | "directory" | "file" | "symlink" | "other"
  mode?: number
  bytes?: number
  sha256?: string
}

export interface ProtectedInvariant {
  sha256: string
  entries: ProtectedInvariantEntry[]
}

async function protectedEntries(
  repositoryRoot: string,
  relative: string
): Promise<ProtectedInvariantEntry[]> {
  const absolute = path.join(repositoryRoot, relative)
  let metadata
  try {
    metadata = await lstat(absolute)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [{ path: relative, type: "missing" }]
    }
    throw error
  }
  const mode = metadata.mode & 0o777
  if (metadata.isSymbolicLink()) {
    const target = await readlink(absolute)
    return [
      {
        path: relative,
        type: "symlink",
        mode,
        bytes: Buffer.byteLength(target),
        sha256: createHash("sha256").update(target).digest("hex"),
      },
    ]
  }
  if (metadata.isFile()) {
    const content = await readFile(absolute)
    return [
      {
        path: relative,
        type: "file",
        mode,
        bytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
      },
    ]
  }
  if (!metadata.isDirectory()) {
    return [{ path: relative, type: "other", mode }]
  }
  const entries = await readdir(absolute)
  const children = await Promise.all(
    entries.map((entry) => protectedEntries(repositoryRoot, `${relative}/${entry}`))
  )
  return [
    { path: relative, type: "directory", mode },
    ...children.flat(),
  ]
}

export async function createProtectedInvariant(
  repositoryRoot: string,
  relativeRoots: string[]
): Promise<ProtectedInvariant> {
  const roots = [...new Set(relativeRoots)].sort()
  for (const root of roots) {
    if (
      root === "" ||
      path.isAbsolute(root) ||
      root.split("/").some((segment) => segment === "" || segment === "..")
    ) {
      throw new Error(`受保护不变量路径非法：${root}`)
    }
  }
  const entries = (
    await Promise.all(roots.map((root) => protectedEntries(repositoryRoot, root)))
  )
    .flat()
    .sort((left, right) => left.path.localeCompare(right.path))
  return {
    sha256: createHash("sha256")
      .update(JSON.stringify(entries))
      .digest("hex"),
    entries,
  }
}

export interface ReleaseToolchainValidation {
  packageManager: string
  nodeEngine: string
  npmEngine: string
  declaredVercel: string
  actualNode: string
  actualNpm: string
  actualVercel: string
}

function major(version: string): string {
  return version.replace(/^v/, "").split(".")[0] ?? ""
}

export function validateReleaseToolchain(
  toolchain: ReleaseToolchainValidation
): void {
  const npmPin = toolchain.packageManager.match(/^npm@(\d+\.\d+\.\d+)$/)?.[1]
  if (!npmPin || toolchain.npmEngine !== "11.x" || major(toolchain.actualNpm) !== "11") {
    throw new Error("release gate 要求 packageManager 固定 npm 11 exact version")
  }
  if (toolchain.actualNpm !== npmPin) {
    throw new Error(`npm 版本与 packageManager 不一致：${toolchain.actualNpm} != ${npmPin}`)
  }
  if (toolchain.nodeEngine !== "24.x" || major(toolchain.actualNode) !== "24") {
    throw new Error("release gate 要求 Node 24.x")
  }
  if (
    !/^\d+\.\d+\.\d+$/.test(toolchain.declaredVercel) ||
    toolchain.actualVercel !== toolchain.declaredVercel
  ) {
    throw new Error("Vercel CLI 必须由 lockfile 中 exact version 提供")
  }
}

interface FileDigest {
  bytes: number
  sha256: string
}

interface TreeDigest {
  files: number
  sha256: string
}

export interface ReleaseReceipt {
  schemaVersion: 1
  candidate: {
    head: string
    workingTreeFingerprint: string
    fingerprintFileCount: number
  }
  toolchain: {
    node: string
    npm: string
    vercel: string
  }
  inputs: {
    lockfile: FileDigest
    catalog: FileDigest
    courses: Array<{ courseId: string; courseRevision: string }>
    releaseSnapshots: Array<{ file: string; bytes: number; sha256: string }>
  }
  artifacts: {
    determinismManifest: FileDigest
    generatedTree: TreeDigest
    distTree: TreeDigest
    prebuiltManifest: FileDigest
    evidenceManifest: FileDigest
  }
  tests: {
    passedSteps: ReleaseStepId[]
  }
}

export interface ReleaseReceiptOptions {
  candidate: ReleaseReceipt["candidate"]
  toolchain: ReleaseReceipt["toolchain"]
  lockfile: string
  catalog: string
  releaseSnapshots: Array<{ name: string; file: string }>
  determinismManifest: string
  generatedDirectory: string
  distDirectory: string
  prebuiltManifest: string
  evidenceManifest: string
  passedSteps: ReleaseStepId[]
}

async function digestFile(file: string): Promise<FileDigest> {
  const metadata = await lstat(file)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`Release Receipt 只接受普通文件：${path.basename(file)}`)
  }
  const content = await readFile(file)
  return {
    bytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  }
}

async function digestTree(root: string): Promise<TreeDigest> {
  const files = await inspectDeterministicTree(root)
  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(file.path)
    hash.update("\0")
    hash.update(String(file.bytes))
    hash.update("\0")
    hash.update(file.sha256)
    hash.update("\0")
  }
  return { files: files.length, sha256: hash.digest("hex") }
}

function validateCandidate(candidate: ReleaseReceipt["candidate"]): void {
  if (!/^[a-f0-9]{40}$/.test(candidate.head)) {
    throw new Error("Release Receipt candidate HEAD 必须是 40 位十六进制")
  }
  if (!/^[a-f0-9]{64}$/.test(candidate.workingTreeFingerprint)) {
    throw new Error("Release Receipt candidate fingerprint 必须是 SHA-256")
  }
  if (!Number.isInteger(candidate.fingerprintFileCount) || candidate.fingerprintFileCount < 1) {
    throw new Error("Release Receipt candidate file count 非法")
  }
}

function validatePassedSteps(passedSteps: ReleaseStepId[]): void {
  const expected = RELEASE_STEPS.map(({ id }) => id)
  if (
    passedSteps.length !== expected.length ||
    passedSteps.some((step, index) => step !== expected[index])
  ) {
    throw new Error("Release Receipt 必须绑定完整且有序的 release gate 步骤")
  }
}

export async function createReleaseReceipt(
  options: ReleaseReceiptOptions
): Promise<ReleaseReceipt> {
  validateCandidate(options.candidate)
  validatePassedSteps(options.passedSteps)
  const catalogSource = JSON.parse(await readFile(options.catalog, "utf8")) as {
    courses?: Array<{ courseId?: unknown; courseRevision?: unknown }>
  }
  if (!Array.isArray(catalogSource.courses) || catalogSource.courses.length < 1) {
    throw new Error("Release Receipt Catalog 缺少 Course")
  }
  const courses = catalogSource.courses
    .map(({ courseId, courseRevision }) => {
      if (
        typeof courseId !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseId) ||
        typeof courseRevision !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(courseRevision)
      ) {
        throw new Error("Release Receipt Catalog Course 身份或修订非法")
      }
      return { courseId, courseRevision }
    })
    .sort((left, right) => left.courseId.localeCompare(right.courseId))
  if (new Set(courses.map(({ courseId }) => courseId)).size !== courses.length) {
    throw new Error("Release Receipt Catalog Course 重复")
  }

  const determinismSource = JSON.parse(
    await readFile(options.determinismManifest, "utf8")
  ) as { schemaVersion?: unknown; files?: unknown }
  const generatedFiles = await inspectDeterministicTree(
    options.generatedDirectory
  )
  if (
    determinismSource.schemaVersion !== 1 ||
    JSON.stringify(determinismSource.files) !== JSON.stringify(generatedFiles)
  ) {
    throw new Error("Release Receipt 拒绝与双生成 manifest 不一致的 generated tree")
  }

  const releaseSnapshots = await Promise.all(
    [...options.releaseSnapshots]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async ({ name, file }) => {
        if (
          name === "" ||
          path.isAbsolute(name) ||
          name.split("/").some((segment) => segment === "" || segment === "..")
        ) {
          throw new Error("Release Receipt Snapshot 名称必须是规范相对路径")
        }
        return { file: name, ...(await digestFile(file)) }
      })
  )
  if (
    releaseSnapshots.length < 1 ||
    new Set(releaseSnapshots.map(({ file }) => file)).size !== releaseSnapshots.length
  ) {
    throw new Error("Release Receipt Release Snapshot 缺失或文件名重复")
  }

  return {
    schemaVersion: 1,
    candidate: { ...options.candidate },
    toolchain: { ...options.toolchain },
    inputs: {
      lockfile: await digestFile(options.lockfile),
      catalog: await digestFile(options.catalog),
      courses,
      releaseSnapshots,
    },
    artifacts: {
      determinismManifest: await digestFile(options.determinismManifest),
      generatedTree: await digestTree(options.generatedDirectory),
      distTree: await digestTree(options.distDirectory),
      prebuiltManifest: await digestFile(options.prebuiltManifest),
      evidenceManifest: await digestFile(options.evidenceManifest),
    },
    tests: { passedSteps: [...options.passedSteps] },
  }
}

function serializeReceipt(receipt: ReleaseReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`
}

export async function writeReleaseReceiptAtomically(
  outputFile: string,
  receipt: ReleaseReceipt
): Promise<void> {
  await mkdir(path.dirname(outputFile), { recursive: true })
  try {
    const metadata = await lstat(outputFile)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("旧 Release Receipt 必须是普通文件")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const temporary = `${outputFile}.tmp`
  let created = false
  try {
    await writeFile(temporary, serializeReceipt(receipt), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    })
    created = true
    await rename(temporary, outputFile)
    created = false
  } finally {
    if (created) await rm(temporary, { force: true })
  }
}

export async function auditReleaseReceipt(
  receiptFile: string,
  options: ReleaseReceiptOptions
): Promise<void> {
  const recorded = await readFile(receiptFile, "utf8")
  const inspected = serializeReceipt(await createReleaseReceipt(options))
  if (recorded !== inspected) {
    throw new Error("Release Receipt 与当前候选、输入、制品或证据不一致")
  }
}
