export const COURSE_STATUSES = [
  "未开始",
  "定向回炉",
  "重新学习",
  "通过",
] as const

export type CourseStatus = (typeof COURSE_STATUSES)[number]

export const COURSE_RESOURCE_KINDS = [
  "lesson",
  "notes",
  "evaluation",
] as const

export type CourseResourceKind = (typeof COURSE_RESOURCE_KINDS)[number]

export interface CourseResource {
  kind: CourseResourceKind
  label: string
  path: string
  href: string
  exists: boolean
}

export interface CourseLesson {
  id: string
  day: number
  dayLabel: string
  title: string
  englishTitle: string | null
  objective: string
  goals: string[]
  stageId: string
  lessonPath: string
  exercisePath: string
  evaluationPath: string
  evaluationSourceExists: boolean
  resources: CourseResource[]
  status: CourseStatus
  referenceScore: number | null
}

export interface CourseStage {
  id: string
  order: number
  title: string
  description: string
  startDay: number
  endDay: number
  lessonDays: number[]
}

export interface CourseData {
  schemaVersion: 2
  title: string
  dayRange: {
    start: number
    end: number
  }
  stages: CourseStage[]
  lessons: CourseLesson[]
}
