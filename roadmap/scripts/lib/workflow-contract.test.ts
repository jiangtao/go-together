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

describe("Roadmap 纯托管质量工作流", () => {
  it("只保留一个全事件、无 paths 过滤的质量入口", async () => {
    expect((await readdir(workflowDirectory)).filter((file) => file.startsWith("roadmap-"))).toEqual([
      "roadmap-release.yml",
    ])
    const source = await releaseWorkflow()
    expect(source).toContain("pull_request:")
    expect(source).toContain("push:")
    expect(source).toContain("branches: [main]")
    expect(source).toContain("workflow_dispatch:")
    expect(source).not.toContain("candidate_sha:")
    expect(source).not.toContain("paths:")
    expect(source).not.toContain("deployment_status:")
    const jobs = source.slice(source.indexOf("jobs:\n") + "jobs:\n".length)
    expect(jobs.match(/^ {2}[a-z][\w-]*:$/gm)).toEqual(["  quality:"])
  })

  it("以 lint 为必需门禁，并保留无浏览器检查与审计制品", async () => {
    const source = await releaseWorkflow()
    const quality = jobSource(source, "quality")
    expect(quality).toContain("npm run lint")
    expect(quality).toContain("npm run typecheck")
    expect(quality).toContain("npm run test")
    expect(quality).toContain("npm run build:hosting")
    expect(quality).toContain("roadmap-prebuilt-${{ github.sha }}")
    expect(quality).toContain("roadmap/.vercel/output")
    expect(quality).toContain("roadmap/.generated/prebuilt-manifest.json")
    expect(quality).toContain("roadmap/.generated/public/courses/catalog.json")
    expect(quality).toContain("if-no-files-found: error")
    expect(quality).toContain("retention-days: 7")
    expect(quality).toContain("include-hidden-files: true")
  })

  it("不安装或运行 Playwright/E2E，也不持有发布认证与部署职责", async () => {
    const source = await releaseWorkflow()
    expect(source.toLowerCase()).not.toContain("playwright")
    expect(source).not.toContain("test:e2e")
    expect(source).not.toContain("verify:release")
    expect(source).not.toContain("npm run smoke:deployment")
    expect(source).not.toContain("VERCEL_TOKEN")
    expect(source).not.toContain("VERCEL_ORG_ID")
    expect(source).not.toContain("VERCEL_PROJECT_ID")
    expect(source).not.toContain("vercel deploy")
    expect(source).not.toContain("vercel promote")
    expect(source).not.toContain("vercel rollback")
    expect(source).not.toContain("environment:")
    expect(source).not.toMatch(/^ {2}(?:deploy|promote|rollback|smoke)-/m)
    expect(source).not.toMatch(/uses:\s+[^\n]+@v\d+/)
    for (const action of [
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    ]) {
      expect(source).toContain(action)
    }
    expect(source).not.toContain("actions/download-artifact")
  })
})
