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

export interface RoadmapLanguage {
  id: string
  label: string
}

export interface RoadmapTrack {
  id: string
  order: number
  title: string
  description: string
  stageIds: string[]
}

export interface RoadmapStage {
  id: string
  trackId: string
  order: number
  title: string
  description: string
  lessonIds: string[]
}

export interface RoadmapLesson {
  courseId: string
  lessonId: string
  lifecycle: "active" | "retired"
  day: number | null
  label: string
  title: string
  objective: string
  goals: string[]
  trackId: string
  stageId: string
  status: CourseStatus
  referenceScore: number | null
  lessonHref: string
}

export interface RoadmapCourseData {
  courseId: string
  title: string
  description: string
  language: RoadmapLanguage
  lifecycle: "published" | "retired"
  replacementCourseId: string | null
  tracks: RoadmapTrack[]
  stages: RoadmapStage[]
  lessons: RoadmapLesson[]
}
