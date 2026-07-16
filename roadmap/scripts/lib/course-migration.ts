import { createHash, randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

const BASELINE_SCHEMA_VERSION = 1 as const
const PLAN_SCHEMA_VERSION = 1 as const
const JOURNAL_SCHEMA_VERSION = 1 as const
const LOCK_FILE = ".course-migration.lock"

const PRIVACY_PROBES = [
  "learning-records/__migration_probe__/lessons/__lesson__/notes.md",
  "courses/__migration_probe__/resources/internal/__probe__.md",
  "exercise/__migration_probe__/notes.md",
] as const

const PRIVATE_TRACKED_PATH =
  /^(?:learning-records\/[^/]+\/lessons\/|courses\/[^/]+\/resources\/internal\/|exercise\/)/

const PRIVATE_DESTINATION =
  /^(?:learning-records\/[^/]+\/lessons\/|courses\/[^/]+\/resources\/internal\/|exercise\/)/

export interface MigrationFileSnapshot {
  path: string
  type: "file"
  mode: number
  size: number
  sha256: string
}

export interface MigrationBaseline {
  schemaVersion: typeof BASELINE_SCHEMA_VERSION
  head: string
  gitStatusBase64: string
  gitStatusSha256: string
  roots: Array<{ path: string; exists: boolean }>
  files: MigrationFileSnapshot[]
  privacy: {
    trackedPaths: string[]
    probes: Array<{ path: string; ignored: boolean }>
  }
  listener5173:
    | { status: "none" }
    | { status: "listening"; pid: number; command: string }
    | { status: "unavailable" }
  fingerprint: string
}

export interface MigrationIdentity {
  courseId: string
  lessonId: string
  legacyDay: number
  source: string
  destination: string
}

export interface MigrationReplacement {
  from: string
  to: string
  expectedMatches: number
}

export type MigrationOperation =
  | { kind: "copy"; source: string; destination: string }
  | {
      kind: "rewrite"
      source: string
      destination: string
      replacements: MigrationReplacement[]
    }
  | { kind: "delete"; path: string }

export interface MigrationRequest {
  schemaVersion: 1
  ownedRoots: string[]
  identities: MigrationIdentity[]
  operations: MigrationOperation[]
}

interface PlannedWriteBase {
  source: string
  destination: string
  sourceSha256: string
  outputSha256: string
  outputSize: number
  mode: number
}

export type PlannedMigrationOperation =
  | ({ kind: "copy" } & PlannedWriteBase)
  | ({
      kind: "rewrite"
      replacements: Array<MigrationReplacement & { actualMatches: number }>
    } & PlannedWriteBase)
  | {
      kind: "delete"
      path: string
      sourceSha256: string
      mode: number
      size: number
    }

export interface MigrationPlan {
  schemaVersion: typeof PLAN_SCHEMA_VERSION
  baselineFingerprint: string
  ownedRoots: string[]
  identities: MigrationIdentity[]
  operations: PlannedMigrationOperation[]
  destinationDirectories: Array<{ path: string; existedAtPlan: boolean }>
  fingerprint: string
}

interface MigrationJournal {
  schemaVersion: typeof JOURNAL_SCHEMA_VERSION
  planFingerprint: string
  state: "applying" | "applied" | "rolled-back"
  createdDirectories: string[]
  operations: MigrationJournalOperation[]
}

type MigrationJournalOperation =
  | {
      sequence: number
      kind: "copy" | "rewrite"
      source: string
      destination: string
      status: "completed"
    }
  | {
      sequence: number
      kind: "delete"
      path: string
      status: "completed"
    }

interface BaselineOptions {
  workspace: string
  backupDirectory: string
  roots: string[]
}

interface PlanOptions {
  workspace: string
  baseline: MigrationBaseline
  request: MigrationRequest
}

interface ApplyOptions {
  workspace: string
  backupDirectory: string
  baseline: MigrationBaseline
  plan: MigrationPlan
  journalFile: string
  afterOperation?: (completedOperations: number) => void | Promise<void>
}

interface RollbackOptions {
  workspace: string
  backupDirectory: string
  baseline: MigrationBaseline
  plan: MigrationPlan
  journalFile: string
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex")
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function withoutKey<T extends object, K extends keyof T>(
  value: T,
  key: K
): Omit<T, K> {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function baselineFingerprint(
  baseline: Omit<MigrationBaseline, "fingerprint">
): string {
  return sha256(stableJson(baseline))
}

function planFingerprint(plan: Omit<MigrationPlan, "fingerprint">): string {
  return sha256(stableJson(plan))
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function normalizeRelativePath(input: string, context: string): string {
  if (
    !input ||
    input.includes("\\") ||
    containsControlCharacter(input) ||
    path.posix.isAbsolute(input)
  ) {
    throw new Error(`${context}: path must be a non-empty relative POSIX path`)
  }
  const normalized = path.posix.normalize(input)
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized !== input
  ) {
    throw new Error(`${context}: path escapes or is not normalized: ${input}`)
  }
  return normalized
}

function absolutePath(workspace: string, relative: string): string {
  const normalized = normalizeRelativePath(relative, "workspace path")
  return path.join(workspace, ...normalized.split("/"))
}

export function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

function executeBuffer(
  file: string,
  args: string[],
  cwd: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { cwd, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout))
      }
    )
  })
}

async function executeText(
  file: string,
  args: string[],
  cwd: string
): Promise<string> {
  return (await executeBuffer(file, args, cwd)).toString("utf8")
}

async function gitStatus(workspace: string): Promise<Buffer> {
  return executeBuffer(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    workspace
  )
}

