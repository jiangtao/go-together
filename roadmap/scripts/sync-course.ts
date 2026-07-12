import path from "node:path"

import { ROADMAP_DIRECTORY, syncCourseData } from "./lib/course-data.ts"

try {
  const result = await syncCourseData()
  const relativeFile = path.relative(ROADMAP_DIRECTORY, result.file)
  if (!result.changed) {
    console.log(`课程数据与静态资源无变化：${relativeFile}`)
  } else {
    const changes = [
      result.dataChanged ? "课程 JSON" : null,
      result.sourcesChanged ? "Markdown 静态资源" : null,
    ].filter(Boolean)
    console.log(`课程同步完成：${changes.join("、")}`)
  }
} catch (error) {
  console.error("课程数据同步失败：", error)
  process.exitCode = 1
}
