import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import {
  lstat,
  readFile,
  realpath,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { inflateSync } from "node:zlib"

export const REQUIRED_EVIDENCE = [
  {
    state: "desktop-normal",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "desktop-zen",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "desktop-zen-day",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "desktop-zen-reader",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "mobile-normal",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    state: "mobile-zen",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    state: "mobile-zen-day",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    state: "mobile-zen-reader",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    state: "desktop-course-select",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "desktop-nondefault-normal",
    cssViewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    state: "mobile-course-select",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    state: "mobile-nondefault-normal",
    cssViewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
] as const

const ROADMAP_ROOT_FILES = new Set([
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  "DEPLOYMENT.md",
  "README.md",
  "components.json",
  "eslint.config.js",
  "index.html",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.app.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "vercel.json",
  "vite.config.ts",
  "vitest.config.ts",
])
const ROADMAP_FINGERPRINT_DIRECTORIES = ["content", "scripts", "src", "tests"]
const EVALUATION_SKILL_DIRECTORIES = [
  ".agents/skills/evaluate-course-lesson",
  ".agents/skills/evaluate-go-day",
]
const PRIVATE_LEGACY_COURSE = "roadmap/src/data/course.json"

interface PngStats {
  width: number
  height: number
  nonBlank: boolean
}

export interface CandidateFingerprint {
  sha256: string
  fileCount: number
}

export interface E2eEvidenceManifest {
  schemaVersion: 3
  runId: string
  candidate: {
    head: string
    workingTreeFingerprint: string
    fingerprintFileCount: number
  }
  images: Array<{
    state: string
    file: string
    cssViewport: { width: number; height: number }
    deviceScaleFactor: number
    pixelSize: { width: number; height: number }
    bytes: number
    sha256: string
    nonBlank: true
  }>
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/")
}

function isWithinDirectory(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  )
}

async function repositoryRealRoot(repositoryRoot: string): Promise<string> {
  const metadata = await lstat(repositoryRoot)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("候选指纹要求 repositoryRoot 为普通目录")
  }
  return realpath(repositoryRoot)
}

async function assertContainedDirectory(
  repositoryRoot: string,
  relativeDirectory: string
): Promise<string> {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory)
  const metadata = await lstat(absoluteDirectory)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`候选指纹要求普通目录：${relativeDirectory}`)
  }
  const [realRoot, realDirectory] = await Promise.all([
    repositoryRealRoot(repositoryRoot),
    realpath(absoluteDirectory),
  ])
  if (!isWithinDirectory(realRoot, realDirectory)) {
    throw new Error(`候选指纹目录越界：${relativeDirectory}`)
  }
  return absoluteDirectory
}

async function listRegularFiles(
  repositoryRoot: string,
  relativeDirectory: string
): Promise<string[]> {
  const absoluteDirectory = await assertContainedDirectory(
    repositoryRoot,
    relativeDirectory
  )
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = toPosix(path.join(relativeDirectory, entry.name))
      if (entry.isSymbolicLink()) {
        throw new Error(`候选指纹拒绝符号链接：${relative}`)
      }
      if (entry.isDirectory()) {
        return listRegularFiles(repositoryRoot, relative)
      }
      if (!entry.isFile()) {
        throw new Error(`候选指纹拒绝非普通文件：${relative}`)
      }
      return [relative]
    })
  )
  return nested.flat()
}

async function optionalRegularFile(
  repositoryRoot: string,
  relativePath: string
): Promise<string[]> {
  try {
    const absoluteFile = path.join(repositoryRoot, relativePath)
    const metadata = await lstat(absoluteFile)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`候选指纹要求普通文件：${relativePath}`)
    }
    const [realRoot, realFile] = await Promise.all([
      repositoryRealRoot(repositoryRoot),
      realpath(absoluteFile),
    ])
    if (!isWithinDirectory(realRoot, realFile)) {
      throw new Error(`候选指纹文件越界：${relativePath}`)
    }
    return [relativePath]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

