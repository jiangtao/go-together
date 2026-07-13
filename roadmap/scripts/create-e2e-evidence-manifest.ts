import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  auditE2eEvidenceManifest,
  createE2eEvidenceManifest,
  type E2eEvidenceManifest,
} from "./lib/e2e-evidence.ts"

const roadmapDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const repositoryRoot = path.resolve(roadmapDirectory, "..")
const evidenceDirectory = path.resolve(
  roadmapDirectory,
  process.env.E2E_EVIDENCE_DIR ?? ".generated/e2e-evidence"
)

try {
  await mkdir(evidenceDirectory, { recursive: true })
  const provisionalRunId = process.env.E2E_RUN_ID ?? "local-evidence"
  const manifest = await createE2eEvidenceManifest(
    evidenceDirectory,
    repositoryRoot,
    provisionalRunId,
    process.env.E2E_CANDIDATE_HEAD
  )
  if (!process.env.E2E_RUN_ID) {
    manifest.runId = `local-${manifest.candidate.workingTreeFingerprint.slice(0, 16)}`
  }
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  const outputFile = path.join(evidenceDirectory, "evidence-manifest.json")
  await writeFile(outputFile, serialized, "utf8")
  const writtenManifest = JSON.parse(
    await readFile(outputFile, "utf8")
  ) as E2eEvidenceManifest
  await auditE2eEvidenceManifest(
    writtenManifest,
    evidenceDirectory,
    repositoryRoot,
    process.env.E2E_CANDIDATE_HEAD
  )
  console.log(
    `E2E 证据清单通过：8 张非空截图，run ${manifest.runId}，manifest sha256 ${createHash("sha256").update(serialized).digest("hex")}`
  )
} catch (error) {
  console.error("E2E 证据清单失败：", error)
  process.exitCode = 1
}
