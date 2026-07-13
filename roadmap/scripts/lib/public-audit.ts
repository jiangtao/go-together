import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import path from "node:path"

import { init, parse } from "es-module-lexer"
import postcss from "postcss"

import { parseCourseData } from "../../src/lib/course-data.ts"
import { validatePublicCourseProgressPair } from "../../src/lib/public-course-contract.ts"
import {
  parsePublicCatalog,
  parsePublicCourse,
  parsePublicProgress,
  validatePublicCatalogCoursePair,
  validatePublicCourseContent,
} from "./course-contract.ts"

export type AuditTarget = "generated" | "dist"

export interface AuditReport {
  target: AuditTarget
  root: string
  files: number
  lessons: number
  textFilesScanned: number
}

const LEGACY_LESSON_FILE_PATTERN =
  /^sources\/lessons\/day-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const CANONICAL_COURSE_PATTERN =
  /^courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/course\.json$/
const CANONICAL_PROGRESS_PATTERN =
  /^courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/progress\.json$/
const CANONICAL_LESSON_PATTERN =
  /^courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/sources\/lessons\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const CANONICAL_RESOURCE_PATTERN =
  /^courses\/([a-z0-9]+(?:-[a-z0-9]+)*)\/sources\/resources\/[a-z0-9._/-]+\.(?:md|json|txt|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf)$/
const TEXT_FILE_PATTERN = /\.(?:css|html|js|json|md|svg|txt)$/i
const DIST_ASSET_PATTERN =
  /^assets\/[a-zA-Z0-9._-]+\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/
const HASHED_DIST_ASSET_PATTERN =
  /^assets\/[a-zA-Z0-9._-]+-[a-zA-Z0-9_-]{8,}\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/

const FORBIDDEN_CONTENT: Array<[string, RegExp]> = [
  [
    "私有路径字段",
    /["'](?:evaluationPath|exercisePath|lessonPath|evaluationSourceExists)["']\s*:/i,
  ],
  [
    "exercise 路径",
    /(?:^|[\s"'`(])(?:\.\.?[\\/])?exercise[\\/][^\s"'`)]*/im,
  ],
  ["教程治理路径", /docs[\\/]go-learning[\\/]/i],
  ["旧课程数据路径", /roadmap[\\/]src[\\/]data[\\/]course\.json/i],
  ["仓库相对 Markdown 链接", /\]\((?:README\.md|\.\.?[\\/])/i],
  ["笔记或评测文件名", /(?:^|[\\/])notes(?:-eval)?\.md\b/i],
  ["本机用户路径", /(?:\/Users\/|\/home\/[a-z0-9._-]+\/)/i],
  ["本地文件协议", /\bfile:\/\//i],
  ["WPS 标识", /\bWPS\b/],
  ["内部 URL", /https?:\/\/[^\s/]+\.(?:internal|corp)(?:[\s/:]|$)/i],
  ["内部邮箱域名", /@[a-z0-9.-]+\.(?:internal|corp)\b/i],
  ["私钥", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Authorization 头", /\bAuthorization\s*:/i],
  ["Bearer 凭证", /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b/],
  ["常见云端密钥", /\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,})\b/],
  ["source map 引用", /sourceMappingURL\s*=/i],
]

const FORBIDDEN_LEARNING_CONTENT: Array<[string, RegExp]> = [
  ["rubric 材料", /\b(?:capstone[\s_-]*)?rubric\b/i],
  [
    "答案或评测材料",
    /\b(?:answer\s+key|model\s+answer|evaluation\s+(?:criteria|result)|grading\s+criteria)\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)|测评(?:标准|结果|材料)|评分(?:标准|维度|表)|自评/i,
  ],
]

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function listRegularFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`公开产物包含符号链接：${path.relative(root, entryPath)}`)
      }
      if (entry.isDirectory()) return listRegularFiles(root, entryPath)
      if (!entry.isFile()) {
        throw new Error(`公开产物包含非普通文件：${path.relative(root, entryPath)}`)
      }
      const resolved = await realpath(entryPath)
      if (!isInside(await realpath(root), resolved)) {
        throw new Error(`公开产物文件越界：${path.relative(root, entryPath)}`)
      }
      return [path.relative(root, entryPath).split(path.sep).join("/")]
    })
  )
  return nested.flat().sort()
}