async function readFileSnapshot(
  workspace: string,
  relative: string
): Promise<MigrationFileSnapshot> {
  const normalized = normalizeRelativePath(relative, "snapshot")
  const absolute = absolutePath(workspace, normalized)
  const metadata = await lstat(absolute)
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`snapshot rejects symlink or non-regular file: ${normalized}`)
  }
  const content = await readFile(absolute)
  return {
    path: normalized,
    type: "file",
    mode: metadata.mode & 0o777,
    size: content.byteLength,
    sha256: sha256(content),
  }
}

async function listRegularFiles(
  workspace: string,
  relative: string
): Promise<string[]> {
  const normalized = normalizeRelativePath(relative, "root")
  const absolute = absolutePath(workspace, normalized)
  let metadata
  try {
    metadata = await lstat(absolute)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  if (metadata.isSymbolicLink()) {
    throw new Error(`root rejects symlink: ${normalized}`)
  }
  if (metadata.isFile()) return [normalized]
  if (!metadata.isDirectory()) {
    throw new Error(`root rejects non-file entry: ${normalized}`)
  }
  const entries = await readdir(absolute, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .sort((left, right) => comparePaths(left.name, right.name))
      .map(async (entry) => {
        const child = `${normalized}/${entry.name}`
        if (entry.isSymbolicLink()) {
          throw new Error(`root rejects symlink: ${child}`)
        }
        if (entry.isDirectory()) return listRegularFiles(workspace, child)
        if (!entry.isFile()) {
          throw new Error(`root rejects non-regular file: ${child}`)
        }
        return [child]
      })
  )
  return nested.flat().sort(comparePaths)
}

async function checkIgnored(workspace: string, relative: string): Promise<boolean> {
  try {
    await executeBuffer(
      "git",
      ["check-ignore", "-q", "--no-index", "--", relative],
      workspace
    )
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException & { code?: number }).code
    if (code === 1) return false
    throw error
  }
}

async function inspectPrivacy(workspace: string) {
  const tracked = (
    await executeBuffer(
      "git",
      ["ls-files", "-z", "--", "learning-records", "courses", "exercise"],
      workspace
    )
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((file) => PRIVATE_TRACKED_PATH.test(file))
    .sort(comparePaths)
  const probes = await Promise.all(
    PRIVACY_PROBES.map(async (probe) => ({
      path: probe,
      ignored: await checkIgnored(workspace, probe),
    }))
  )
  return { trackedPaths: tracked, probes }
}

export async function inspectPortListener(
  port = 5173
): Promise<MigrationBaseline["listener5173"]> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("listener port must be an integer from 1 to 65535")
  }
  let output: string
  try {
    output = await executeText(
      "lsof",
      ["-nP", `-tiTCP:${port}`, "-sTCP:LISTEN"],
      process.cwd()
    )
  } catch (error) {
    const code = (error as NodeJS.ErrnoException & { code?: number | string })
      .code
    if (String(code) === "1") return { status: "none" }
    if (code === "ENOENT") return { status: "unavailable" }
    throw error
  }
  const first = output.trim().split(/\s+/)[0]
  if (!first) return { status: "none" }
  const pid = Number(first)
  if (!Number.isInteger(pid) || pid <= 0) return { status: "unavailable" }
  try {
    const command = (
      await executeText("ps", ["-p", String(pid), "-o", "command="], process.cwd())
    ).trim()
    return { status: "listening", pid, command }
  } catch {
    return { status: "unavailable" }
  }
}

async function assertWorkspace(workspaceInput: string): Promise<string> {
  const workspace = path.resolve(workspaceInput)
  const metadata = await lstat(workspace)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("workspace must be a non-symlink directory")
  }
  const gitDirectory = path.join(workspace, ".git")
  if (!(await pathExists(gitDirectory))) {
    throw new Error("workspace must be a Git working tree")
  }
  return workspace
}

async function copySnapshotToBackup(
  workspace: string,
  backupDirectory: string,
  snapshot: MigrationFileSnapshot
): Promise<void> {
  const target = path.join(
    backupDirectory,
    "files",
    ...snapshot.path.split("/")
  )
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(absolutePath(workspace, snapshot.path), target)
  await chmod(target, snapshot.mode)
}

export async function createMigrationBaseline(
  options: BaselineOptions
): Promise<MigrationBaseline> {
  const workspace = await assertWorkspace(options.workspace)
  const backupDirectory = path.resolve(options.backupDirectory)
  if (isPathInside(workspace, backupDirectory)) {
    throw new Error("backup directory must be outside the workspace")
  }
  if (await pathExists(backupDirectory)) {
    throw new Error("backup directory must not already exist")
  }
  const roots = [...new Set(options.roots)].map((root) =>
    normalizeRelativePath(root, "baseline root")
  )
  if (roots.length === 0) throw new Error("baseline requires at least one root")
  const rootFiles = await Promise.all(
    roots.map((root) => listRegularFiles(workspace, root))
  )
  const files = await Promise.all(
    [...new Set(rootFiles.flat())]
      .sort(comparePaths)
      .map((file) => readFileSnapshot(workspace, file))
  )
  const status = await gitStatus(workspace)
  const baselineWithoutFingerprint = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    head: (await executeText("git", ["rev-parse", "HEAD"], workspace)).trim(),
    gitStatusBase64: status.toString("base64"),
    gitStatusSha256: sha256(status),
    roots: await Promise.all(
      roots.map(async (root) => ({
        path: root,
        exists: await pathExists(absolutePath(workspace, root)),
      }))
    ),
    files,
    privacy: await inspectPrivacy(workspace),
    listener5173: await inspectPortListener(),
  }
  if (!/^[a-f0-9]{40}$/.test(baselineWithoutFingerprint.head)) {
    throw new Error("candidate HEAD must be a 40-character hexadecimal commit")
  }
  const baseline: MigrationBaseline = {
    ...baselineWithoutFingerprint,
    fingerprint: baselineFingerprint(baselineWithoutFingerprint),
  }
  await mkdir(backupDirectory, { recursive: false })
  await Promise.all(
    files.map((snapshot) =>
      copySnapshotToBackup(workspace, backupDirectory, snapshot)
    )
  )
  const serialized = stableJson(baseline)
  await writeFile(path.join(backupDirectory, "baseline.json"), serialized)
  await writeFile(
    path.join(backupDirectory, "files.sha256"),
    files
      .map((file) => `${file.sha256}  files/${file.path}\n`)
      .join("")
  )
  await writeFile(
    path.join(backupDirectory, "baseline.sha256"),
    `${sha256(serialized)}  baseline.json\n`
  )
  return baseline
}

