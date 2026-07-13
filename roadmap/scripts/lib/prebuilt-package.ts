import { createHash } from "node:crypto"
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import { auditPublicDirectory } from "./public-audit.ts"

export const SOURCE_DEPLOYMENT_DISABLED_IGNORE = "/*\n"

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const

export const PREBUILT_CONFIG = {
  version: 3,
  routes: [
    {
      src: "/(.*)",
      headers: SECURITY_HEADERS,
      continue: true,
    },
    {
      src: "/assets/(.*)",
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      continue: true,
    },
    {
      src: "/(index\\.html|course\\.json|sources/.*)",
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
      continue: true,
    },
    { handle: "filesystem" },
    { src: "/.*", dest: "/index.html" },
  ],
} as const

export interface PrebuiltPackagePaths {
  repositoryRoot: string
  distDirectory: string
  outputDirectory: string
  manifestFile: string
}

export interface PrebuiltManifestFile {
  path: string
  size: number
  sha256: string
}

export interface PrebuiltManifest {
  schemaVersion: 1
  buildOutputApiVersion: 3
  files: PrebuiltManifestFile[]
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function listRegularFiles(
  root: string,
  directory = root
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const resolvedRoot = await realpath(root)
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      if (entry.isSymbolicLink()) {
        throw new Error(`预构建包包含符号链接：${relative}`)
      }
      if (entry.isDirectory()) return listRegularFiles(root, absolute)
      if (!entry.isFile()) throw new Error(`预构建包包含非普通文件：${relative}`)
      const resolved = await realpath(absolute)
      if (!isInside(resolvedRoot, resolved)) {
        throw new Error(`预构建包文件越界：${relative}`)
      }
      return [relative]
    })
  )
  return nested.flat().sort()
}

async function assertSourceDeploymentDisabled(
  repositoryRoot: string
): Promise<void> {
  const sourceGuard = await readFile(
    path.join(repositoryRoot, ".vercelignore"),
    "utf8"
  )
  if (sourceGuard !== SOURCE_DEPLOYMENT_DISABLED_IGNORE) {
    throw new Error(
      "source deployment 必须保持关闭：仓库根 .vercelignore 只能拒绝全部源码"
    )
  }
  try {
    await lstat(path.join(repositoryRoot, "roadmap/.vercelignore"))
    throw new Error("roadmap/.vercelignore 会覆盖 source deployment 关闭策略")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

function serializeManifest(manifest: PrebuiltManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

const SERIALIZED_CONFIG = `${JSON.stringify(PREBUILT_CONFIG, null, 2)}\n`

async function inspectPrebuiltPackage(
  paths: PrebuiltPackagePaths
): Promise<PrebuiltManifest> {
  await assertSourceDeploymentDisabled(paths.repositoryRoot)
  await auditPublicDirectory(paths.distDirectory, "dist")

  const outputMetadata = await lstat(paths.outputDirectory)
  if (outputMetadata.isSymbolicLink() || !outputMetadata.isDirectory()) {
    throw new Error(".vercel/output 必须是普通目录且不得为符号链接")
  }
  const distFiles = await listRegularFiles(paths.distDirectory)
  const outputFiles = await listRegularFiles(paths.outputDirectory)
  const sourceMap = outputFiles.find((file) => file.endsWith(".map"))
  if (sourceMap) throw new Error(`预构建包禁止 source map：${sourceMap}`)

  const expectedFiles = [
    "config.json",
    ...distFiles.map((file) => `static/${file}`),
  ].sort()
  if (
    outputFiles.length !== expectedFiles.length ||
    outputFiles.some((file, index) => file !== expectedFiles[index])
  ) {
    throw new Error(
      `预构建包文件集存在额外或缺失：${outputFiles.join(", ")}`
    )
  }

  const configSource = await readFile(
    path.join(paths.outputDirectory, "config.json"),
    "utf8"
  )
  if (configSource !== SERIALIZED_CONFIG) {
    throw new Error("预构建 config.json 与受审计 Build Output API v3 配置不一致")
  }
  await auditPublicDirectory(
    path.join(paths.outputDirectory, "static"),
    "dist"
  )

  const files = await Promise.all(
    outputFiles.map(async (file) => {
      const content = await readFile(path.join(paths.outputDirectory, file))
      if (file.startsWith("static/")) {
        const distContent = await readFile(
          path.join(paths.distDirectory, file.slice("static/".length))
        )
        if (!content.equals(distContent)) {
          throw new Error(`预构建静态文件与 audited dist 不一致：${file}`)
        }
      }
      return {
        path: file,
        size: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
      }
    })
  )
  return { schemaVersion: 1, buildOutputApiVersion: 3, files }
}

export async function packagePrebuiltOutput(
  paths: PrebuiltPackagePaths
): Promise<PrebuiltManifest> {
  await assertSourceDeploymentDisabled(paths.repositoryRoot)
  await auditPublicDirectory(paths.distDirectory, "dist")
  const distFiles = await listRegularFiles(paths.distDirectory)

  await rm(paths.outputDirectory, { recursive: true, force: true })
  await mkdir(path.join(paths.outputDirectory, "static"), { recursive: true })
  await writeFile(
    path.join(paths.outputDirectory, "config.json"),
    SERIALIZED_CONFIG,
    "utf8"
  )
  await Promise.all(
    distFiles.map(async (file) => {
      const destination = path.join(paths.outputDirectory, "static", file)
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(path.join(paths.distDirectory, file), destination)
    })
  )

  const manifest = await inspectPrebuiltPackage(paths)
  await mkdir(path.dirname(paths.manifestFile), { recursive: true })
  await writeFile(paths.manifestFile, serializeManifest(manifest), "utf8")
  return manifest
}

export async function auditPrebuiltPackage(
  paths: PrebuiltPackagePaths
): Promise<PrebuiltManifest> {
  const manifest = await inspectPrebuiltPackage(paths)
  const recorded = await readFile(paths.manifestFile, "utf8")
  if (recorded !== serializeManifest(manifest)) {
    throw new Error("预构建 manifest 与实际 .vercel/output 文件集不一致")
  }
  return manifest
}
