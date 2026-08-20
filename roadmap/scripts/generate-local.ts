import path from "node:path"

import {
  buildPublicArtifacts,
  GENERATED_PUBLIC_DIRECTORY,
  ROADMAP_DIRECTORY,
} from "./lib/public-course.ts"

try {
  const data = await buildPublicArtifacts({ includeLocalOnly: true })
  console.log(
    `本地课程投影生成完成：${path.relative(ROADMAP_DIRECTORY, GENERATED_PUBLIC_DIRECTORY)}（${data.lessons.length} 天）`
  )
} catch (error) {
  console.error("本地课程投影生成失败：", error)
  process.exitCode = 1
}
