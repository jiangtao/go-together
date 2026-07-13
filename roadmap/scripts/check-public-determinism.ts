import { createHash } from "node:crypto"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { buildPublicArtifacts } from "./lib/public-course.ts"

async function manifest(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) return manifest(root, entryPath)
        const content = await readFile(entryPath)
        return [
          `${path.relative(root, entryPath).split(path.sep).join("/")} ${createHash("sha256").update(content).digest("hex")}`,
        ]
      })
  )
  return nested.flat()
}

const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "roadmap-determinism-")
)
try {
  const firstDirectory = path.join(temporaryRoot, "first")
  const secondDirectory = path.join(temporaryRoot, "second")
  await buildPublicArtifacts({ outputDirectory: firstDirectory })
  await buildPublicArtifacts({ outputDirectory: secondDirectory })
  const first = await manifest(firstDirectory)
  const second = await manifest(secondDirectory)
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("双次生成文件清单或 SHA-256 不一致")
  }
  console.log(`确定性检查通过：${first.length} 个文件逐字节一致`)
} catch (error) {
  console.error("确定性检查失败：", error)
  process.exitCode = 1
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
