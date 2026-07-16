import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  inspectDeterministicTree,
  writeJsonAtomically,
} from "./lib/deterministic-tree.ts"
import { buildPublicArtifacts } from "./lib/public-course.ts"

const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "roadmap-determinism-")
)
const outputFile = path.resolve(".generated/determinism-manifest.json")
try {
  await rm(outputFile, { force: true })
  const firstDirectory = path.join(temporaryRoot, "first")
  const secondDirectory = path.join(temporaryRoot, "second")
  await buildPublicArtifacts({ outputDirectory: firstDirectory })
  await buildPublicArtifacts({ outputDirectory: secondDirectory })
  const first = await inspectDeterministicTree(firstDirectory)
  const second = await inspectDeterministicTree(secondDirectory)
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("双次生成文件路径、大小或 SHA-256 不一致")
  }
  await writeJsonAtomically(outputFile, { schemaVersion: 1, files: first })
  console.log(`确定性检查通过：${first.length} 个文件逐字节一致`)
} catch (error) {
  await rm(outputFile, { force: true })
  console.error("确定性检查失败：", error)
  process.exitCode = 1
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
