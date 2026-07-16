import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  assertNoCaseCollisions,
  inspectDeterministicTree,
  writeJsonAtomically,
} from "./deterministic-tree.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "deterministic-tree-"))
  temporaryDirectories.push(root)
  return root
}

describe("strict deterministic tree", () => {
  it("按规范路径输出大小与 SHA-256", async () => {
    const root = await temporaryRoot()
    await mkdir(path.join(root, "nested"))
    await writeFile(path.join(root, "z.txt"), "z\n")
    await writeFile(path.join(root, "nested/a.txt"), "a\n")

    const files = await inspectDeterministicTree(root)
    expect(files.map(({ path: file }) => file)).toEqual([
      "nested/a.txt",
      "z.txt",
    ])
    expect(files.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(
      true
    )
  })

  it("拒绝 symlink、FIFO、非普通根与大小写碰撞", async () => {
    const linked = await temporaryRoot()
    await writeFile(path.join(linked, "target.txt"), "target")
    await symlink("target.txt", path.join(linked, "linked.txt"))
    await expect(inspectDeterministicTree(linked)).rejects.toThrow("符号链接")

    const fifo = await temporaryRoot()
    execFileSync("mkfifo", [path.join(fifo, "pipe")])
    await expect(inspectDeterministicTree(fifo)).rejects.toThrow("非普通文件")

    expect(() =>
      assertNoCaseCollisions(["Course.json", "course.json"])
    ).toThrow("大小写碰撞")

    const fileRoot = path.join(await temporaryRoot(), "file")
    await writeFile(fileRoot, "not a directory")
    await expect(inspectDeterministicTree(fileRoot)).rejects.toThrow("普通目录")
  })

  it("原子替换 JSON 且不跟随旧输出 symlink", async () => {
    const root = await temporaryRoot()
    const output = path.join(root, "manifest.json")
    await writeJsonAtomically(output, { schemaVersion: 1 })
    await expect(readFile(output, "utf8")).resolves.toBe(
      '{\n  "schemaVersion": 1\n}\n'
    )

    const sentinel = path.join(root, "sentinel")
    await writeFile(sentinel, "unchanged")
    await rm(output)
    await symlink(sentinel, output)
    await expect(
      writeJsonAtomically(output, { schemaVersion: 2 })
    ).rejects.toThrow("普通文件")
    await expect(readFile(sentinel, "utf8")).resolves.toBe("unchanged")
  })
})
