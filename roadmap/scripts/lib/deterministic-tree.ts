import { createHash } from "node:crypto"
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

export interface DeterministicTreeFile {
  path: string
  bytes: number
  sha256: string
}

export function assertNoCaseCollisions(paths: string[]): void {
  const folded = new Set<string>()
  for (const candidate of paths) {
    const lower = candidate.toLocaleLowerCase("en-US")
    if (folded.has(lower)) {
      throw new Error(`确定性文件树拒绝大小写碰撞：${candidate}`)
    }
    folded.add(lower)
  }
}

async function collectFiles(
  root: string,
  directory: string
): Promise<DeterministicTreeFile[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      const metadata = await lstat(absolute)
      if (metadata.isSymbolicLink()) {
        throw new Error(`确定性文件树拒绝符号链接：${relative}`)
      }
      if (metadata.isDirectory()) return collectFiles(root, absolute)
      if (!metadata.isFile()) {
        throw new Error(`确定性文件树拒绝非普通文件：${relative}`)
      }
      const content = await readFile(absolute)
      return [
        {
          path: relative,
          bytes: content.byteLength,
          sha256: createHash("sha256").update(content).digest("hex"),
        },
      ]
    })
  )
  return nested.flat()
}

export async function inspectDeterministicTree(
  root: string
): Promise<DeterministicTreeFile[]> {
  const metadata = await lstat(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("确定性文件树根必须是非符号链接普通目录")
  }
  const files = (await collectFiles(root, root)).sort((left, right) =>
    left.path.localeCompare(right.path)
  )
  assertNoCaseCollisions(files.map((file) => file.path))
  return files
}

export async function writeJsonAtomically(
  outputFile: string,
  value: unknown
): Promise<void> {
  await mkdir(path.dirname(outputFile), { recursive: true })
  try {
    const metadata = await lstat(outputFile)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error("旧 JSON 输出必须是普通文件且不得为符号链接")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const temporary = `${outputFile}.${process.pid}.tmp`
  let created = false
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
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