function assertBaselineFingerprint(baseline: MigrationBaseline): void {
  if (
    baseline.schemaVersion !== BASELINE_SCHEMA_VERSION ||
    !/^[a-f0-9]{40}$/.test(baseline.head) ||
    !/^[a-f0-9]{64}$/.test(baseline.gitStatusSha256) ||
    !Array.isArray(baseline.roots) ||
    !Array.isArray(baseline.files) ||
    !baseline.privacy ||
    !Array.isArray(baseline.privacy.trackedPaths) ||
    !Array.isArray(baseline.privacy.probes)
  ) {
    throw new Error("migration baseline is invalid")
  }
  try {
    baseline.roots.forEach((root) => {
      normalizeRelativePath(root.path, "baseline root")
      if (typeof root.exists !== "boolean") throw new Error("invalid root")
    })
    baseline.files.forEach((file) => {
      normalizeRelativePath(file.path, "baseline file")
      if (
        file.type !== "file" ||
        !Number.isInteger(file.mode) ||
        file.mode < 0 ||
        file.mode > 0o777 ||
        !Number.isInteger(file.size) ||
        file.size < 0 ||
        !/^[a-f0-9]{64}$/.test(file.sha256)
      ) {
        throw new Error("invalid file")
      }
    })
    baseline.privacy.trackedPaths.forEach((relative) =>
      normalizeRelativePath(relative, "baseline tracked path")
    )
    baseline.privacy.probes.forEach((probe) => {
      normalizeRelativePath(probe.path, "baseline privacy probe")
      if (typeof probe.ignored !== "boolean") throw new Error("invalid probe")
    })
  } catch {
    throw new Error("migration baseline is invalid")
  }
  if (
    new Set(baseline.files.map((file) => file.path)).size !==
      baseline.files.length ||
    new Set(baseline.roots.map((root) => root.path)).size !==
      baseline.roots.length
  ) {
    throw new Error("migration baseline is invalid")
  }
  const actual = baselineFingerprint(withoutKey(baseline, "fingerprint"))
  if (actual !== baseline.fingerprint) {
    throw new Error("baseline fingerprint does not match its contents")
  }
}

async function assertSnapshotMatches(
  workspace: string,
  expected: MigrationFileSnapshot
): Promise<void> {
  let actual: MigrationFileSnapshot
  try {
    actual = await readFileSnapshot(workspace, expected.path)
  } catch {
    throw new Error(`baseline drift: ${expected.path}`)
  }
  if (
    actual.type !== expected.type ||
    actual.mode !== expected.mode ||
    actual.size !== expected.size ||
    actual.sha256 !== expected.sha256
  ) {
    throw new Error(`baseline drift: ${expected.path}`)
  }
}

async function assertBaselineFiles(
  workspace: string,
  baseline: MigrationBaseline
): Promise<void> {
  assertBaselineFingerprint(baseline)
  await Promise.all(
    baseline.files.map((snapshot) =>
      assertSnapshotMatches(workspace, snapshot)
    )
  )
}

function assertRequest(request: MigrationRequest): void {
  if (request.schemaVersion !== 1) {
    throw new Error("migration request schemaVersion must be 1")
  }
  if (!request.ownedRoots.length || !request.operations.length) {
    throw new Error("migration request requires owned roots and operations")
  }
  const identities = new Set<string>()
  const legacyDays = new Set<string>()
  for (const identity of request.identities) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.courseId)) {
      throw new Error(`invalid courseId: ${identity.courseId}`)
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.lessonId)) {
      throw new Error(`invalid lessonId: ${identity.lessonId}`)
    }
    if (!Number.isInteger(identity.legacyDay) || identity.legacyDay < 0) {
      throw new Error(`invalid legacy day: ${identity.legacyDay}`)
    }
    normalizeRelativePath(identity.source, "identity source")
    normalizeRelativePath(identity.destination, "identity destination")
    const key = `${identity.courseId}\0${identity.lessonId}`
    const dayKey = `${identity.courseId}\0${identity.legacyDay}`
    if (identities.has(key) || legacyDays.has(dayKey)) {
      throw new Error("duplicate migration identity or legacy day")
    }
    identities.add(key)
    legacyDays.add(dayKey)
  }
}

function countOccurrences(content: string, needle: string): number {
  if (!needle) throw new Error("rewrite replacement source must not be empty")
  let count = 0
  let offset = 0
  while (true) {
    const match = content.indexOf(needle, offset)
    if (match < 0) return count
    count += 1
    offset = match + needle.length
  }
}

function decodeUtf8(content: Buffer, relative: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content)
  } catch {
    throw new Error(`rewrite source is not valid UTF-8: ${relative}`)
  }
}

