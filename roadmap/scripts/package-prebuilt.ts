import { createHash } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { packagePrebuiltOutput } from "./lib/prebuilt-package.ts"

const roadmapDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const paths = {
  repositoryRoot: path.resolve(roadmapDirectory, ".."),
  distDirectory: path.join(roadmapDirectory, "dist"),
  outputDirectory: path.join(roadmapDirectory, ".vercel/output"),
  manifestFile: path.join(
    roadmapDirectory,
    ".generated/prebuilt-manifest.json"
  ),
}

try {
  const manifest = await packagePrebuiltOutput(paths)
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  console.log(
    `预构建打包通过：${manifest.files.length} 个 Build Output API v3 文件，manifest sha256 ${createHash("sha256").update(serialized).digest("hex")}`
  )
} catch (error) {
  console.error("预构建打包失败：", error)
  process.exitCode = 1
}
