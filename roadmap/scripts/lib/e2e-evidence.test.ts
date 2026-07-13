import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { deflateSync } from "node:zlib"

import { afterEach, describe, expect, it } from "vitest"

import {
  auditE2eEvidenceManifest,
  createCandidateFingerprint,
  createE2eEvidenceManifest,
  REQUIRED_EVIDENCE,
  validateEvidenceFileNames,
  writeE2eEvidenceManifestAtomically,
} from "./e2e-evidence.ts"

const CANDIDATE_HEAD = "eb283d72fa4eac26e9c39db3789d3dc2c630cb06"
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii")
  const chunk = Buffer.alloc(data.byteLength + 12)
  chunk.writeUInt32BE(data.byteLength, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function createPng(
  width: number,
  height: number,
  blank = false,
  accent = 0
): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  const scanlines = Buffer.alloc((width + 1) * height, 200)
  for (let row = 0; row < height; row += 1) {
    scanlines[row * (width + 1)] = 0
  }
  if (!blank) scanlines[1] = accent
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

async function createCandidateFixture(): Promise<{
  evidenceDirectory: string
  repositoryRoot: string
}> {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "roadmap-evidence-no-git-")
  )
  temporaryDirectories.push(repositoryRoot)
  const files = new Map<string, string>([
    [".vercelignore", "/*\n"],
    [".github/workflows/roadmap-quality.yml", "name: quality\n"],
    ["roadmap/package.json", "{\"name\":\"roadmap\"}\n"],
    ["roadmap/src/App.tsx", "export const App = () => null\n"],
    ["roadmap/scripts/example.ts", "export const build = true\n"],
    ["roadmap/tests/example.test.ts", "export const tested = true\n"],
    ["roadmap/content/progress.public.json", "[]\n"],
    [
      ".agents/skills/evaluate-course-lesson/SKILL.md",
      "# Generic evaluation\n",
    ],
    [
      ".agents/skills/evaluate-course-lesson/scripts/core.py",
      "CORE = True\n",
    ],
    [".agents/skills/evaluate-go-day/SKILL.md", "# Go router\n"],
    [
      ".agents/skills/evaluate-go-day/scripts/router.py",
      "ROUTER = True\n",
    ],
  ])
  for (let day = 0; day <= 36; day += 1) {
    const number = String(day).padStart(2, "0")
    files.set(
      `docs/go-learning/daily-lessons/day-${number}-lesson.md`,
      `# Day ${day}\n`
    )
  }
  await Promise.all(
    [...files].map(async ([relative, content]) => {
      const target = path.join(repositoryRoot, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content, "utf8")
    })
  )
  const evidenceDirectory = path.join(repositoryRoot, "evidence")
  await mkdir(evidenceDirectory)
  await Promise.all(
    REQUIRED_EVIDENCE.map(({ state, cssViewport, deviceScaleFactor }) =>
      writeFile(
        path.join(evidenceDirectory, `${state}.png`),
        createPng(
          cssViewport.width * deviceScaleFactor,
          cssViewport.height * deviceScaleFactor
        )
      )
    )
  )
  return { evidenceDirectory, repositoryRoot }
}