function applyReplacements(
  content: Buffer,
  relative: string,
  replacements: MigrationReplacement[]
): {
  content: Buffer
  replacements: Array<MigrationReplacement & { actualMatches: number }>
} {
  let text = decodeUtf8(content, relative)
  const inspected = replacements.map((replacement) => {
    if (
      !Number.isInteger(replacement.expectedMatches) ||
      replacement.expectedMatches < 1
    ) {
      throw new Error("rewrite expectedMatches must be a positive integer")
    }
    const actualMatches = countOccurrences(text, replacement.from)
    if (actualMatches !== replacement.expectedMatches) {
      throw new Error(
        `rewrite match count differs for ${relative}: expected ${replacement.expectedMatches}, found ${actualMatches}`
      )
    }
    text = text.split(replacement.from).join(replacement.to)
    return { ...replacement, actualMatches }
  })
  return { content: Buffer.from(text, "utf8"), replacements: inspected }
}

function isWithinOwnedRoot(relative: string, ownedRoots: string[]): boolean {
  return ownedRoots.some(
    (root) => relative === root || relative.startsWith(`${root}/`)
  )
}

function requireBaselineSnapshot(
  baseline: MigrationBaseline,
  relative: string
): MigrationFileSnapshot {
  const snapshot = baseline.files.find((file) => file.path === relative)
  if (!snapshot) {
    throw new Error(`migration source is absent from baseline backup: ${relative}`)
  }
  return snapshot
}

function assertNotesRewrite(
  operation: Extract<MigrationOperation, { kind: "rewrite" }>,
  source: string,
  destination: string,
  identities: MigrationIdentity[]
): void {
  const identity = identities.find(
    (candidate) =>
      destination ===
      `learning-records/${candidate.courseId}/lessons/${candidate.lessonId}/notes.md`
  )
  if (!identity || !source.endsWith("/notes.md")) {
    throw new Error("rewrite is only allowed for an identified Notes file")
  }
  if (operation.replacements.length !== 1) {
    throw new Error("Notes rewrite requires exactly one link replacement")
  }
  const [replacement] = operation.replacements
  if (!replacement || replacement.expectedMatches !== 1) {
    throw new Error("Notes rewrite must replace exactly one link")
  }
  const resolvedSourceLink = path.posix.normalize(
    path.posix.join(path.posix.dirname(source), replacement.from)
  )
  const canonicalLink = path.posix.relative(
    path.posix.dirname(destination),
    identity.destination
  )
  if (
    resolvedSourceLink !== identity.source ||
    replacement.to !== canonicalLink
  ) {
    throw new Error("Notes rewrite must map the legacy Lesson link to canonical identity")
  }
}

function assertSingleMarkdownLink(
  content: Buffer,
  source: string,
  replacement: MigrationReplacement
): void {
  const text = decodeUtf8(content, source)
  const token = `](${replacement.from})`
  if (countOccurrences(text, replacement.from) !== 1) {
    throw new Error("Notes rewrite source must occur exactly once")
  }
  let inFence: "```" | "~~~" | undefined
  let validLinks = 0
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trimStart()
    const fence = trimmed.startsWith("```")
      ? "```"
      : trimmed.startsWith("~~~")
        ? "~~~"
        : undefined
    if (fence) {
      inFence = inFence === fence ? undefined : inFence ?? fence
      continue
    }
    const index = line.indexOf(token)
    if (index < 0) continue
    if (
      inFence ||
      line.startsWith("    ") ||
      line.startsWith("\t") ||
      line.includes("`") ||
      line.lastIndexOf("[", index) < 0
    ) {
      throw new Error("Notes rewrite target is not a Markdown link")
    }
    validLinks += 1
  }
  if (validLinks !== 1) {
    throw new Error("Notes rewrite target is not a unique Markdown link")
  }
}

