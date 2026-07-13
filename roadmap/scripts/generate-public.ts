import path from "node:path"

import {
  buildPublicArtifacts,
  GENERATED_PUBLIC_DIRECTORY,
  ROADMAP_DIRECTORY,
} from "./lib/public-course.ts"

try {
  const data = await buildPublicArtifacts()
  console.log(
    `公开课程生成完成：${path.relative(ROADMAP_DIRECTORY, GENERATED_PUBLIC_DIRECTORY)}（${data.lessons.length} 天）`
  )
} catch (error) {
  console.error("公开课程生成失败：", error)
  process.exitCode = 1
}