describe("E2E 截图证据契约", () => {
  it("固定为十二个唯一视觉状态及明确 CSS×DPR", () => {
    const names = REQUIRED_EVIDENCE.map(({ state }) => `${state}.png`)
    expect(names).toEqual([
      "desktop-normal.png",
      "desktop-zen.png",
      "desktop-zen-day.png",
      "desktop-zen-reader.png",
      "mobile-normal.png",
      "mobile-zen.png",
      "mobile-zen-day.png",
      "mobile-zen-reader.png",
      "desktop-course-select.png",
      "desktop-nondefault-normal.png",
      "mobile-course-select.png",
      "mobile-nondefault-normal.png",
    ])
    expect(new Set(names).size).toBe(12)
    expect(REQUIRED_EVIDENCE.filter(({ deviceScaleFactor }) => deviceScaleFactor === 1)).toHaveLength(6)
    expect(REQUIRED_EVIDENCE.filter(({ deviceScaleFactor }) => deviceScaleFactor === 3)).toHaveLength(6)
    expect(() => validateEvidenceFileNames(names)).not.toThrow()
  })

  it("拒绝缺失、额外文件或历史截图", () => {
    const names = REQUIRED_EVIDENCE.map(({ state }) => `${state}.png`)
    expect(() => validateEvidenceFileNames(names.slice(1))).toThrow("12 个规定状态")
    expect(() =>
      validateEvidenceFileNames([...names, "historical.png"])
    ).toThrow("12 个规定状态")
    expect(() =>
      validateEvidenceFileNames([...names, "notes.txt"])
    ).toThrow("12 个规定状态")
  })

  it("在无 .git 副本中使用显式 HEAD 生成含内容指纹的清单", async () => {
    const fixture = await createCandidateFixture()
    const manifest = await createE2eEvidenceManifest(
      fixture.evidenceDirectory,
      fixture.repositoryRoot,
      "qa-no-git",
      CANDIDATE_HEAD
    )

    expect(manifest.schemaVersion).toBe(3)
    expect(manifest.candidate.head).toBe(CANDIDATE_HEAD)
    expect(manifest.candidate.fingerprintFileCount).toBeGreaterThan(40)
    expect(manifest.candidate.workingTreeFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.images).toHaveLength(12)
    expect(manifest.images.find(({ state }) => state === "mobile-normal")).toMatchObject({
      cssViewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      pixelSize: { width: 1170, height: 2532 },
      nonBlank: true,
    })
  })

  it("拒绝错误 HEAD、错误 DPR 尺寸与空白截图", async () => {
    const invalidHead = await createCandidateFixture()
    await expect(
      createE2eEvidenceManifest(
        invalidHead.evidenceDirectory,
        invalidHead.repositoryRoot,
        "qa-invalid-head",
        "not-a-head"
      )
    ).rejects.toThrow("40 位十六进制")

    const wrongDpr = await createCandidateFixture()
    await writeFile(
      path.join(wrongDpr.evidenceDirectory, "mobile-normal.png"),
      createPng(390, 844)
    )
    await expect(
      createE2eEvidenceManifest(
        wrongDpr.evidenceDirectory,
        wrongDpr.repositoryRoot,
        "qa-wrong-dpr",
        CANDIDATE_HEAD
      )
    ).rejects.toThrow("CSS×DPR")

    const blank = await createCandidateFixture()
    await writeFile(
      path.join(blank.evidenceDirectory, "desktop-normal.png"),
      createPng(1440, 900, true)
    )
    await expect(
      createE2eEvidenceManifest(
        blank.evidenceDirectory,
        blank.repositoryRoot,
        "qa-blank",
        CANDIDATE_HEAD
      )
    ).rejects.toThrow("空白")
  })

  it("相关候选文件变化会改变确定性内容指纹", async () => {
    const { repositoryRoot } = await createCandidateFixture()
    const before = await createCandidateFingerprint(repositoryRoot)
    await writeFile(
      path.join(repositoryRoot, "roadmap/src/App.tsx"),
      "export const App = () => 'changed'\n",
      "utf8"
    )
    const after = await createCandidateFingerprint(repositoryRoot)
    expect(after.fileCount).toBe(before.fileCount)
    expect(after.sha256).not.toBe(before.sha256)
  })

  it("候选指纹拒绝 roadmap 根配置与 workflow symlink", async () => {
    const rootConfig = await createCandidateFixture()
    await symlink(
      rootConfig.repositoryRoot,
      path.join(rootConfig.repositoryRoot, "roadmap/vite.config.ts")
    )
    await expect(
      createCandidateFingerprint(rootConfig.repositoryRoot)
    ).rejects.toThrow("普通文件")

    const workflow = await createCandidateFixture()
    const workflowFile = path.join(
      workflow.repositoryRoot,
      ".github/workflows/roadmap-quality.yml"
    )
    await rm(workflowFile)
    await symlink(
      path.join(workflow.repositoryRoot, "roadmap/package.json"),
      workflowFile
    )
    await expect(
      createCandidateFingerprint(workflow.repositoryRoot)
    ).rejects.toThrow("普通文件")
  })

  it("候选指纹拒绝递归扫描根与 workflow 目录根逃逸", async () => {
    const sourceRoot = await createCandidateFixture()
    const externalSource = await mkdtemp(
      path.join(os.tmpdir(), "roadmap-evidence-external-src-")
    )
    temporaryDirectories.push(externalSource)
    await writeFile(
      path.join(externalSource, "App.tsx"),
      "export const escaped = true\n",
      "utf8"
    )
    await rm(path.join(sourceRoot.repositoryRoot, "roadmap/src"), {
      recursive: true,
    })
    await symlink(
      externalSource,
      path.join(sourceRoot.repositoryRoot, "roadmap/src")
    )
    await expect(
      createCandidateFingerprint(sourceRoot.repositoryRoot)
    ).rejects.toThrow("普通目录")

    const workflowRoot = await createCandidateFixture()
    const externalWorkflows = await mkdtemp(
      path.join(os.tmpdir(), "roadmap-evidence-external-workflows-")
    )
    temporaryDirectories.push(externalWorkflows)
    await writeFile(
      path.join(externalWorkflows, "roadmap-quality.yml"),
      "name: escaped\n",
      "utf8"
    )
    await rm(path.join(workflowRoot.repositoryRoot, ".github/workflows"), {
      recursive: true,
    })
    await symlink(
      externalWorkflows,
      path.join(workflowRoot.repositoryRoot, ".github/workflows")
    )
    await expect(
      createCandidateFingerprint(workflowRoot.repositoryRoot)
    ).rejects.toThrow("普通目录")
  })

  it("写出的清单会重新核对截图哈希", async () => {
    const fixture = await createCandidateFixture()
    const manifest = await createE2eEvidenceManifest(
      fixture.evidenceDirectory,
      fixture.repositoryRoot,
      "qa-hash",
      CANDIDATE_HEAD
    )
    await writeFile(
      path.join(fixture.evidenceDirectory, "evidence-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    )
    await expect(
      createE2eEvidenceManifest(
        fixture.evidenceDirectory,
        fixture.repositoryRoot,
        "qa-hash",
        CANDIDATE_HEAD
      )
    ).resolves.toEqual(manifest)
    await expect(
      auditE2eEvidenceManifest(
        manifest,
        fixture.evidenceDirectory,
        fixture.repositoryRoot,
        CANDIDATE_HEAD
      )
    ).resolves.toBeUndefined()

    await writeFile(
      path.join(fixture.evidenceDirectory, "desktop-normal.png"),
      createPng(1440, 900, false, 1)
    )
    await expect(
      auditE2eEvidenceManifest(
        manifest,
        fixture.evidenceDirectory,
        fixture.repositoryRoot,
        CANDIDATE_HEAD
      )
    ).rejects.toThrow("清单与当前截图或候选内容不一致")
  })

  it("拒绝非普通旧清单且原子写入不跟随符号链接", async () => {
    const linked = await createCandidateFixture()
    const sentinel = path.join(linked.repositoryRoot, "sentinel.txt")
    await writeFile(sentinel, "unchanged", "utf8")
    await symlink(
      sentinel,
      path.join(linked.evidenceDirectory, "evidence-manifest.json")
    )
    await expect(
      createE2eEvidenceManifest(
        linked.evidenceDirectory,
        linked.repositoryRoot,
        "qa-linked",
        CANDIDATE_HEAD
      )
    ).rejects.toThrow("普通文件")
    await expect(
      writeE2eEvidenceManifestAtomically(linked.evidenceDirectory, "changed")
    ).rejects.toThrow("普通文件")
    await expect(readFile(sentinel, "utf8")).resolves.toBe("unchanged")

    const directory = await createCandidateFixture()
    await mkdir(path.join(directory.evidenceDirectory, "evidence-manifest.json"))
    await expect(
      createE2eEvidenceManifest(
        directory.evidenceDirectory,
        directory.repositoryRoot,
        "qa-directory",
        CANDIDATE_HEAD
      )
    ).rejects.toThrow("普通文件")
  })
})