export async function planMigration(
  options: PlanOptions
): Promise<MigrationPlan> {
  const workspace = await assertWorkspace(options.workspace)
  await assertBaselineFiles(workspace, options.baseline)
  assertRequest(options.request)
  const ownedRoots = [...new Set(options.request.ownedRoots)].map((root) =>
    normalizeRelativePath(root, "owned root")
  )
  const classifiedSources = new Set<string>()
  const destinations = new Set<string>()
  const caseFoldedDestinations = new Set<string>()
  const deleted = new Set<string>()
  const plannedOperations: PlannedMigrationOperation[] = []

  for (const [index, operation] of options.request.operations.entries()) {
    if (operation.kind === "delete") {
      const relative = normalizeRelativePath(
        operation.path,
        `operations[${index}].path`
      )
      if (!isWithinOwnedRoot(relative, ownedRoots)) {
        throw new Error(`delete source is outside owned roots: ${relative}`)
      }
      if (deleted.has(relative)) throw new Error(`duplicate delete: ${relative}`)
      deleted.add(relative)
      classifiedSources.add(relative)
      requireBaselineSnapshot(options.baseline, relative)
      const source = await readFileSnapshot(workspace, relative)
      plannedOperations.push({
        kind: "delete",
        path: relative,
        sourceSha256: source.sha256,
        mode: source.mode,
        size: source.size,
      })
      continue
    }

    const sourcePath = normalizeRelativePath(
      operation.source,
      `operations[${index}].source`
    )
    const destination = normalizeRelativePath(
      operation.destination,
      `operations[${index}].destination`
    )
    if (!isWithinOwnedRoot(sourcePath, ownedRoots)) {
      throw new Error(`write source is outside owned roots: ${sourcePath}`)
    }
    requireBaselineSnapshot(options.baseline, sourcePath)
    const folded = destination.toLocaleLowerCase("en-US")
    if (destinations.has(destination) || caseFoldedDestinations.has(folded)) {
      throw new Error(`duplicate or case-colliding destination: ${destination}`)
    }
    await assertDestinationParentsSafe(workspace, destination)
    await assertNoWorkspaceCaseCollision(workspace, destination)
    if (await pathExists(absolutePath(workspace, destination))) {
      throw new Error(`migration destination already exists: ${destination}`)
    }
    if (
      PRIVATE_DESTINATION.test(destination) &&
      !(await checkIgnored(workspace, destination))
    ) {
      throw new Error(`private destination is not ignored: ${destination}`)
    }
    destinations.add(destination)
    caseFoldedDestinations.add(folded)
    classifiedSources.add(sourcePath)
    const source = await readFileSnapshot(workspace, sourcePath)
    const input = await readFile(absolutePath(workspace, sourcePath))
    if (operation.kind === "copy") {
      plannedOperations.push({
        kind: "copy",
        source: sourcePath,
        destination,
        sourceSha256: source.sha256,
        outputSha256: source.sha256,
        outputSize: source.size,
        mode: source.mode,
      })
    } else {
      assertNotesRewrite(
        operation,
        sourcePath,
        destination,
        options.request.identities
      )
      assertSingleMarkdownLink(input, sourcePath, operation.replacements[0]!)
      const rewritten = applyReplacements(
        input,
        sourcePath,
        operation.replacements
      )
      plannedOperations.push({
        kind: "rewrite",
        source: sourcePath,
        destination,
        sourceSha256: source.sha256,
        outputSha256: sha256(rewritten.content),
        outputSize: rewritten.content.byteLength,
        mode: source.mode,
        replacements: rewritten.replacements,
      })
    }
  }

  const ownedFiles = (
    await Promise.all(
      ownedRoots.map((root) => listRegularFiles(workspace, root))
    )
  )
    .flat()
    .sort(comparePaths)
  const unclassified = ownedFiles.filter(
    (file) => !classifiedSources.has(file)
  )
  if (unclassified.length) {
    throw new Error(`unclassified migration files: ${unclassified.join(", ")}`)
  }

  for (const identity of options.request.identities) {
    const hasWrite = plannedOperations.some(
      (operation) =>
        operation.kind !== "delete" &&
        operation.source === identity.source &&
        operation.destination === identity.destination
    )
    if (!hasWrite) {
      throw new Error(
        `identity has no matching write operation: ${identity.courseId}/${identity.lessonId}`
      )
    }
  }

  const destinationDirectoryPaths = new Set<string>()
  for (const operation of plannedOperations) {
    if (operation.kind === "delete") continue
    let parent = path.posix.dirname(operation.destination)
    while (parent !== ".") {
      destinationDirectoryPaths.add(parent)
      parent = path.posix.dirname(parent)
    }
  }
  const destinationDirectories = await Promise.all(
    [...destinationDirectoryPaths].sort(comparePaths).map(async (relative) => ({
      path: relative,
      existedAtPlan: await inspectSafeDirectory(
        absolutePath(workspace, relative),
        relative
      ),
    }))
  )

  const planWithoutFingerprint = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    baselineFingerprint: options.baseline.fingerprint,
    ownedRoots,
    identities: structuredClone(options.request.identities),
    operations: plannedOperations,
    destinationDirectories,
  }
  return {
    ...planWithoutFingerprint,
    fingerprint: planFingerprint(planWithoutFingerprint),
  }
}

function assertPlanFingerprint(plan: MigrationPlan): void {
  if (
    plan.schemaVersion !== PLAN_SCHEMA_VERSION ||
    !/^[a-f0-9]{64}$/.test(plan.baselineFingerprint) ||
    !Array.isArray(plan.ownedRoots) ||
    !Array.isArray(plan.identities) ||
    !Array.isArray(plan.operations) ||
    !Array.isArray(plan.destinationDirectories)
  ) {
    throw new Error("migration plan is invalid")
  }
  try {
    plan.ownedRoots.forEach((root) => normalizeRelativePath(root, "plan root"))
    plan.identities.forEach((identity) => {
      normalizeRelativePath(identity.source, "plan identity source")
      normalizeRelativePath(identity.destination, "plan identity destination")
    })
    plan.operations.forEach((operation) => {
      if (operation.kind === "delete") {
        normalizeRelativePath(operation.path, "plan delete path")
      } else if (operation.kind === "copy" || operation.kind === "rewrite") {
        normalizeRelativePath(operation.source, "plan source")
        normalizeRelativePath(operation.destination, "plan destination")
      } else {
        throw new Error("invalid operation")
      }
    })
    plan.destinationDirectories.forEach((directory) => {
      normalizeRelativePath(directory.path, "plan destination directory")
      if (typeof directory.existedAtPlan !== "boolean") {
        throw new Error("invalid directory")
      }
    })
  } catch {
    throw new Error("migration plan is invalid")
  }
  if (
    new Set(plan.destinationDirectories.map((directory) => directory.path))
      .size !== plan.destinationDirectories.length
  ) {
    throw new Error("migration plan is invalid")
  }
  const actual = planFingerprint(withoutKey(plan, "fingerprint"))
  if (actual !== plan.fingerprint) {
    throw new Error("migration plan fingerprint does not match its contents")
  }
}

