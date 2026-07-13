import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { auditPublicDirectory, type AuditTarget } from "./lib/public-audit.ts"
import {
  buildPublicArtifacts,
  GENERATED_PUBLIC_DIRECTORY,
  ROADMAP_DIRECTORY,
} from "./lib/public-course.ts"

const requestedTarget = process.argv[2] ?? "generated"
if (requestedTarget !== "generated" && requestedTarget !== "dist") {
  console.error("公开产物审计失败：参数必须是 generated 或 dist")
  process.exitCode = 1
} else {
  const target = requestedTarget as AuditTarget
  const directory =
    target === "generated"
      ? GENERATED_PUBLIC_DIRECTORY
      : path.join(ROADMAP_DIRECTORY, "dist")
  const expectedDirectory = await mkdtemp(
    path.join(os.tmpdir(), "roadmap-public-audit-expected-")
  )
  try {
    await buildPublicArtifacts({ outputDirectory: expectedDirectory })
    const report = await auditPublicDirectory(
      directory,
      target,
      expectedDirectory,
      target === "dist"
        ? path.join(ROADMAP_DIRECTORY, ".generated/vite-asset-manifest.json")
        : undefined
    )
    console.log(
      `${target} 审计通过：${report.files} 个文件，${report.lessons} 篇教程，扫描 ${report.textFilesScanned} 个文本文件`
    )
  } catch (error) {
    console.error(`${target} 审计失败：`, error)
    process.exitCode = 1
  } finally {
    await rm(expectedDirectory, { recursive: true, force: true })
  }
}
