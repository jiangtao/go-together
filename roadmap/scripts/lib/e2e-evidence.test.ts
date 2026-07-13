import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
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
  it("固定为八个唯一视觉状态及明确 CSS×DPR", () => {
    const names = REQUIRED_EVIDENCE.map(({ state }) => `${state}.png`)
    expect(names).toHaveLength(8)
    expect(new Set(names).size).toBe(8)
    expect(REQUIRED_EVIDENCE.filter(({ deviceScaleFactor }) => deviceScaleFactor === 1)).toHaveLength(4)
    expect(REQUIRED_EVIDENCE.filter(({ deviceScaleFactor }) => deviceScaleFactor === 3)).toHaveLength(4)
    expect(() => validateEvidenceFileNames(names)).not.toThrow()
  })

  it("拒绝缺失、额外文件或历史截图", () => {
    const names = REQUIRED_EVIDENCE.map(({ state }) => `${state}.png`)
    expect(() => validateEvidenceFileNames(names.slice(1))).toThrow("8 个规定状态")
    expect(() =>
      validateEvidenceFileNames([...names, "historical.png"])
    ).toThrow("8 个规定状态")
    expect(() =>
      validateEvidenceFileNames([...names, "notes.txt"])
    ).toThrow("8 个规定状态")
  })

  it("在无 .git 副本中使用显式 HEAD 生成含内容指纹的清单", async () => {
    const fixture = await createCandidateFixture()
    const manifest = await createE2eEvidenceManifest(
      fixture.evidenceDirectory,
      fixture.repositoryRoot,
      "qa-no-git",
      CANDIDATE_HEAD
    )

    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.candidate.head).toBe(CANDIDATE_HEAD)
    expect(manifest.candidate.fingerprintFileCount).toBeGreaterThan(40)
    expect(manifest.candidate.workingTreeFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.images).toHaveLength(8)
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
})