function assertAllowedPath(file: string, target: AuditTarget): void {
  if (/\.map$/i.test(file)) {
    throw new Error(`禁止发布 source map：${file}`)
  }
  if (
    /(?:^|\/)exercise(?:\/|$)/i.test(file) ||
    /(?:^|\/)notes(?:-eval)?\.md$/i.test(file)
  ) {
    throw new Error(`禁止发布私有学习文件：${file}`)
  }
  const sharedAllowed =
    file === "course.json" ||
    file === "courses/catalog.json" ||
    LEGACY_LESSON_FILE_PATTERN.test(file) ||
    CANONICAL_COURSE_PATTERN.test(file) ||
    CANONICAL_PROGRESS_PATTERN.test(file) ||
    CANONICAL_LESSON_PATTERN.test(file) ||
    CANONICAL_RESOURCE_PATTERN.test(file)
  const distAllowed =
    target === "dist" &&
    (file === "index.html" || DIST_ASSET_PATTERN.test(file))
  if (!sharedAllowed && !distAllowed) {
    throw new Error(`公开产物包含非白名单文件：${file}`)
  }
}

function auditText(file: string, content: string): void {
  for (const [label, pattern] of FORBIDDEN_CONTENT) {
    if (pattern.test(content)) {
      throw new Error(`${file} 命中禁止内容：${label}`)
    }
  }
  for (const [label, pattern] of FORBIDDEN_LEARNING_CONTENT) {
    if (pattern.test(content)) {
      throw new Error(`${file} 命中禁止内容：${label}`)
    }
  }
}

