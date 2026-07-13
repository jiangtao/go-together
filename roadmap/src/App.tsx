import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { AlertCircleIcon, BracesIcon, RotateCwIcon } from "lucide-react"

import { LearningDrawer } from "@/components/learning-drawer"
import { MarkdownReader } from "@/components/markdown-reader"
import {
  RoadmapCanvas,
  type RoadmapCanvasHandle,
} from "@/components/roadmap/roadmap-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  isEditableKeyboardTarget,
  shouldToggleZen,
  type Surface,
} from "@/lib/app-state"
import { parseCourseData } from "@/lib/course-data"
import { summarizeProgress } from "@/lib/progress"
import type { CourseData, CourseLesson, CourseResource } from "@/types/course"

type CourseLoadState =
  | { status: "loading"; course: null; error: "" }
  | { status: "ready"; course: CourseData; error: "" }
  | { status: "error"; course: null; error: string }

const INITIAL_LOAD_STATE: CourseLoadState = {
  status: "loading",
  course: null,
  error: "",
}

function courseResourceForLesson(lesson: CourseLesson): CourseResource {
  return { label: "课程 Markdown", href: lesson.lessonHref }
}

function CourseLoadingScreen({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  return (
    <main className="course-load-screen" data-testid="course-load-screen">
      <div className="course-load-mark" aria-hidden="true">
        {error ? <AlertCircleIcon /> : <BracesIcon />}
      </div>
      {error ? (
        <div role="alert" className="course-load-copy">
          <h1>路线图暂时无法加载</h1>
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            重新加载
          </Button>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="course-load-copy">
          <h1>正在加载学习路线</h1>
          <div className="course-load-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="sr-only">正在加载公开课程数据</span>
        </div>
      )}
    </main>
  )
}

function RoadmapApplication({ courseData }: { courseData: CourseData }) {
  const summary = summarizeProgress(courseData.lessons)
  const [zen, setZen] = useState(false)
  const [surface, setSurface] = useState<Surface>({ kind: "canvas" })
  const [dayInitialFocus, setDayInitialFocus] = useState<
    "close" | "resource"
  >("close")
  const [zenAnnouncement, setZenAnnouncement] = useState("")
  const roadmapRef = useRef<RoadmapCanvasHandle>(null)
  const focusFrame = useRef<number | null>(null)
  const panelLesson =
    surface.kind === "canvas"
      ? null
      : (courseData.lessons.find((lesson) => lesson.day === surface.day) ??
        null)
  const panelStage = panelLesson
    ? (courseData.stages.find((stage) => stage.id === panelLesson.stageId) ??
      null)
    : null

  const scheduleFocus = useCallback((focus: () => void) => {
    if (focusFrame.current !== null) {
      window.cancelAnimationFrame(focusFrame.current)
    }
    focusFrame.current = window.requestAnimationFrame(() => {
      focusFrame.current = window.requestAnimationFrame(() => {
        focusFrame.current = null
        focus()
      })
    })
  }, [])

  useEffect(
    () => () => {
      if (focusFrame.current !== null) {
        window.cancelAnimationFrame(focusFrame.current)
      }
    },
    []
  )

  useEffect(() => {
    if (zen) {
      document.body.dataset.zen = "true"
      return () => {
        delete document.body.dataset.zen
      }
    }
    delete document.body.dataset.zen
  }, [zen])

  const toggleZenMode = useCallback(() => {
    if (surface.kind !== "canvas") return

    const viewport = roadmapRef.current?.getViewport()
    const entering = !zen
    flushSync(() => {
      setZen(entering)
      setZenAnnouncement(
        entering
          ? "已进入画布全屏聚焦模式"
          : "已退出画布全屏聚焦模式"
      )
    })
    if (viewport) roadmapRef.current?.restoreViewportAfterLayout(viewport)
    scheduleFocus(() => {
      if (entering) {
        roadmapRef.current?.focusZenExit()
      } else {
        roadmapRef.current?.focusZenEntry()
      }
    })
  }, [scheduleFocus, surface.kind, zen])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        shouldToggleZen(
          {
            key: event.key,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            repeat: event.repeat,
            isComposing: event.isComposing,
            targetIsEditable: isEditableKeyboardTarget(event.target),
          },
          surface
        )
      ) {
        event.preventDefault()
        toggleZenMode()
        return
      }

      if (event.key === "Escape" && surface.kind === "canvas" && zen) {
        event.preventDefault()
        toggleZenMode()
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [surface, toggleZenMode, zen])

  const closeToCanvas = useCallback(
    (trigger: HTMLElement) => {
      flushSync(() => setSurface({ kind: "canvas" }))
      scheduleFocus(() => {
        if (trigger.isConnected) trigger.focus()
      })
    },
    [scheduleFocus]
  )

  const handleSelectDay = useCallback((day: number, trigger: HTMLElement) => {
    setDayInitialFocus("close")
    setSurface({ kind: "day", day, trigger })
  }, [])

  const handleOpenCourseFromCanvas = useCallback(
    (lesson: CourseLesson, trigger: HTMLElement) => {
      setSurface({
        kind: "reader",
        day: lesson.day,
        resource: courseResourceForLesson(lesson),
        origin: "canvas",
        trigger,
      })
    },
    []
  )

  const handleOpenCourseFromDay = useCallback(
    (lesson: CourseLesson) => {
      if (surface.kind !== "day") return
      setSurface({
        kind: "reader",
        day: lesson.day,
        resource: courseResourceForLesson(lesson),
        origin: "day",
        trigger: surface.trigger,
      })
    },
    [surface]
  )

  const handleReturnToDay = useCallback(() => {
    if (surface.kind !== "reader" || surface.origin !== "day") return
    setDayInitialFocus("resource")
    setSurface({ kind: "day", day: surface.day, trigger: surface.trigger })
  }, [surface])

  if (surface.kind !== "canvas" && (!panelLesson || !panelStage)) {
    throw new Error(`课程数据缺失：Day ${surface.day}`)
  }

  const handleReaderOpenChange = (open: boolean) => {
    if (open || surface.kind !== "reader") return
    if (surface.origin === "day") {
      handleReturnToDay()
    } else {
      closeToCanvas(surface.trigger)
    }
  }

  const handleDayOpenChange = (open: boolean) => {
    if (!open && surface.kind === "day") closeToCanvas(surface.trigger)
  }

  const selectedDay = surface.kind === "day" ? surface.day : null
  const readerResource = surface.kind === "reader" ? surface.resource : null
  const readerOrigin = surface.kind === "reader" ? surface.origin : "canvas"
  const readerLesson = surface.kind === "reader" ? panelLesson : null
  const dayLesson = surface.kind === "day" ? panelLesson : null
  const dayStage = surface.kind === "day" ? panelStage : null

  return (
    <div className="app-shell" data-zen={zen ? "true" : "false"}>
      {!zen ? (
        <header className="page-header">
          <div className="brand-mark" aria-hidden="true">
            <BracesIcon />
          </div>
          <div className="brand-copy min-w-0 flex-1">
            <h1>{courseData.title}</h1>
            <p>课程 Markdown 提供内容，脱敏进度摘要展示状态</p>
          </div>
          <div className="header-actions">
            <Badge variant="outline">
              Day {courseData.dayRange.start}–{courseData.dayRange.end} ·{" "}
              {courseData.stages.length} 个阶段
            </Badge>
          </div>
        </header>
      ) : null}

      <main
        className="canvas-workspace"
        data-zen={zen ? "true" : "false"}
        data-testid="canvas-workspace"
      >
        <RoadmapCanvas
          ref={roadmapRef}
          stages={courseData.stages}
          lessons={courseData.lessons}
          selectedDay={selectedDay}
          recommendedDay={summary.recommendedDay}
          zen={zen}
          surfaceIsCanvas={surface.kind === "canvas"}
          onToggleZen={toggleZenMode}
          onSelectDay={handleSelectDay}
          onOpenCourse={handleOpenCourseFromCanvas}
        />
      </main>

      {dayLesson && dayStage ? (
        <LearningDrawer
          open
          onOpenChange={handleDayOpenChange}
          lesson={dayLesson}
          stage={dayStage}
          initialFocus={dayInitialFocus}
          onOpenCourse={handleOpenCourseFromDay}
        />
      ) : null}
      {readerLesson && readerResource ? (
        <MarkdownReader
          open
          onOpenChange={handleReaderOpenChange}
          lesson={readerLesson}
          resource={readerResource}
          origin={readerOrigin}
          onReturnToDay={handleReturnToDay}
        />
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {zenAnnouncement}
      </div>
    </div>
  )
}

function App() {
  const [requestVersion, setRequestVersion] = useState(0)
  const [loadState, setLoadState] = useState<CourseLoadState>(INITIAL_LOAD_STATE)

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/course.json", {
      signal: controller.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`公开课程数据加载失败（HTTP ${response.status}）`)
        }
        return response.json() as Promise<unknown>
      })
      .then((value) => {
        setLoadState({ status: "ready", course: parseCourseData(value), error: "" })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadState({
          status: "error",
          course: null,
          error: error instanceof Error ? error.message : "公开课程数据加载失败",
        })
      })
    return () => controller.abort()
  }, [requestVersion])

  if (loadState.status === "ready") {
    return <RoadmapApplication courseData={loadState.course} />
  }
  return (
    <CourseLoadingScreen
      error={loadState.status === "error" ? loadState.error : null}
      onRetry={() => {
        setLoadState(INITIAL_LOAD_STATE)
        setRequestVersion((version) => version + 1)
      }}
    />
  )
}

export default App
