import { lstat, mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const roadmapDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const source = path.join(roadmapDirectory, "dist/vite-manifest.json")
const destination = path.join(
  roadmapDirectory,
  ".generated/vite-asset-manifest.json"
)

const metadata = await lstat(source)
if (metadata.isSymbolicLink() || !metadata.isFile()) {
  throw new Error("Vite manifest 必须是普通文件且不得为符号链接")
}
await mkdir(path.dirname(destination), { recursive: true })
await rm(destination, { force: true })
await rename(source, destination)
console.log("Vite asset manifest 已提取为非公开审计侧车")