function stringArray(value: unknown, context: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${context} 必须是字符串数组`)
  }
  return value
}

function hasPrefix(content: Buffer, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => content[index] === byte)
}

function assertBinaryAsset(file: string, content: Buffer): void {
  if (content.byteLength === 0 || content.byteLength > 20 * 1024 * 1024) {
    throw new Error(`dist binary asset 大小无效：${file}`)
  }
  const extension = path.extname(file).toLowerCase()
  const ascii = content.subarray(0, 16).toString("ascii")
  const valid =
    (extension === ".woff" && ascii.startsWith("wOFF")) ||
    (extension === ".woff2" && ascii.startsWith("wOF2")) ||
    (extension === ".ttf" &&
      (hasPrefix(content, [0x00, 0x01, 0x00, 0x00]) ||
        ascii.startsWith("true") ||
        ascii.startsWith("typ1"))) ||
    (extension === ".otf" && ascii.startsWith("OTTO")) ||
    (extension === ".png" &&
      hasPrefix(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    ((extension === ".jpg" || extension === ".jpeg") &&
      hasPrefix(content, [0xff, 0xd8, 0xff])) ||
    (extension === ".gif" &&
      (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a"))) ||
    (extension === ".webp" &&
      ascii.startsWith("RIFF") &&
      ascii.slice(8, 12) === "WEBP") ||
    (extension === ".avif" &&
      ascii.slice(4, 8) === "ftyp" &&
      /(?:avif|avis)/.test(ascii.slice(8))) ||
    (extension === ".ico" && hasPrefix(content, [0x00, 0x00, 0x01, 0x00]))
  if (!valid) throw new Error(`dist binary asset magic bytes 无效：${file}`)
}

async function assertViteAssetManifest(
  root: string,
  files: string[],
  assetManifestFile: string
): Promise<void> {
  const assets = new Set(files.filter((file) => DIST_ASSET_PATTERN.test(file)))
  const publicFiles = new Set(files)
  const manifestMetadata = await lstat(assetManifestFile)
  if (manifestMetadata.isSymbolicLink() || !manifestMetadata.isFile()) {
    throw new Error("Vite asset manifest 侧车必须是普通文件且不得为符号链接")
  }
  const source = await readFile(assetManifestFile, "utf8")
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error("Vite asset manifest 不是合法 JSON")
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Vite asset manifest 必须是对象")
  }
  const manifest = parsed as Record<string, unknown>
  const rawEntries = Object.entries(manifest)
  if (rawEntries.length === 0) throw new Error("Vite asset manifest 不得为空")
  const entries = new Map<
    string,
    {
      file: string
      css: string[]
      assets: string[]
      imports: string[]
      dynamicImports: string[]
      isEntry: boolean
    }
  >()
  for (const [index, [key, value]] of rawEntries.entries()) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Vite asset manifest entry[${index}] 必须是对象`)
    }
    const entry = value as Record<string, unknown>
    if (
      typeof entry.file !== "string" ||
      !HASHED_DIST_ASSET_PATTERN.test(entry.file)
    ) {
      throw new Error(`Vite asset manifest entry[${index}].file 必须为哈希 asset`)
    }
    entries.set(key, {
      file: entry.file,
      css: stringArray(entry.css, `entry[${index}].css`),
      assets: stringArray(entry.assets, `entry[${index}].assets`),
      imports: stringArray(entry.imports, `entry[${index}].imports`),
      dynamicImports: stringArray(
        entry.dynamicImports,
        `entry[${index}].dynamicImports`
      ),
      isEntry: entry.isEntry === true,
    })
  }
  for (const [key, entry] of entries) {
    for (const imported of [...entry.imports, ...entry.dynamicImports]) {
      if (!entries.has(imported)) {
        throw new Error(`Vite manifest import entry 缺失：${key} -> ${imported}`)
      }
    }
  }
  const indexSource = await readFile(path.join(root, "index.html"), "utf8")
  const indexAssets = new Set(
    [...indexSource.matchAll(
      /\b(?:src|href)\s*=\s*["']\/(assets\/[a-zA-Z0-9._-]+\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico))["']/gi
    )].map((match) => match[1])
  )
  if (indexAssets.size === 0) throw new Error("index.html 缺少哈希 asset 入口")
  const rootEntries = [...entries].filter(([, entry]) => entry.isEntry)
  if (rootEntries.length === 0) throw new Error("Vite asset manifest 缺少 isEntry")
  for (const [, entry] of rootEntries) {
    if (!indexAssets.has(entry.file)) {
      throw new Error(`index.html 未绑定 Vite entry：${entry.file}`)
    }
    for (const css of entry.css) {
      if (!indexAssets.has(css)) {
        throw new Error(`index.html 未绑定 Vite entry CSS：${css}`)
      }
    }
  }
  const declared = new Set<string>()
  const reachableEntries = new Set<string>()
  const pending = rootEntries.map(([key]) => key)
  while (pending.length > 0) {
    const key = pending.pop()!
    if (reachableEntries.has(key)) continue
    reachableEntries.add(key)
    const entry = entries.get(key)!
    ;[
      entry.file,
      ...entry.css,
      ...entry.assets,
    ].forEach((file) => {
      if (!HASHED_DIST_ASSET_PATTERN.test(file)) {
        throw new Error(`Vite asset manifest 声明非哈希 asset：${file}`)
      }
      declared.add(file)
    })
    pending.push(...entry.imports, ...entry.dynamicImports)
  }
  const unreachable = [...entries]
    .filter(
      ([key, entry]) =>
        !reachableEntries.has(key) && !declared.has(entry.file)
    )
    .map(([key]) => key)
  if (unreachable.length > 0) {
    throw new Error(`Vite asset manifest 包含不可达 entry：${unreachable.join(", ")}`)
  }
  const missing = [...declared].filter((file) => !assets.has(file))
  if (missing.length > 0) {
    throw new Error(`Vite asset manifest 引用缺失文件：${missing.join(", ")}`)
  }
  const extra = [...assets].filter((file) => !declared.has(file))
  if (extra.length > 0) {
    throw new Error(
      `dist asset 未由 Vite manifest 覆盖：${extra.join(", ")}`
    )
  }
  for (const file of assets) {
    if (!HASHED_DIST_ASSET_PATTERN.test(file)) {
      throw new Error(`dist asset 文件名缺少内容哈希：${file}`)
    }
    if (TEXT_FILE_PATTERN.test(file)) continue
    assertBinaryAsset(file, await readFile(path.join(root, file)))
  }
  for (const file of indexAssets) {
    if (!assets.has(file)) throw new Error(`index.html 引用缺失 asset：${file}`)
    if (!declared.has(file)) {
      throw new Error(`index.html 引用未受 manifest 管理的 asset：${file}`)
    }
  }
  const assertLocalReference = (fromFile: string, specifier: string): void => {
    const withoutSuffix = specifier.trim().split(/[?#]/, 1)[0]
    if (
      withoutSuffix === "" ||
      withoutSuffix.startsWith("//") ||
      /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(withoutSuffix)
    ) {
      return
    }
    const resolved = withoutSuffix.startsWith("/")
      ? path.posix.normalize(withoutSuffix.slice(1))
      : path.posix.normalize(
          path.posix.join(path.posix.dirname(fromFile), withoutSuffix)
        )
    if (!publicFiles.has(resolved)) {
      throw new Error(`JS/CSS 引用缺失：${fromFile} -> ${specifier}`)
    }
    if (
      resolved.startsWith("assets/") &&
      (!assets.has(resolved) || !declared.has(resolved))
    ) {
      throw new Error(`JS/CSS 引用未受 manifest 管理：${fromFile} -> ${specifier}`)
    }
  }
  await init
  for (const file of assets) {
    if (file.endsWith(".js")) {
      const content = await readFile(path.join(root, file), "utf8")
      const [imports] = parse(content)
      imports.forEach((entry) => {
        if (entry.d >= 0 && entry.n === undefined) {
          throw new Error(`无法静态解析的动态 import：${file}`)
        }
        if (entry.n !== undefined) assertLocalReference(file, entry.n)
      })
    }
    if (file.endsWith(".css")) {
      const content = await readFile(path.join(root, file), "utf8")
      const stylesheet = postcss.parse(content, { from: file })
      stylesheet.walkAtRules(/^import$/i, (rule) => {
        const match = rule.params.match(
          /^(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?/
        )
        if (match) assertLocalReference(file, match[1])
      })
      stylesheet.walkDecls((declaration) => {
        for (const match of declaration.value.matchAll(
          /url\(\s*["']?([^"')]+)["']?\s*\)/gi
        )) {
          assertLocalReference(file, match[1])
        }
      })
    }
  }
}

export async function auditPublicDirectory(
  root: string,
  target: AuditTarget,
  expectedPublicRoot: string,
  assetManifestFile?: string
): Promise<AuditReport> {
  const rootMetadata = await lstat(root)
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("公开产物根目录必须是普通目录且不得为符号链接")
  }
  const files = await listRegularFiles(root)
  const expectedFiles = await listRegularFiles(expectedPublicRoot)
  files.forEach((file) => assertAllowedPath(file, target))
  const allowedTargetFiles =
    target === "generated"
      ? expectedFiles
      : [
          ...expectedFiles,
          ...files.filter(
            (file) =>
              file === "index.html" ||
              DIST_ASSET_PATTERN.test(file)
          ),
        ].sort()
  if (
    files.length !== allowedTargetFiles.length ||
    files.some((file, index) => file !== allowedTargetFiles[index])
  ) {
    throw new Error("公开产物文件集与正向生成白名单不一致")
  }
  if (!files.includes("course.json")) {
    throw new Error("公开产物缺少 course.json")
  }
  if (!files.includes("courses/catalog.json")) {
    throw new Error("公开产物缺少 courses/catalog.json")
  }
  if (target === "dist" && !files.includes("index.html")) {
    throw new Error("dist 缺少 index.html")
  }

  const courseSource = await readFile(path.join(root, "course.json"), "utf8")
  let courseJson: unknown
  try {
    courseJson = JSON.parse(courseSource)
  } catch {
    throw new Error("course.json 不是合法 JSON")
  }
  const course = parseCourseData(courseJson)
  const expectedLegacyLessons = new Set(
    course.lessons.map((lesson) => lesson.lessonHref.replace(/^\//, ""))
  )
  const actualLegacyLessons = files.filter((file) =>
    LEGACY_LESSON_FILE_PATTERN.test(file)
  )
  if (
    actualLegacyLessons.length !== expectedLegacyLessons.size ||
    actualLegacyLessons.some((file) => !expectedLegacyLessons.has(file))
  ) {
    throw new Error("公开教程文件与 course.json 白名单不一致")
  }

  const catalogSource = await readFile(
    path.join(root, "courses/catalog.json"),
    "utf8"
  )
  let catalogJson: unknown
  try {
    catalogJson = JSON.parse(catalogSource)
  } catch {
    throw new Error("courses/catalog.json 不是合法 JSON")
  }
  const catalog = parsePublicCatalog(catalogJson)
  const expectedCanonicalLessons = new Set<string>()
  const expectedCourseFiles = new Set<string>()
  const expectedProgressFiles = new Set<string>()
  for (const catalogCourse of catalog.courses) {
    const courseFile = catalogCourse.courseHref.replace(/^\//, "")
    const progressFile = catalogCourse.progressHref.replace(/^\//, "")
    expectedCourseFiles.add(courseFile)
    expectedProgressFiles.add(progressFile)
    if (!files.includes(courseFile) || !files.includes(progressFile)) {
      throw new Error(`Public Catalog Course/Progress 缺失: ${catalogCourse.courseId}`)
    }
    const publicCourse = parsePublicCourse(
      JSON.parse(await readFile(path.join(root, courseFile), "utf8"))
    )
    validatePublicCatalogCoursePair(catalog, publicCourse)
    const publicProgress = parsePublicProgress(
      JSON.parse(await readFile(path.join(root, progressFile), "utf8"))
    )
    validatePublicCourseProgressPair(publicCourse, publicProgress)
    const publicLessons = publicCourse.tracks.flatMap((track) =>
      track.stages.flatMap((stage) => stage.lessons)
    )
    const publicLessonFiles = Object.fromEntries(
      await Promise.all(
        publicLessons.map(async (lesson) => {
          const relative = lesson.lessonHref.replace(/^\//, "")
          expectedCanonicalLessons.add(relative)
          if (!files.includes(relative)) {
            throw new Error(`Public Lesson 缺失: ${relative}`)
          }
          return [lesson.lessonHref, await readFile(path.join(root, relative), "utf8")]
        })
      )
    )
    validatePublicCourseContent(publicCourse, publicLessonFiles)
  }
  const actualCourseFiles = files.filter((file) =>
    CANONICAL_COURSE_PATTERN.test(file)
  )
  const actualProgressFiles = files.filter((file) =>
    CANONICAL_PROGRESS_PATTERN.test(file)
  )
  const actualCanonicalLessons = files.filter((file) =>
    CANONICAL_LESSON_PATTERN.test(file)
  )
  if (
    actualCourseFiles.some((file) => !expectedCourseFiles.has(file)) ||
    actualProgressFiles.some((file) => !expectedProgressFiles.has(file)) ||
    actualCanonicalLessons.some((file) => !expectedCanonicalLessons.has(file))
  ) {
    throw new Error("规范公开文件超出 Public Catalog/Course 正向白名单")
  }
  const publicCourseIds = new Set(catalog.courses.map((entry) => entry.courseId))
  const resources = files.filter((file) => CANONICAL_RESOURCE_PATTERN.test(file))
  if (
    resources.some((file) => {
      const courseId = file.match(CANONICAL_RESOURCE_PATTERN)![1]
      return !publicCourseIds.has(courseId)
    })
  ) {
    throw new Error("Public resource 属于未知 Course")
  }

  let textFilesScanned = 0
  for (const file of files) {
    if (!TEXT_FILE_PATTERN.test(file)) continue
    const content = await readFile(path.join(root, file), "utf8")
    auditText(file, content)
    textFilesScanned += 1
  }
  if (target === "dist") {
    if (!assetManifestFile) throw new Error("dist 审计缺少 Vite manifest 侧车")
    await assertViteAssetManifest(root, files, assetManifestFile)
  }
  for (const file of expectedFiles) {
    const [actual, expected] = await Promise.all([
      readFile(path.join(root, file)),
      readFile(path.join(expectedPublicRoot, file)),
    ])
    if (!actual.equals(expected)) {
      throw new Error(`公开产物与正向生成内容不一致：${file}`)
    }
  }

  return {
    target,
    root,
    files: files.length,
    lessons: actualLegacyLessons.length + actualCanonicalLessons.length,
    textFilesScanned,
  }
}
