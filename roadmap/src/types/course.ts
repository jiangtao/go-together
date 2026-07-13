export const COURSE_STATUSES = [
  "未开始",
  "定向回炉",
  "重新学习",
  "通过",
] as const

export type CourseStatus = (typeof COURSE_STATUSES)[number]

export interface CourseResource {
  label: string
  href: string
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
  status: CourseStatus
  referenceScore: number | null
  lessonHref: string
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
  schemaVersion: 3
  title: string
  dayRange: {
    start: number
    end: number
  }
  stages: CourseStage[]
  lessons: CourseLesson[]
}