async function assertBackup(
  backupDirectory: string,
  baseline: MigrationBaseline
): Promise<void> {
  const serialized = await readFile(
    path.join(backupDirectory, "baseline.json"),
    "utf8"
  )
  if (serialized !== stableJson(baseline)) {
    throw new Error("backup baseline manifest differs from the active baseline")
  }
  const checksum = await readFile(
    path.join(backupDirectory, "baseline.sha256"),
    "utf8"
  )
  if (checksum !== `${sha256(serialized)}  baseline.json\n`) {
    throw new Error("backup baseline checksum is invalid")
  }
  const fileManifest = await readFile(
    path.join(backupDirectory, "files.sha256"),
    "utf8"
  )
  const expectedFileManifest = baseline.files
    .map((file) => `${file.sha256}  files/${file.path}\n`)
    .join("")
  if (fileManifest !== expectedFileManifest) {
    throw new Error("backup file hash manifest is invalid")
  }
  await Promise.all(
    baseline.files.map(async (snapshot) => {
      const backup = path.join(
        backupDirectory,
        "files",
        ...snapshot.path.split("/")
      )
      const metadata = await lstat(backup)
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new Error(`backup file is not regular: ${snapshot.path}`)
      }
      const content = await readFile(backup)
      if (
        content.byteLength !== snapshot.size ||
        sha256(content) !== snapshot.sha256
      ) {
        throw new Error(`backup hash differs: ${snapshot.path}`)
      }
    })
  )
}

async function assertBaselineState(
  workspace: string,
  baseline: MigrationBaseline
): Promise<void> {
  await assertBaselineFiles(workspace, baseline)
  const head = (await executeText("git", ["rev-parse", "HEAD"], workspace)).trim()
  const status = await gitStatus(workspace)
  if (
    head !== baseline.head ||
    sha256(status) !== baseline.gitStatusSha256 ||
    status.toString("base64") !== baseline.gitStatusBase64
  ) {
    throw new Error("baseline drift: Git HEAD or working-tree status changed")
  }
}

async function createDirectories(
  workspace: string,
  destination: string,
  created: Set<string>
): Promise<void> {
  const parent = path.posix.dirname(destination)
  if (parent === ".") return
  const parts = parent.split("/")
  let current = ""
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    const absolute = absolutePath(workspace, current)
    if (!(await inspectSafeDirectory(absolute, current))) {
      await mkdir(absolute)
      created.add(current)
    }
  }
}

async function inspectSafeDirectory(
  absolute: string,
  relative: string
): Promise<boolean> {
  let metadata
  try {
    metadata = await lstat(absolute)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`destination parent is unsafe: ${relative}`)
  }
  return true
}

async function assertDestinationParentsSafe(
  workspace: string,
  destination: string
): Promise<void> {
  const parent = path.posix.dirname(destination)
  if (parent === ".") return
  let current = ""
  for (const part of parent.split("/")) {
    current = current ? `${current}/${part}` : part
    const absolute = absolutePath(workspace, current)
    if (!(await inspectSafeDirectory(absolute, current))) return
  }
}

async function assertNoWorkspaceCaseCollision(
  workspace: string,
  destination: string
): Promise<void> {
  let current = workspace
  for (const segment of destination.split("/")) {
    const entries = await readdir(current)
    const exact = entries.find((entry) => entry === segment)
    const folded = segment.toLocaleLowerCase("en-US")
    const collision = entries.find(
      (entry) =>
        entry !== segment && entry.toLocaleLowerCase("en-US") === folded
    )
    if (collision) {
      throw new Error(
        `destination case-collides with workspace path: ${destination}`
      )
    }
    if (!exact) return
    const next = path.join(current, exact)
    const metadata = await lstat(next)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) return
    current = next
  }
}

async function assertOwnedFilesMatchPlan(
  workspace: string,
  plan: MigrationPlan
): Promise<void> {
  const actual = (
    await Promise.all(
      plan.ownedRoots.map((root) => listRegularFiles(workspace, root))
    )
  )
    .flat()
    .sort(comparePaths)
  const expected = [
    ...new Set(
      plan.operations.map((operation) =>
        operation.kind === "delete" ? operation.path : operation.source
      )
    ),
  ].sort(comparePaths)
  const unexpected = actual.filter((file) => !expected.includes(file))
  if (unexpected.length) {
    throw new Error(`unclassified migration files: ${unexpected.join(", ")}`)
  }
  const missing = expected.filter((file) => !actual.includes(file))
  if (missing.length) {
    throw new Error(`baseline drift: missing migration files: ${missing.join(", ")}`)
  }
}

async function assertDestinationDirectoryBaseline(
  workspace: string,
  plan: MigrationPlan
): Promise<void> {
  for (const directory of plan.destinationDirectories) {
    const exists = await inspectSafeDirectory(
      absolutePath(workspace, directory.path),
      directory.path
    )
    if (exists !== directory.existedAtPlan) {
      throw new Error(`baseline drift: destination directory ${directory.path}`)
    }
  }
}

async function writeJournal(
  journalFile: string,
  journal: MigrationJournal
): Promise<void> {
  const resolved = path.resolve(journalFile)
  const temporary = `${resolved}.tmp-${randomUUID()}`
  await mkdir(path.dirname(resolved), { recursive: true })
  try {
    await writeFile(temporary, stableJson(journal), { flag: "wx" })
    await rename(temporary, resolved)
  } finally {
    await rm(temporary, { force: true })
  }
}