async function collectCandidateFiles(repositoryRoot: string): Promise<string[]> {
  const rootFiles = await optionalRegularFile(repositoryRoot, ".vercelignore")
  const roadmapRootFiles = (
    await Promise.all(
      [...ROADMAP_ROOT_FILES].map((file) =>
        optionalRegularFile(repositoryRoot, `roadmap/${file}`)
      )
    )
  ).flat()
  const roadmapTrees = await Promise.all(
    ROADMAP_FINGERPRINT_DIRECTORIES.map((directory) =>
      listRegularFiles(repositoryRoot, `roadmap/${directory}`)
    )
  )
  const workflowDirectory = await assertContainedDirectory(
    repositoryRoot,
    ".github/workflows"
  )
  const workflowEntries = await readdir(workflowDirectory, {
    withFileTypes: true,
  })
  const workflows = (
    await Promise.all(
      workflowEntries
        .filter((entry) => /^roadmap-.*\.ya?ml$/.test(entry.name))
        .map((entry) =>
          optionalRegularFile(
            repositoryRoot,
            `.github/workflows/${entry.name}`
          )
        )
    )
  ).flat()
  const evaluationSkills = await Promise.all(
    EVALUATION_SKILL_DIRECTORIES.map((directory) =>
      listRegularFiles(repositoryRoot, directory)
    )
  )
  const lessons = (
    await listRegularFiles(repositoryRoot, "docs/go-learning/daily-lessons")
  ).filter((file) => /\/day-\d{2}-.+\.md$/.test(file))
  const lessonDays = lessons.map((file) => Number(file.match(/\/day-(\d{2})-/)?.[1]))
  const expectedDays = Array.from({ length: 37 }, (_, day) => day)
  if (
    lessonDays.length !== expectedDays.length ||
    [...lessonDays].sort((left, right) => left - right).some(
      (day, index) => day !== expectedDays[index]
    )
  ) {
    throw new Error("候选指纹必须包含且只能映射 Day 0–36 的 37 篇教程输入")
  }
  const files = [
    ...rootFiles,
    ...roadmapRootFiles,
    ...roadmapTrees.flat(),
    ...workflows,
    ...lessons,
    ...evaluationSkills.flat(),
  ]
    .filter((file) => file !== PRIVATE_LEGACY_COURSE)
    .sort()
  if (!files.includes("roadmap/package.json") || workflows.length === 0) {
    throw new Error("候选指纹缺少 roadmap 配置或工作流")
  }
  return files
}

export async function createCandidateFingerprint(
  repositoryRoot: string
): Promise<CandidateFingerprint> {
  const files = await collectCandidateFiles(repositoryRoot)
  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(file)
    hash.update("\0")
    hash.update(await readFile(path.join(repositoryRoot, file)))
    hash.update("\0")
  }
  return { sha256: hash.digest("hex"), fileCount: files.length }
}

function resolveCandidateHead(
  repositoryRoot: string,
  explicitCandidateHead?: string
): string {
  let candidate = explicitCandidateHead?.trim()
  if (!candidate) {
    try {
      candidate = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    } catch {
      throw new Error(
        "E2E_CANDIDATE_HEAD 未提供，且当前无 .git 副本无法读取候选 HEAD"
      )
    }
  }
  if (!/^[a-fA-F0-9]{40}$/.test(candidate)) {
    throw new Error("E2E_CANDIDATE_HEAD 必须是 40 位十六进制提交标识")
  }
  return candidate.toLowerCase()
}

export function validateEvidenceFileNames(
  files: string[],
  includeManifest = false
): void {
  const expected = [
    ...REQUIRED_EVIDENCE.map(({ state }) => `${state}.png`),
    ...(includeManifest ? ["evidence-manifest.json"] : []),
  ].sort()
  const actual = [...files].sort()
  if (
    actual.length !== expected.length ||
    actual.some((file, index) => file !== expected[index])
  ) {
    throw new Error(
      `截图证据必须且只能包含 ${REQUIRED_EVIDENCE.length} 个规定状态：${actual.join(", ")}`
    )
  }
}

const EVIDENCE_MANIFEST_FILE = "evidence-manifest.json"

async function assertReplaceableEvidenceManifest(
  evidenceDirectory: string
): Promise<void> {
  try {
    const metadata = await lstat(
      path.join(evidenceDirectory, EVIDENCE_MANIFEST_FILE)
    )
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("旧 E2E 证据清单必须是普通文件且不得为符号链接")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
}

export async function writeE2eEvidenceManifestAtomically(
  evidenceDirectory: string,
  serialized: string
): Promise<void> {
  await assertReplaceableEvidenceManifest(evidenceDirectory)
  const outputFile = path.join(evidenceDirectory, EVIDENCE_MANIFEST_FILE)
  const temporaryFile = `${outputFile}.tmp`
  let temporaryCreated = false
  try {
    await writeFile(temporaryFile, serialized, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    })
    temporaryCreated = true
    await rename(temporaryFile, outputFile)
    temporaryCreated = false
  } finally {
    if (temporaryCreated) await rm(temporaryFile, { force: true })
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const diagonalDistance = Math.abs(estimate - upLeft)
  if (leftDistance <= upDistance && leftDistance <= diagonalDistance) return left
  return upDistance <= diagonalDistance ? up : upLeft
}

function readPngStats(file: Buffer): PngStats {
  if (!file.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    throw new Error("截图不是合法 PNG")
  }
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const imageData: Buffer[] = []
  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString("ascii", offset + 4, offset + 8)
    const data = file.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === "IDAT") {
      imageData.push(data)
    } else if (type === "IEND") {
      break
    }
    offset += length + 12
  }
  const channels = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]).get(colorType)
  if (!width || !height || bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error("截图 PNG 格式不在可审计范围")
  }
  const inflated = inflateSync(Buffer.concat(imageData))
  const stride = width * channels
  if (inflated.byteLength !== (stride + 1) * height) {
    throw new Error("截图 PNG 像素数据长度异常")
  }
  let cursor = 0
  let previous = Buffer.alloc(stride)
  let minimum = 255
  let maximum = 0
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[cursor]
    cursor += 1
    const current = Buffer.alloc(stride)
    for (let column = 0; column < stride; column += 1) {
      const source = inflated[cursor]
      cursor += 1
      const left = column >= channels ? current[column - channels] : 0
      const up = previous[column]
      const upLeft = column >= channels ? previous[column - channels] : 0
      const value =
        filter === 0
          ? source
          : filter === 1
            ? source + left
            : filter === 2
              ? source + up
              : filter === 3
                ? source + Math.floor((left + up) / 2)
                : filter === 4
                  ? source + paeth(left, up, upLeft)
                  : Number.NaN
      if (!Number.isFinite(value)) throw new Error("截图 PNG 使用未知过滤器")
      current[column] = value & 0xff
      const colorChannel = column % channels
      if (colorType === 0 || colorChannel < Math.min(channels, 3)) {
        minimum = Math.min(minimum, current[column])
        maximum = Math.max(maximum, current[column])
      }
    }
    previous = current
  }
  return { width, height, nonBlank: maximum - minimum >= 16 }
}

