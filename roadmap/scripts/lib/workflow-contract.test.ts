import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
)
const workflowDirectory = path.join(repositoryRoot, ".github/workflows")
const workflowFile = path.join(workflowDirectory, "roadmap-release.yml")

async function releaseWorkflow(): Promise<string> {
  return readFile(workflowFile, "utf8")
}

function jobSource(source: string, jobName: string): string {
  const start = source.indexOf(`  ${jobName}:\n`)
  expect(start).toBeGreaterThanOrEqual(0)
  const followingJob = source.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/)
  return source.slice(start, followingJob === -1 ? undefined : start + 1 + followingJob)
}

describe("Roadmap 受审 prebuilt 发布工作流", () => {
  it("只保留一个全事件、无 paths 过滤的发布入口", async () => {
    expect((await readdir(workflowDirectory)).filter((file) => file.startsWith("roadmap-"))).toEqual([
      "roadmap-release.yml",
    ])
    const source = await releaseWorkflow()
    expect(source).toContain("pull_request:")
    expect(source).toContain("push:")
    expect(source).toContain("branches: [main]")
    expect(source).toContain("workflow_dispatch:")
    expect(source).toContain("candidate_sha:")
    expect(source).not.toContain("paths:")
    expect(source).not.toContain("deployment_status:")
  })

  it("让每个候选先经过完整 gate，再传递唯一 audited prebuilt", async () => {
    const source = await releaseWorkflow()
    expect(source).toContain("npm run verify:release")
    expect(source).toContain("roadmap-prebuilt-${{ needs.candidate.outputs.sha }}")
    expect(source).toContain(".vercel/output")
    expect(source).toContain(".generated/prebuilt-manifest.json")
    expect(source).toContain(".generated/release-receipt.json")
    expect(source).toContain("if-no-files-found: error")
    expect(source).toContain("retention-days: 7")
    expect(source).toContain("candidateHead")
    expect(source).toContain("catalogDigest")
    expect(source).toContain("prebuiltDigest")
  })

  it("隔离 fork、固定 action 与 CLI，且 Production 保留 staged/promote/rollback 链", async () => {
    const source = await releaseWorkflow()
    expect(source).toContain("github.event.pull_request.head.repo.fork == false")
    expect(source).toContain("roadmap-preview")
    expect(source).toContain("roadmap-production")
    expect(source).toContain("--prebuilt")
    expect(source).toContain("--prod --skip-domain")
    expect(source).toContain("vercel promote")
    expect(source).toContain("vercel rollback")
    expect(source).toContain("smoke-rollback-production:")
    expect(source).toContain(
      "needs: [candidate, deploy-staged-production, smoke-staged-production]"
    )
    expect(source).toContain(
      "needs: [candidate, promote-production, smoke-production]"
    )
    expect(source).toContain("needs: [candidate, rollback-production]")
    expect(source).toContain(
      "always() && needs.rollback-production.result == 'success'"
    )
    expect(source).toContain("npm ci --ignore-scripts")
    expect(source).not.toContain("npx vercel")
    expect(source).not.toMatch(/uses:\s+[^\n]+@v\d+/)
    for (const action of [
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
      "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
    ]) {
      expect(source).toContain(action)
    }

    for (const deploymentJob of [
      "deploy-preview",
      "deploy-staged-production",
      "promote-production",
      "rollback-production",
    ]) {
      const job = jobSource(source, deploymentJob)
      expect(job).not.toContain("actions/checkout")
      expect(job).toContain("npm ci --ignore-scripts")
    }

    for (const deploymentJob of ["deploy-preview", "deploy-staged-production"]) {
      const job = jobSource(source, deploymentJob)
      expect(job).toContain("Verify downloaded audited artifact")
      expect(job).toContain("vercel inspect")
      expect(job).toContain("api.vercel.com/v13/deployments")
    }

    const promote = jobSource(source, "promote-production")
    expect(promote).toContain("previous_url")
    expect(promote).toContain("go-together-roadmap.vercel.app")
    expect(promote).toContain("vercel inspect")
    expect(promote).toContain("outputs:")

    const rollback = jobSource(source, "rollback-production")
    expect(rollback).toContain(
      "${{ needs.promote-production.outputs.previous_url }}"
    )
  })
})