async function readJournal(journalFile: string): Promise<MigrationJournal> {
  const value = JSON.parse(await readFile(journalFile, "utf8")) as unknown
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
    !("planFingerprint" in value) ||
    typeof value.planFingerprint !== "string" ||
    !("state" in value) ||
    !["applying", "applied", "rolled-back"].includes(String(value.state)) ||
    !("createdDirectories" in value) ||
    !Array.isArray(value.createdDirectories) ||
    !("operations" in value) ||
    !Array.isArray(value.operations) ||
    !value.operations.every((operation, index) => {
      if (
        typeof operation !== "object" ||
        operation === null ||
        !("sequence" in operation) ||
        operation.sequence !== index + 1 ||
        !("status" in operation) ||
        operation.status !== "completed" ||
        !("kind" in operation) ||
        !["copy", "rewrite", "delete"].includes(String(operation.kind))
      ) {
        return false
      }
      return operation.kind === "delete"
        ? "path" in operation && typeof operation.path === "string"
        : "source" in operation &&
            typeof operation.source === "string" &&
            "destination" in operation &&
            typeof operation.destination === "string"
    })
  ) {
    throw new Error("migration journal is invalid")
  }
  const journal = value as MigrationJournal
  try {
    journal.createdDirectories.forEach((directory) => {
      if (typeof directory !== "string") throw new Error("invalid path")
      normalizeRelativePath(directory, "journal created directory")
    })
    journal.operations.forEach((operation) => {
      if (operation.kind === "delete") {
        normalizeRelativePath(operation.path, "journal delete path")
      } else {
        normalizeRelativePath(operation.source, "journal source")
        normalizeRelativePath(operation.destination, "journal destination")
      }
    })
  } catch {
    throw new Error("migration journal is invalid")
  }
  if (new Set(journal.createdDirectories).size !== journal.createdDirectories.length) {
    throw new Error("migration journal is invalid")
  }
  return journal
}

function journalOperation(
  operation: PlannedMigrationOperation,
  sequence: number
): MigrationJournalOperation {
  return operation.kind === "delete"
    ? {
        sequence,
        kind: "delete",
        path: operation.path,
        status: "completed",
      }
    : {
        sequence,
        kind: operation.kind,
        source: operation.source,
        destination: operation.destination,
        status: "completed",
      }
}

function assertJournalMatchesPlan(
  journal: MigrationJournal,
  plan: MigrationPlan
): void {
  const physicalOperations = [
    ...plan.operations.filter((operation) => operation.kind !== "delete"),
    ...plan.operations.filter((operation) => operation.kind === "delete"),
  ]
  if (
    journal.operations.length > physicalOperations.length ||
    (journal.state === "applied" &&
      journal.operations.length !== physicalOperations.length)
  ) {
    throw new Error("migration journal operation log differs from plan")
  }
  for (const [index, operation] of journal.operations.entries()) {
    const expected = journalOperation(physicalOperations[index]!, index + 1)
    if (stableJson(operation) !== stableJson(expected)) {
      throw new Error("migration journal operation log differs from plan")
    }
  }
  const removableDirectories = new Set(
    plan.destinationDirectories
      .filter((directory) => !directory.existedAtPlan)
      .map((directory) => directory.path)
  )
  if (
    journal.createdDirectories.some(
      (directory) => !removableDirectories.has(directory)
    )
  ) {
    throw new Error("migration journal created directories differ from plan")
  }
}

