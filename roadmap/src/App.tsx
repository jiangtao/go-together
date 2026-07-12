import { useState } from "react"
import { BracesIcon, PanelRightOpenIcon } from "lucide-react"

import { LearningDrawer } from "@/components/learning-drawer"
import { RoadmapCanvas } from "@/components/roadmap/roadmap-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import generatedCourseData from "@/data/course.json"
import { summarizeProgress, summarizeStageProgress } from "@/lib/progress"
import type { CourseData } from "@/types/course"

const courseData = generatedCourseData as CourseData

function App() {
  const summary = summarizeProgress(courseData.lessons)
  const stageProgress = summarizeStageProgress(
    courseData.stages,
    courseData.lessons
  )
  const [selectedDay, setSelectedDay] = useState(
    summary.recommendedDay ?? courseData.dayRange.end
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const selectedLesson =
    courseData.lessons.find((lesson) => lesson.day === selectedDay) ??
    courseData.lessons[0]
  const selectedStage = courseData.stages.find(
    (stage) => stage.id === selectedLesson.stageId
  )

  if (!selectedStage) {
    throw new Error(`课程阶段缺失：${selectedLesson.stageId}`)
  }

  const handleSelectDay = (day: number) => {
    setSelectedDay(day)
    setDrawerOpen(true)
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="brand-mark" aria-hidden="true">
          <BracesIcon />
        </div>
        <div className="brand-copy min-w-0 flex-1">
          <h1>{courseData.title}</h1>
          <p>课程 Markdown 提供内容，评测 Markdown 决定进度</p>
        </div>
        <div className="header-actions">
          <Badge variant="outline">
            Day {courseData.dayRange.start}–{courseData.dayRange.end} ·{" "}
            {courseData.stages.length} 个阶段
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="progress-drawer-trigger"
            onClick={() => setDrawerOpen(true)}
          >
            <PanelRightOpenIcon data-icon="inline-start" />
            学习进度 {summary.completed}/{summary.total}
          </Button>
        </div>
      </header>

      <main className="canvas-workspace">
        <RoadmapCanvas
          stages={courseData.stages}
          lessons={courseData.lessons}
          selectedDay={selectedLesson.day}
          recommendedDay={summary.recommendedDay}
          onSelectDay={handleSelectDay}
        />
      </main>

      <LearningDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lesson={selectedLesson}
        stage={selectedStage}
        stages={courseData.stages}
        summary={summary}
        stageProgress={stageProgress}
      />
    </div>
  )
}

export default App
