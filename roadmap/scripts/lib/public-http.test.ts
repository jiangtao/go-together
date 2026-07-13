import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"
import { createServer, type ViteDevServer } from "vite"

import { buildPublicArtifacts } from "./public-course.ts"
import { strictPublicFilesPlugin } from "./strict-public-files.ts"

const temporaryDirectories: string[] = []
const servers: ViteDevServer[] = []

async function buildFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-http-"))
  temporaryDirectories.push(root)
  const lessonsDirectory = path.join(root, "input/lessons")
  const progressFile = path.join(root, "input/progress.public.json")
  const outputDirectory = path.join(root, "public")
  const webRoot = path.join(root, "web")
  await mkdir(lessonsDirectory, { recursive: true })
  await mkdir(webRoot)
  await writeFile(path.join(webRoot, "index.html"), '<div id="root"></div>')
  await writeFile(
    progressFile,
    JSON.stringify(
      Array.from({ length: 37 }, (_, day) => ({
        day,
        status: "未开始",
        referenceScore: null,
      }))
    )
  )
  await Promise.all(
    Array.from({ length: 37 }, (_, day) => {
      const padded = String(day).padStart(2, "0")
      return writeFile(
        path.join(lessonsDirectory, `day-${padded}-lesson-${padded}.md`),
        `# Day ${padded}：Lesson ${day}\n\n### 学习目标\n\n- Goal ${day}\n`
      )
    })
  )
  await buildPublicArtifacts({ lessonsDirectory, progressFile, outputDirectory })
  const server = await createServer({
    configFile: false,
    root: webRoot,
    publicDir: outputDirectory,
    plugins: [strictPublicFilesPlugin(outputDirectory)],
    appType: "spa",
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  })
  servers.push(server)
  await server.listen()
  const address = server.httpServer!.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${address.port}`,
    outputDirectory,
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("开发 HTTP 公开契约", () => {
  it("serves canonical and legacy data with correct MIME and fails unknown files as 404", async () => {
    const { origin } = await buildFixture()
    const checks = [
      ["/courses/catalog.json", "application/json"],
      ["/courses/go-backend/course.json", "application/json"],
      ["/courses/go-backend/progress.json", "application/json"],
      [
        "/courses/go-backend/sources/lessons/lesson-00.md",
        "text/markdown",
      ],
      ["/course.json", "application/json"],
      ["/sources/lessons/day-00-lesson-00.md", "text/markdown"],
    ] as const
    for (const [pathname, mime] of checks) {
      const response = await fetch(`${origin}${pathname}`, {
        headers: { accept: mime },
      })
      expect(response.status, pathname).toBe(200)
      expect(response.headers.get("content-type"), pathname).toContain(mime)
    }

    for (const pathname of ["/", "/courses/go-backend"]) {
      const response = await fetch(`${origin}${pathname}`, {
        headers: { accept: "text/html" },
      })
      expect(response.status, pathname).toBe(200)
      expect(await response.text()).toContain('id="root"')
    }

    for (const pathname of [
      "/courses/unknown/course.json",
      "/courses/GO-BACKEND/course.json",
      "/Courses/go-backend/course.json",
      "/courses/go-backend/sources/lessons/unknown.md",
      "/courses/go-backend/sources%2flessons/missing.md",
      "/sources/lessons/day-99-unknown.md",
      "/SOURCES/lessons/day-00-lesson-00.md",
      "/sources%2flessons/missing.md",
      "/COURSE.JSON",
      "/vite-manifest.json",
    ]) {
      const response = await fetch(`${origin}${pathname}`, {
        headers: { accept: "text/html" },
      })
      expect(response.status, pathname).toBe(404)
      expect(response.headers.get("content-type"), pathname).not.toContain(
        "text/html"
      )
    }
  })

  it("rejects public-path symlinks that resolve outside the public root", async () => {
    const { origin, outputDirectory } = await buildFixture()
    const linked = path.join(
      outputDirectory,
      "courses/go-backend/sources/lessons/linked.md"
    )
    await symlink("/etc/hosts", linked)

    const response = await fetch(
      `${origin}/courses/go-backend/sources/lessons/linked.md`,
      { headers: { accept: "text/markdown" } }
    )
    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not Found")
  })
})
