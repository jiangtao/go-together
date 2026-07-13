import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import path from "node:path"

import { parseCourseData } from "../../src/lib/course-data.ts"

export type AuditTarget = "generated" | "dist"

export interface AuditReport {
  target: AuditTarget
  root: string
  files: number
  lessons: number
  textFilesScanned: number
}

const LESSON_FILE_PATTERN =
  /^sources\/lessons\/day-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const TEXT_FILE_PATTERN = /\.(?:css|html|js|json|md|svg|txt)$/i
const DIST_ASSET_PATTERN =
  /^assets\/[a-zA-Z0-9._-]+\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/

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
    /\b(?:answer\s+key|model\s+answer|evaluation\s+(?:criteria|result)|grading\s+criteria)\b|参考答案|标准答案|答案解析|评测(?:标准|结果|材料)?|测评(?:标准|结果|材料)?|评分(?:标准|维度|表)|自评/i,
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
  const sharedAllowed = file === "course.json" || LESSON_FILE_PATTERN.test(file)
  const distAllowed =
    target === "dist" && (file === "index.html" || DIST_ASSET_PATTERN.test(file))
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
  if (file === "course.json" || LESSON_FILE_PATTERN.test(file)) {
    for (const [label, pattern] of FORBIDDEN_LEARNING_CONTENT) {
      if (pattern.test(content)) {
        throw new Error(`${file} 命中禁止内容：${label}`)
      }
    }
  }
}

export async function auditPublicDirectory(
  root: string,
  target: AuditTarget
): Promise<AuditReport> {
  const rootMetadata = await lstat(root)
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("公开产物根目录必须是普通目录且不得为符号链接")
  }
  const files = await listRegularFiles(root)
  files.forEach((file) => assertAllowedPath(file, target))
  if (!files.includes("course.json")) {
    throw new Error("公开产物缺少 course.json")
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
  const expectedLessons = new Set(
    course.lessons.map((lesson) => lesson.lessonHref.replace(/^\//, ""))
  )
  const actualLessons = files.filter((file) => LESSON_FILE_PATTERN.test(file))
  if (
    actualLessons.length !== expectedLessons.size ||
    actualLessons.some((file) => !expectedLessons.has(file))
  ) {
    throw new Error("公开教程文件与 course.json 白名单不一致")
  }

  let textFilesScanned = 0
  for (const file of files) {
    if (!TEXT_FILE_PATTERN.test(file)) continue
    const content = await readFile(path.join(root, file), "utf8")
    auditText(file, content)
    textFilesScanned += 1
  }

  return {
    target,
    root,
    files: files.length,
    lessons: actualLessons.length,
    textFilesScanned,
  }
}
