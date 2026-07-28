import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { buildPublicArtifacts } from "./public-course.ts"
import { createPublicCourseFixture } from "./public-course.test-fixture.ts"
import {
  auditPrebuiltPackage,
  packagePrebuiltOutput,
  PREBUILT_CONFIG,
  SOURCE_DEPLOYMENT_DISABLED_IGNORE,
} from "./prebuilt-package.ts"

const temporaryDirectories: string[] = []

async function fixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "roadmap-prebuilt-package-")
  )
  temporaryDirectories.push(repositoryRoot)
  const roadmapDirectory = path.join(repositoryRoot, "roadmap")
  const distDirectory = path.join(roadmapDirectory, "dist")
  const expectedPublicDirectory = path.join(
    roadmapDirectory,
    ".generated/public"
  )
  const outputDirectory = path.join(roadmapDirectory, ".vercel/output")
  const assetManifestFile = path.join(
    roadmapDirectory,
    ".generated/vite-asset-manifest.json"
  )
  const manifestFile = path.join(
    roadmapDirectory,
    ".generated/prebuilt-manifest.json"
  )
  await createPublicCourseFixture(repositoryRoot)
  await writeFile(
    path.join(repositoryRoot, ".vercelignore"),
    SOURCE_DEPLOYMENT_DISABLED_IGNORE
  )
  await buildPublicArtifacts({
    repositoryRoot,
    outputDirectory: expectedPublicDirectory,
  })
  await buildPublicArtifacts({ repositoryRoot, outputDirectory: distDirectory })
  await writeFile(
    path.join(distDirectory, "index.html"),
    '<div id="root"></div><script src="/assets/app-AaBb1234.js"></script>'
  )
  await mkdir(path.join(distDirectory, "assets"))
  await writeFile(
    path.join(distDirectory, "assets/app-AaBb1234.js"),
    'export const font = "/assets/font-AaBb1234.woff2"'
  )
  await writeFile(
    path.join(distDirectory, "assets/font-AaBb1234.woff2"),
    Buffer.from("wOF2fixture")
  )
  await writeFile(
    assetManifestFile,
    JSON.stringify({
      "index.html": {
        file: "assets/app-AaBb1234.js",
        isEntry: true,
        assets: ["assets/font-AaBb1234.woff2"],
      },
    })
  )
  return {
    repositoryRoot,
    distDirectory,
    expectedPublicDirectory,
    assetManifestFile,
    outputDirectory,
    manifestFile,
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("Vercel Build Output API v3 预构建包", () => {
  it("只打包 config.json 与 audited dist 的 static 镜像且双次确定", async () => {
    const paths = await fixture()
    const first = await packagePrebuiltOutput(paths)
    const second = await packagePrebuiltOutput(paths)
    const audited = await auditPrebuiltPackage(paths)

    expect(first).toEqual(second)
    expect(audited).toEqual(first)
    expect(first.files).toHaveLength(82)
    expect(first.files[0].path).toBe("config.json")
    expect(
      first.files.every(
        (file) => file.path === "config.json" || file.path.startsWith("static/")
      )
    ).toBe(true)
    expect(first.files.some((file) => file.path.includes("vite-manifest"))).toBe(
      false
    )
    expect(
      first.files.some((file) =>
        /(?:^|\/)(?:src|scripts|tests|docs|exercise|output)(?:\/|$)|\.test\./.test(
          file.path
        )
      )
    ).toBe(false)
    expect(
      JSON.parse(
        await readFile(path.join(paths.outputDirectory, "config.json"), "utf8")
      )
    ).toEqual(PREBUILT_CONFIG)
    expect(
      PREBUILT_CONFIG.routes[0].headers["Content-Security-Policy"]
    ).toContain("connect-src 'self' https://api.github.com")
    const filesystem = PREBUILT_CONFIG.routes.findIndex(
      (route) => "handle" in route && route.handle === "filesystem"
    )
    const courseSpaFallback = PREBUILT_CONFIG.routes.findIndex(
      (route) =>
        "dest" in route &&
        route.dest === "/index.html" &&
        route.src.includes("/courses/")
    )
    expect(courseSpaFallback).toBeGreaterThan(0)
    expect(courseSpaFallback).toBeLessThan(filesystem)
    const courseRoute = PREBUILT_CONFIG.routes[courseSpaFallback]
    expect("src" in courseRoute && new RegExp(courseRoute.src).test(
      "/courses/editor-engineering"
    )).toBe(true)
    expect("src" in courseRoute && new RegExp(courseRoute.src).test(
      "/courses/editor-engineering/"
    )).toBe(true)
    expect("src" in courseRoute && new RegExp(courseRoute.src).test(
      "/courses/editor-engineering/course.json"
    )).toBe(false)
    expect("src" in courseRoute && new RegExp(courseRoute.src).test(
      "/courses/editor.engineering"
    )).toBe(false)
    expect(
      PREBUILT_CONFIG.routes.some((route) => "status" in route)
    ).toBe(false)
    expect(
      PREBUILT_CONFIG.routes.filter(
        (route) => "dest" in route && route.dest === "/index.html"
      )
    ).toHaveLength(1)
    expect(PREBUILT_CONFIG.routes).toHaveLength(5)
  })

  it("拒绝预构建目录中的额外文件、source map 与符号链接", async () => {
    const extra = await fixture()
    await packagePrebuiltOutput(extra)
    await mkdir(path.join(extra.outputDirectory, "scripts"))
    await writeFile(path.join(extra.outputDirectory, "scripts/leak.test.ts"), "x")
    await expect(auditPrebuiltPackage(extra)).rejects.toThrow("额外或缺失")

    const sourceMap = await fixture()
    await packagePrebuiltOutput(sourceMap)
    await writeFile(path.join(sourceMap.outputDirectory, "static/app.js.map"), "{}")
    await expect(auditPrebuiltPackage(sourceMap)).rejects.toThrow("source map")

    const linked = await fixture()
    await packagePrebuiltOutput(linked)
    await symlink(
      path.join(linked.distDirectory, "index.html"),
      path.join(linked.outputDirectory, "static/link.html")
    )
    await expect(auditPrebuiltPackage(linked)).rejects.toThrow("符号链接")
  })

  it("根 .vercelignore 必须关闭 source deployment", async () => {
    const paths = await fixture()
    await writeFile(path.join(paths.repositoryRoot, ".vercelignore"), "node_modules\n")
    await expect(packagePrebuiltOutput(paths)).rejects.toThrow(
      "source deployment 必须保持关闭"
    )
  })
})