async function restoreFromBackup(
  workspace: string,
  backupDirectory: string,
  baseline: MigrationBaseline,
  plan: MigrationPlan,
  createdDirectories: string[]
): Promise<void> {
  const writeOperations = plan.operations.filter(
    (operation): operation is Exclude<PlannedMigrationOperation, { kind: "delete" }> =>
      operation.kind !== "delete"
  )
  const deletedSources = [
    ...new Set(
      plan.operations
        .filter(
          (operation): operation is Extract<PlannedMigrationOperation, { kind: "delete" }> =>
            operation.kind === "delete"
        )
        .map((operation) => operation.path)
    ),
  ].sort(comparePaths)

  for (const operation of writeOperations) {
    await assertNoWorkspaceCaseCollision(workspace, operation.destination)
    await assertDestinationParentsSafe(workspace, operation.destination)
    let actual: MigrationFileSnapshot | undefined
    try {
      actual = await readFileSnapshot(workspace, operation.destination)
    } catch (error) {
      if ((error as Error).message.includes("snapshot rejects")) {
        throw new Error(`rollback drift: ${operation.destination}`)
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    if (
      actual &&
      (actual.sha256 !== operation.outputSha256 ||
        actual.size !== operation.outputSize ||
        actual.mode !== operation.mode)
    ) {
      throw new Error(`rollback drift: ${operation.destination}`)
    }
  }
  for (const relative of deletedSources) {
    await assertDestinationParentsSafe(workspace, relative)
    const snapshot = requireBaselineSnapshot(baseline, relative)
    try {
      const actual = await readFileSnapshot(workspace, relative)
      if (
        actual.sha256 !== snapshot.sha256 ||
        actual.size !== snapshot.size ||
        actual.mode !== snapshot.mode
      ) {
        throw new Error(`rollback drift: ${relative}`)
      }
    } catch (error) {
      if ((error as Error).message.startsWith("rollback drift")) throw error
      if ((error as Error).message.includes("snapshot rejects")) {
        throw new Error(`rollback drift: ${relative}`)
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }

  await Promise.all(
    writeOperations.map((operation) =>
      rm(absolutePath(workspace, operation.destination), { force: true })
    )
  )
  for (const relative of deletedSources) {
    const snapshot = requireBaselineSnapshot(baseline, relative)
    const destination = absolutePath(workspace, relative)
    if (!(await pathExists(destination))) {
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(
        path.join(backupDirectory, "files", ...relative.split("/")),
        destination
      )
      await chmod(destination, snapshot.mode)
    }
  }
  for (const directory of [...createdDirectories].sort(
    (left, right) => right.length - left.length || comparePaths(right, left)
  )) {
    try {
      await rmdir(absolutePath(workspace, directory))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
}

async function stageWrite(
  workspace: string,
  stageDirectory: string,
  operation: Exclude<PlannedMigrationOperation, { kind: "delete" }>,
  index: number
): Promise<string> {
  const source = await readFile(absolutePath(workspace, operation.source))
  if (sha256(source) !== operation.sourceSha256) {
    throw new Error(`baseline drift: ${operation.source}`)
  }
  const output =
    operation.kind === "copy"
      ? source
      : applyReplacements(
          source,
          operation.source,
          operation.replacements.map(
            ({ from, to, expectedMatches }) => ({ from, to, expectedMatches })
          )
        ).content
  if (
    output.byteLength !== operation.outputSize ||
    sha256(output) !== operation.outputSha256
  ) {
    throw new Error(`planned output hash differs: ${operation.destination}`)
  }
  const staged = path.join(stageDirectory, String(index))
  await writeFile(staged, output, { mode: operation.mode })
  return staged
}

export async function applyMigrationPlan(options: ApplyOptions): Promise<void> {
  const workspace = await assertWorkspace(options.workspace)
  const journalFile = path.resolve(options.journalFile)
  if (isPathInside(workspace, journalFile)) {
    throw new Error("migration journal must remain outside the workspace")
  }
  if (await pathExists(journalFile)) {
    throw new Error("migration journal already exists")
  }
  assertPlanFingerprint(options.plan)
  assertBaselineFingerprint(options.baseline)
  if (options.plan.baselineFingerprint !== options.baseline.fingerprint) {
    throw new Error("migration plan belongs to a different baseline")
  }
  await assertBackup(path.resolve(options.backupDirectory), options.baseline)
  await assertBaselineState(workspace, options.baseline)
  await assertOwnedFilesMatchPlan(workspace, options.plan)
  await assertDestinationDirectoryBaseline(workspace, options.plan)
  const writeOperations = options.plan.operations.filter(
    (operation): operation is Exclude<PlannedMigrationOperation, { kind: "delete" }> =>
      operation.kind !== "delete"
  )
  for (const operation of writeOperations) {
    await assertDestinationParentsSafe(workspace, operation.destination)
    if (await pathExists(absolutePath(workspace, operation.destination))) {
      throw new Error(
        `migration destination appeared after planning: ${operation.destination}`
      )
    }
    if (
      PRIVATE_DESTINATION.test(operation.destination) &&
      !(await checkIgnored(workspace, operation.destination))
    ) {
      throw new Error(
        `private destination is not ignored: ${operation.destination}`
      )
    }
  }

  const lockPath = path.join(workspace, LOCK_FILE)
  const lock = await open(lockPath, "wx")
  let stageDirectory: string | undefined
  const createdDirectories = new Set<string>()
  const journal: MigrationJournal = {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    planFingerprint: options.plan.fingerprint,
    state: "applying",
    createdDirectories: [],
    operations: [],
  }
  let completedOperations = 0
  try {
    const activeStageDirectory = await mkdtemp(
      path.join(workspace, ".migration-stage-")
    )
    stageDirectory = activeStageDirectory
    const staged = await Promise.all(
      writeOperations.map((operation, index) =>
        stageWrite(workspace, activeStageDirectory, operation, index)
      )
    )
    await writeJournal(journalFile, journal)
    for (const [index, operation] of writeOperations.entries()) {
      await createDirectories(
        workspace,
        operation.destination,
        createdDirectories
      )
      journal.createdDirectories = [...createdDirectories]
      await writeJournal(journalFile, journal)
      const destination = absolutePath(workspace, operation.destination)
      await rename(staged[index], destination)
      await chmod(destination, operation.mode)
      completedOperations += 1
      journal.operations.push(journalOperation(operation, completedOperations))
      await writeJournal(journalFile, journal)
      await options.afterOperation?.(completedOperations)
    }
    for (const operation of options.plan.operations) {
      if (operation.kind !== "delete") continue
      await rm(absolutePath(workspace, operation.path))
      completedOperations += 1
      journal.operations.push(journalOperation(operation, completedOperations))
      await writeJournal(journalFile, journal)
      await options.afterOperation?.(completedOperations)
    }
    journal.state = "applied"
    journal.createdDirectories = [...createdDirectories]
    await writeJournal(journalFile, journal)
  } catch (error) {
    await restoreFromBackup(
      workspace,
      path.resolve(options.backupDirectory),
      options.baseline,
      options.plan,
      [...createdDirectories]
    )
    journal.state = "rolled-back"
    journal.createdDirectories = [...createdDirectories]
    await writeJournal(journalFile, journal)
    throw error
  } finally {
    if (stageDirectory) {
      await rm(stageDirectory, { recursive: true, force: true })
    }
    await lock.close()
    await rm(lockPath, { force: true })
  }
}

export async function rollbackMigration(
  options: RollbackOptions
): Promise<void> {
  const workspace = await assertWorkspace(options.workspace)
  const journalFile = path.resolve(options.journalFile)
  if (isPathInside(workspace, journalFile)) {
    throw new Error("migration journal must remain outside the workspace")
  }
  assertPlanFingerprint(options.plan)
  assertBaselineFingerprint(options.baseline)
  await assertBackup(path.resolve(options.backupDirectory), options.baseline)
  const journal = await readJournal(journalFile)
  if (journal.planFingerprint !== options.plan.fingerprint) {
    throw new Error("migration journal belongs to a different plan")
  }
  assertJournalMatchesPlan(journal, options.plan)
  if (journal.state === "rolled-back") {
    await assertBaselineState(workspace, options.baseline)
    return
  }
  const lockPath = path.join(workspace, LOCK_FILE)
  const lock = await open(lockPath, "wx")
  try {
    await restoreFromBackup(
      workspace,
      path.resolve(options.backupDirectory),
      options.baseline,
      options.plan,
      journal.createdDirectories
    )
    journal.state = "rolled-back"
    await writeJournal(journalFile, journal)
  } finally {
    await lock.close()
    await rm(lockPath, { force: true })
  }
  await assertBaselineState(workspace, options.baseline)
}
