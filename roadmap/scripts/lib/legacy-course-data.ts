import {
  COURSE_STATUSES,
  type CourseStatus,
} from "../../src/types/course.ts"

export interface LegacyCourseLesson {
  id: string
  day: number
  dayLabel: string
  title: string
  englishTitle: string | null
  objective: string
  goals: string[]
  stageId: string
  status: CourseStatus
  referenceScore: number | null
  lessonHref: string
}

export interface LegacyCourseStage {
  id: string
  order: number
  title: string
  description: string
  startDay: number
  endDay: number
  lessonDays: number[]
}

export interface LegacyCourseData {
  schemaVersion: 3
  title: string
  dayRange: { start: number; end: number }
  stages: LegacyCourseStage[]
  lessons: LegacyCourseLesson[]
}

type JsonRecord = Record<string, unknown>

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "title",
  "dayRange",
  "stages",
  "lessons",
] as const
const DAY_RANGE_KEYS = ["start", "end"] as const
const STAGE_KEYS = [
  "id",
  "order",
  "title",
  "description",
  "startDay",
  "endDay",
  "lessonDays",
] as const
const LESSON_KEYS = [
  "id",
  "day",
  "dayLabel",
  "title",
  "englishTitle",
  "objective",
  "goals",
  "stageId",
  "status",
  "referenceScore",
  "lessonHref",
] as const
const LESSON_HREF_PATTERN =
  /^\/sources\/lessons\/day-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} 必须是对象`)
  }
  return value as JsonRecord
}

function exact(
  value: JsonRecord,
  expectedKeys: readonly string[],
  context: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${context} 包含缺失或非白名单字段`)
  }
}

function string(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} 必须是非空字符串`)
  }
}

function integer(value: unknown, context: string): asserts value is number {
  if (!Number.isInteger(value)) throw new Error(`${context} 必须是整数`)
}

function day(value: unknown, context: string): asserts value is number {
  integer(value, context)
  if (value < 0 || value > 36) throw new Error(`${context} 必须位于 Day 0-36`)
}

function score(value: unknown, context: string): asserts value is number | null {
  if (
    value !== null &&
    (typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100)
  ) {
    throw new Error(`${context} 必须是 null 或 0-100 的有限数字`)
  }
}

function status(value: unknown, context: string): asserts value is CourseStatus {
  if (!COURSE_STATUSES.includes(value as CourseStatus)) {
    throw new Error(`${context} 不是允许的学习状态`)
  }
}

function parseStage(value: unknown, index: number): LegacyCourseStage {
  const context = `stages[${index}]`
  const stage = record(value, context)
  exact(stage, STAGE_KEYS, context)
  string(stage.id, `${context}.id`)
  integer(stage.order, `${context}.order`)
  string(stage.title, `${context}.title`)
  string(stage.description, `${context}.description`)
  day(stage.startDay, `${context}.startDay`)
  day(stage.endDay, `${context}.endDay`)
  if (stage.startDay > stage.endDay) throw new Error(`${context} 的日期范围无效`)
  if (!Array.isArray(stage.lessonDays) || stage.lessonDays.length === 0) {
    throw new Error(`${context}.lessonDays 必须是非空数组`)
  }
  stage.lessonDays.forEach((value, dayIndex) =>
    day(value, `${context}.lessonDays[${dayIndex}]`)
  )
  return stage as unknown as LegacyCourseStage
}

function parseLesson(value: unknown, index: number): LegacyCourseLesson {
  const context = `lessons[${index}]`
  const lesson = record(value, context)
  exact(lesson, LESSON_KEYS, context)
  string(lesson.id, `${context}.id`)
  day(lesson.day, `${context}.day`)
  string(lesson.dayLabel, `${context}.dayLabel`)
  string(lesson.title, `${context}.title`)
  if (lesson.englishTitle !== null) {
    string(lesson.englishTitle, `${context}.englishTitle`)
  }
  string(lesson.objective, `${context}.objective`)
  if (!Array.isArray(lesson.goals) || lesson.goals.length === 0) {
    throw new Error(`${context}.goals 必须是非空数组`)
  }
  lesson.goals.forEach((goal, goalIndex) =>
    string(goal, `${context}.goals[${goalIndex}]`)
  )
  string(lesson.stageId, `${context}.stageId`)
  status(lesson.status, `${context}.status`)
  score(lesson.referenceScore, `${context}.referenceScore`)
  string(lesson.lessonHref, `${context}.lessonHref`)
  const hrefMatch = lesson.lessonHref.match(LESSON_HREF_PATTERN)
  if (!hrefMatch || Number(hrefMatch[1]) !== lesson.day) {
    throw new Error(`${context}.lessonHref 不是对应 Day 的安全同源课程地址`)
  }
  if (lesson.id !== `day-${String(lesson.day).padStart(2, "0")}`) {
    throw new Error(`${context}.id 与 Day 不一致`)
  }
  if (lesson.dayLabel !== `Day ${lesson.day}`) {
    throw new Error(`${context}.dayLabel 与 Day 不一致`)
  }
  return lesson as unknown as LegacyCourseLesson
}

export function parseLegacyCourseData(value: unknown): LegacyCourseData {
  const course = record(value, "course")
  exact(course, TOP_LEVEL_KEYS, "course")
  if (course.schemaVersion !== 3) throw new Error("course.schemaVersion 必须为 3")
  string(course.title, "course.title")
  const dayRange = record(course.dayRange, "course.dayRange")
  exact(dayRange, DAY_RANGE_KEYS, "course.dayRange")
  if (dayRange.start !== 0 || dayRange.end !== 36) {
    throw new Error("course.dayRange 必须完整覆盖 Day 0-36")
  }
  if (!Array.isArray(course.stages) || course.stages.length !== 6) {
    throw new Error("course.stages 必须包含 6 个阶段")
  }
  const stages = course.stages.map(parseStage)
  const stageIds = new Set(stages.map((stage) => stage.id))
  if (stageIds.size !== stages.length) throw new Error("course.stages 包含重复 id")
  if (!Array.isArray(course.lessons) || course.lessons.length !== 37) {
    throw new Error("course.lessons 必须包含 Day 0-36 共 37 天")
  }
  const lessons = course.lessons.map(parseLesson)
  lessons.forEach((lesson, index) => {
    if (lesson.day !== index) {
      throw new Error("course.lessons 必须按 Day 0-36 连续排序且不得重复")
    }
    if (!stageIds.has(lesson.stageId)) {
      throw new Error(`Day ${lesson.day} 引用了未知阶段`)
    }
  })
  stages.forEach((stage, index) => {
    if (stage.order !== index + 1) {
      throw new Error("course.stages 必须按 order 连续排序")
    }
    const expectedDays = lessons
      .filter((lesson) => lesson.stageId === stage.id)
      .map((lesson) => lesson.day)
    if (
      stage.lessonDays.length !== expectedDays.length ||
      stage.lessonDays.some((value, dayIndex) => value !== expectedDays[dayIndex])
    ) {
      throw new Error(`${stage.id}.lessonDays 与课程归属不一致`)
    }
  })
  return {
    schemaVersion: 3,
    title: course.title,
    dayRange: { start: 0, end: 36 },
    stages,
    lessons,
  }
}