async function inspectE2eEvidenceManifest(
  evidenceDirectory: string,
  repositoryRoot: string,
  runId: string,
  explicitCandidateHead: string | undefined,
  includeManifest: boolean
): Promise<E2eEvidenceManifest> {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("E2E_RUN_ID 只能包含字母、数字、点、下划线和连字符")
  }
  const directoryFiles = await readdir(evidenceDirectory)
  if (!includeManifest && directoryFiles.includes(EVIDENCE_MANIFEST_FILE)) {
    await assertReplaceableEvidenceManifest(evidenceDirectory)
  }
  validateEvidenceFileNames(
    includeManifest
      ? directoryFiles
      : directoryFiles.filter((file) => file !== EVIDENCE_MANIFEST_FILE),
    includeManifest
  )
  const candidateHead = resolveCandidateHead(repositoryRoot, explicitCandidateHead)
  const candidateFingerprint = await createCandidateFingerprint(repositoryRoot)
  const images = await Promise.all(
    REQUIRED_EVIDENCE.map(
      async ({ state, cssViewport, deviceScaleFactor }) => {
        const fileName = `${state}.png`
        const content = await readFile(path.join(evidenceDirectory, fileName))
        const stats = readPngStats(content)
        const expectedWidth = cssViewport.width * deviceScaleFactor
        const expectedHeight = cssViewport.height * deviceScaleFactor
        if (stats.width !== expectedWidth || stats.height !== expectedHeight) {
          throw new Error(
            `截图 CSS×DPR 尺寸错误：${fileName} 应为 ${expectedWidth}×${expectedHeight}，实际 ${stats.width}×${stats.height}`
          )
        }
        if (content.byteLength < 1_000 || !stats.nonBlank) {
          throw new Error(`截图为空白或文件异常：${fileName}`)
        }
        return {
          state,
          file: fileName,
          cssViewport: { ...cssViewport },
          deviceScaleFactor,
          pixelSize: { width: stats.width, height: stats.height },
          bytes: content.byteLength,
          sha256: createHash("sha256").update(content).digest("hex"),
          nonBlank: true as const,
        }
      }
    )
  )
  return {
    schemaVersion: 3,
    runId,
    candidate: {
      head: candidateHead,
      workingTreeFingerprint: candidateFingerprint.sha256,
      fingerprintFileCount: candidateFingerprint.fileCount,
    },
    images,
  }
}

export async function createE2eEvidenceManifest(
  evidenceDirectory: string,
  repositoryRoot: string,
  runId: string,
  explicitCandidateHead?: string
): Promise<E2eEvidenceManifest> {
  return inspectE2eEvidenceManifest(
    evidenceDirectory,
    repositoryRoot,
    runId,
    explicitCandidateHead,
    false
  )
}

export async function auditE2eEvidenceManifest(
  manifest: E2eEvidenceManifest,
  evidenceDirectory: string,
  repositoryRoot: string,
  explicitCandidateHead?: string
): Promise<void> {
  const inspected = await inspectE2eEvidenceManifest(
    evidenceDirectory,
    repositoryRoot,
    manifest.runId,
    explicitCandidateHead,
    true
  )
  if (JSON.stringify(inspected) !== JSON.stringify(manifest)) {
    throw new Error("E2E 证据清单与当前截图或候选内容不一致")
  }
}
