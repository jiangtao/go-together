import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { auditPublicDirectory } from "./public-audit.ts"
import { buildPublicArtifacts } from "./public-course.ts"

const temporaryDirectories: string[] = []

async function generatedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "roadmap-public-audit-"))
  temporaryDirectories.push(root)
  const lessonsDirectory = path.join(root, "input/lessons")
  const progressFile = path.join(root, "input/progress.public.json")
  const outputDirectory = path.join(root, "public")
  const expectedDirectory = path.join(root, "expected")
  const assetManifestFile = path.join(root, "vite-asset-manifest.json")
  await mkdir(lessonsDirectory, { recursive: true })
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
        `# Day ${padded}：课程 ${day}\n\n### 学习目标\n\n- 完成目标 ${day}\n`
      )
    })
  )
  await buildPublicArtifacts({ lessonsDirectory, progressFile, outputDirectory })
  await buildPublicArtifacts({
    lessonsDirectory,
    progressFile,
    outputDirectory: expectedDirectory,
  })
  return { root, outputDirectory, expectedDirectory, assetManifestFile }
}

async function writeViteManifest(
  assetManifestFile: string,
  file: string,
  assets: string[] = [],
  extra: Record<string, unknown> = {}
): Promise<void> {
  await writeFile(
    assetManifestFile,
    JSON.stringify({
      "index.html": { file, isEntry: true, assets, ...extra },
    })
  )
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("公开产物审计", () => {
  it("接受生成目录和 Vite dist 白名单", async () => {
    const fixture = await generatedFixture()
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "generated",
        fixture.expectedDirectory
      )
    ).resolves.toMatchObject({ files: 78, lessons: 74 })

    await writeFile(
      path.join(fixture.outputDirectory, "index.html"),
      '<div id="root"></div><script src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(fixture.outputDirectory, "assets"))
    await writeFile(
      path.join(fixture.outputDirectory, "assets/app-AaBb1234.js"),
      'export const font = "/assets/font-AaBb1234.woff2"'
    )
    await writeFile(
      path.join(fixture.outputDirectory, "assets/font-AaBb1234.woff2"),
      Buffer.from("wOF2fixture")
    )
    await writeViteManifest(
      fixture.assetManifestFile,
      "assets/app-AaBb1234.js",
      ["assets/font-AaBb1234.woff2"]
    )
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "dist",
        fixture.expectedDirectory,
        fixture.assetManifestFile
      )
    ).resolves.toMatchObject({ files: 81, lessons: 74 })
  })

  it("拒绝 source map、旧 schema 字段、私有路径和额外教程", async () => {
    const sourceMap = await generatedFixture()
    await writeFile(path.join(sourceMap.outputDirectory, "assets.map"), "{}")
    await expect(
      auditPublicDirectory(
        sourceMap.outputDirectory,
        "generated",
        sourceMap.expectedDirectory
      )
    ).rejects.toThrow("source map")

    const privatePath = await generatedFixture()
    await writeFile(
      path.join(
        privatePath.outputDirectory,
        "sources/lessons/day-00-lesson-00.md"
      ),
      "private/notes-eval.md"
    )
    await expect(
      auditPublicDirectory(
        privatePath.outputDirectory,
        "generated",
        privatePath.expectedDirectory
      )
    ).rejects.toThrow("笔记或评测文件名")

    const localUrl = await generatedFixture()
    await writeFile(
      path.join(localUrl.outputDirectory, "sources/lessons/day-00-lesson-00.md"),
      "file:///private/course.md"
    )
    await expect(
      auditPublicDirectory(
        localUrl.outputDirectory,
        "generated",
        localUrl.expectedDirectory
      )
    ).rejects.toThrow("本地文件协议")

    const extraLesson = await generatedFixture()
    await writeFile(
      path.join(
        extraLesson.outputDirectory,
        "sources/lessons/day-00-extra.md"
      ),
      "# Day 00：额外"
    )
    await expect(
      auditPublicDirectory(
        extraLesson.outputDirectory,
        "generated",
        extraLesson.expectedDirectory
      )
    ).rejects.toThrow("白名单不一致")
  })

  it.each([
    ["rubric 变体", "### Capstone-Rubric\n\n| 维度 | 证据 |"],
    ["参考答案", "### 参考答案\n\n这里给出标准实现。"],
    ["评测结果", "### 评测结果\n\n得分 100。"],
    ["教程治理路径", "请写入 `docs/go-learning/private.md`。"],
    ["旧课程路径", "读取 `roadmap/src/data/course.json`。"],
  ])("拒绝教程中的%s", async (_name, forbiddenContent) => {
    const fixture = await generatedFixture()
    await writeFile(
      path.join(fixture.outputDirectory, "sources/lessons/day-00-lesson-00.md"),
      `# Day 00：课程 0\n\n${forbiddenContent}\n`
    )
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "generated",
        fixture.expectedDirectory
      )
    ).rejects.toThrow("命中禁止内容")
  })

  it("同时审计 course.json 中的公开目标与完成标准", async () => {
    const fixture = await generatedFixture()
    const coursePath = path.join(fixture.outputDirectory, "course.json")
    const course = JSON.parse(await readFile(coursePath, "utf8")) as {
      lessons: Array<{ objective: string; goals: string[] }>
    }
    course.lessons[0].objective = "Use the grading criteria as the answer key."
    course.lessons[0].goals = ["完成公开课程"]
    await writeFile(coursePath, JSON.stringify(course))
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "generated",
        fixture.expectedDirectory
      )
    ).rejects.toThrow("答案或评测材料")
  })

  it("拒绝额外资源、资源私密材料和 Catalog 元数据漂移", async () => {
    const extra = await generatedFixture()
    const extraResource = path.join(
      extra.outputDirectory,
      "courses/go-backend/sources/resources/leak.txt"
    )
    await mkdir(path.dirname(extraResource), { recursive: true })
    await writeFile(extraResource, "apparently safe")
    await expect(
      auditPublicDirectory(
        extra.outputDirectory,
        "generated",
        extra.expectedDirectory
      )
    ).rejects.toThrow("正向生成白名单")

    const privateResource = await generatedFixture()
    const relativeResource =
      "courses/go-backend/sources/resources/guide.txt"
    for (const [directory, content] of [
      [privateResource.expectedDirectory, "safe guide"],
      [privateResource.outputDirectory, "model answer and grading criteria"],
    ] as const) {
      const resource = path.join(directory, relativeResource)
      await mkdir(path.dirname(resource), { recursive: true })
      await writeFile(resource, content)
    }
    await expect(
      auditPublicDirectory(
        privateResource.outputDirectory,
        "generated",
        privateResource.expectedDirectory
      )
    ).rejects.toThrow("答案或评测材料")

    const metadata = await generatedFixture()
    const catalogPath = path.join(
      metadata.outputDirectory,
      "courses/catalog.json"
    )
    const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as {
      courses: Array<{ title: string }>
    }
    catalog.courses[0].title = "Drifted title"
    await writeFile(catalogPath, JSON.stringify(catalog))
    await expect(
      auditPublicDirectory(
        metadata.outputDirectory,
        "generated",
        metadata.expectedDirectory
      )
    ).rejects.toThrow("声明不一致")
  })

  it("拒绝 dist 文本 asset 中的私密学习材料与未引用 asset", async () => {
    const privateAsset = await generatedFixture()
    await writeFile(
      path.join(privateAsset.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(privateAsset.outputDirectory, "assets"))
    await writeFile(
      path.join(privateAsset.outputDirectory, "assets/app-AaBb1234.js"),
      'const content = "model answer and grading criteria"'
    )
    await writeViteManifest(
      privateAsset.assetManifestFile,
      "assets/app-AaBb1234.js"
    )
    await expect(
      auditPublicDirectory(
        privateAsset.outputDirectory,
        "dist",
        privateAsset.expectedDirectory,
        privateAsset.assetManifestFile
      )
    ).rejects.toThrow("答案或评测材料")

    const unreferencedAsset = await generatedFixture()
    await writeFile(
      path.join(unreferencedAsset.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(unreferencedAsset.outputDirectory, "assets"))
    await writeFile(
      path.join(unreferencedAsset.outputDirectory, "assets/app-AaBb1234.js"),
      "export {}"
    )
    await writeFile(
      path.join(unreferencedAsset.outputDirectory, "assets/leak-AaBb1234.js"),
      "export const safe = true"
    )
    await writeViteManifest(
      unreferencedAsset.assetManifestFile,
      "assets/app-AaBb1234.js"
    )
    await expect(
      auditPublicDirectory(
        unreferencedAsset.outputDirectory,
        "dist",
        unreferencedAsset.expectedDirectory,
        unreferencedAsset.assetManifestFile
      )
    ).rejects.toThrow("未由 Vite manifest 覆盖")
  })

  it("拒绝 Vite manifest 声明的缺失 asset", async () => {
    const fixture = await generatedFixture()
    await writeFile(
      path.join(fixture.outputDirectory, "index.html"),
      '<script type="module" src="/assets/missing-AaBb1234.js"></script>'
    )
    await writeFile(
      fixture.assetManifestFile,
      JSON.stringify({
        "index.html": {
          file: "assets/missing-AaBb1234.js",
          isEntry: true,
        },
      })
    )
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "dist",
        fixture.expectedDirectory,
        fixture.assetManifestFile
      )
    ).rejects.toThrow("引用缺失")
  })

  it("拒绝 manifest 中由注释伪引用的无效二进制 asset", async () => {
    const fixture = await generatedFixture()
    await writeFile(
      path.join(fixture.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(fixture.outputDirectory, "assets"))
    await writeFile(
      path.join(fixture.outputDirectory, "assets/app-AaBb1234.js"),
      "// /assets/leak-AaBb1234.png"
    )
    await writeFile(
      path.join(fixture.outputDirectory, "assets/leak-AaBb1234.png"),
      "private bytes"
    )
    await writeViteManifest(
      fixture.assetManifestFile,
      "assets/app-AaBb1234.js",
      ["assets/leak-AaBb1234.png"]
    )
    await expect(
      auditPublicDirectory(
        fixture.outputDirectory,
        "dist",
        fixture.expectedDirectory,
        fixture.assetManifestFile
      )
    ).rejects.toThrow("magic bytes")
  })

  it("拒绝 manifest import、JS import 与 CSS 引用中的传递缺失", async () => {
    const manifestImport = await generatedFixture()
    await writeFile(
      path.join(manifestImport.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(manifestImport.outputDirectory, "assets"))
    await writeFile(
      path.join(manifestImport.outputDirectory, "assets/app-AaBb1234.js"),
      "export {}"
    )
    await writeViteManifest(manifestImport.assetManifestFile, "assets/app-AaBb1234.js", [], {
      imports: ["_missing.js"],
    })
    await expect(
      auditPublicDirectory(
        manifestImport.outputDirectory,
        "dist",
        manifestImport.expectedDirectory,
        manifestImport.assetManifestFile
      )
    ).rejects.toThrow("manifest import entry 缺失")

    const javascriptImport = await generatedFixture()
    await writeFile(
      path.join(javascriptImport.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(javascriptImport.outputDirectory, "assets"))
    await writeFile(
      path.join(javascriptImport.outputDirectory, "assets/app-AaBb1234.js"),
      'import "./missing-AaBb1234.js"'
    )
    await writeViteManifest(
      javascriptImport.assetManifestFile,
      "assets/app-AaBb1234.js"
    )
    await expect(
      auditPublicDirectory(
        javascriptImport.outputDirectory,
        "dist",
        javascriptImport.expectedDirectory,
        javascriptImport.assetManifestFile
      )
    ).rejects.toThrow("JS/CSS 引用缺失")

    const cssReference = await generatedFixture()
    await writeFile(
      path.join(cssReference.outputDirectory, "index.html"),
      '<link rel="stylesheet" href="/assets/app-AaBb1234.css">'
    )
    await mkdir(path.join(cssReference.outputDirectory, "assets"))
    await writeFile(
      path.join(cssReference.outputDirectory, "assets/app-AaBb1234.css"),
      '@import "./missing-AaBb1234.css"; .hero { background: url("./missing-AaBb1234.png") }'
    )
    await writeViteManifest(
      cssReference.assetManifestFile,
      "assets/app-AaBb1234.css"
    )
    await expect(
      auditPublicDirectory(
        cssReference.outputDirectory,
        "dist",
        cssReference.expectedDirectory,
        cssReference.assetManifestFile
      )
    ).rejects.toThrow("JS/CSS 引用缺失")

    for (const [extension, content, expectedError] of [
      ["js", 'const target = "./missing.js"; import(target)', "动态 import"],
      ["js", 'import "/missing.js"', "JS/CSS 引用缺失"],
      ["css", '.hero { background: url("/missing.png") }', "JS/CSS 引用缺失"],
    ] as const) {
      const fixture = await generatedFixture()
      const entry = `assets/app-AaBb1234.${extension}`
      await writeFile(
        path.join(fixture.outputDirectory, "index.html"),
        extension === "js"
          ? `<script type="module" src="/${entry}"></script>`
          : `<link rel="stylesheet" href="/${entry}">`
      )
      await mkdir(path.join(fixture.outputDirectory, "assets"))
      await writeFile(path.join(fixture.outputDirectory, entry), content)
      await writeViteManifest(fixture.assetManifestFile, entry)
      await expect(
        auditPublicDirectory(
          fixture.outputDirectory,
          "dist",
          fixture.expectedDirectory,
          fixture.assetManifestFile
        )
      ).rejects.toThrow(expectedError)
    }
  })

  it("拒绝空入口、未哈希 asset 与不可达 manifest entry", async () => {
    const emptyEntry = await generatedFixture()
    await writeFile(path.join(emptyEntry.outputDirectory, "index.html"), "<main></main>")
    await mkdir(path.join(emptyEntry.outputDirectory, "assets"))
    await writeFile(
      path.join(emptyEntry.outputDirectory, "assets/app-AaBb1234.js"),
      "export {}"
    )
    await writeViteManifest(
      emptyEntry.assetManifestFile,
      "assets/app-AaBb1234.js"
    )
    await expect(
      auditPublicDirectory(
        emptyEntry.outputDirectory,
        "dist",
        emptyEntry.expectedDirectory,
        emptyEntry.assetManifestFile
      )
    ).rejects.toThrow("缺少哈希 asset 入口")

    const unhashed = await generatedFixture()
    await writeFile(
      path.join(unhashed.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app.js"></script>'
    )
    await mkdir(path.join(unhashed.outputDirectory, "assets"))
    await writeFile(path.join(unhashed.outputDirectory, "assets/app.js"), "export {}")
    await writeViteManifest(unhashed.assetManifestFile, "assets/app.js")
    await expect(
      auditPublicDirectory(
        unhashed.outputDirectory,
        "dist",
        unhashed.expectedDirectory,
        unhashed.assetManifestFile
      )
    ).rejects.toThrow("必须为哈希 asset")

    const unreachable = await generatedFixture()
    await writeFile(
      path.join(unreachable.outputDirectory, "index.html"),
      '<script type="module" src="/assets/app-AaBb1234.js"></script>'
    )
    await mkdir(path.join(unreachable.outputDirectory, "assets"))
    await writeFile(
      path.join(unreachable.outputDirectory, "assets/app-AaBb1234.js"),
      "export {}"
    )
    await writeFile(
      path.join(unreachable.outputDirectory, "assets/extra-AaBb1234.js"),
      "export {}"
    )
    await writeFile(
      unreachable.assetManifestFile,
      JSON.stringify({
        "index.html": {
          file: "assets/app-AaBb1234.js",
          isEntry: true,
        },
        extra: { file: "assets/extra-AaBb1234.js" },
      })
    )
    await expect(
      auditPublicDirectory(
        unreachable.outputDirectory,
        "dist",
        unreachable.expectedDirectory,
        unreachable.assetManifestFile
      )
    ).rejects.toThrow("不可达 entry")
  })
})
