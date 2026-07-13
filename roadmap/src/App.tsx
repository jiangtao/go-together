import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"
import type { Viewport } from "@xyflow/react"
import {
  AlertCircleIcon,
  ArchiveIcon,
  BookOpenIcon,
  BracesIcon,
  RotateCwIcon,
} from "lucide-react"

import { LearningDrawer } from "@/components/learning-drawer"
import { MarkdownReader } from "@/components/markdown-reader"
import { RepositoryActions } from "@/components/repository-actions"
import {
  RoadmapCanvas,
  type RoadmapCanvasHandle,
} from "@/components/roadmap/roadmap-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  isEditableKeyboardTarget,
  shouldToggleZen,
  surfaceBelongsToCourse,
  type Surface,
} from "@/lib/app-state"
import {
  loadCanonicalCourse,
  resolveCoursePath,
  type CanonicalCourseLoadResult,
} from "@/lib/canonical-course"
import { summarizeRoadmapProgress } from "@/lib/progress"
import type { PublicCatalog } from "@/lib/public-course-contract"
import type {
  CourseResource,
  RoadmapCourseData,
  RoadmapLesson,
} from "@/types/course"

type CourseLoadState =
  | { status: "loading"; result: null; error: "" }
  | { status: "ready"; result: CanonicalCourseLoadResult; error: "" }
  | { status: "error"; result: null; error: string }

type LoadFocusTarget = "none" | "heading" | "course-select"

const INITIAL_LOAD_STATE: CourseLoadState = {
  status: "loading",
  result: null,
  error: "",
}

function courseResourceForLesson(lesson: RoadmapLesson): CourseResource {
  return { label: "课程 Markdown", href: lesson.lessonHref }
}

function CourseLoadingScreen({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!error) return
    const frame = window.requestAnimationFrame(() => errorRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [error])

  return (
    <main className="course-load-screen" data-testid="course-load-screen">
      <div className="course-load-mark" aria-hidden="true">
        {error ? <AlertCircleIcon /> : <BracesIcon />}
      </div>
      {error ? (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="course-load-copy"
          data-testid="course-load-error"
        >
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

function CourseIdentityControl({
  catalog,
  courseData,
  canSwitch,
  selectRef,
  onSelectCourse,
}: {
  catalog: PublicCatalog
  courseData: RoadmapCourseData
  canSwitch: boolean
  selectRef: RefObject<HTMLButtonElement | null>
  onSelectCourse: (courseId: string) => void
}) {
  const publishedCourses = catalog.courses.filter(
    (course) => course.lifecycle === "published"
  )
  if (publishedCourses.length < 2) {
    return (
      <div
        className="active-course-static"
        data-testid="active-course-static"
        aria-label={`当前课程：${courseData.language.label}，${courseData.title}`}
      >
        <BookOpenIcon aria-hidden="true" />
        <span>{courseData.language.label}</span>
        <strong>{courseData.title}</strong>
      </div>
    )
  }

  const currentDeclaration = catalog.courses.find(
    (course) => course.courseId === courseData.courseId
  )
  const choices =
    currentDeclaration?.lifecycle === "retired"
      ? [currentDeclaration, ...publishedCourses]
      : publishedCourses

  return (
    <Select
      value={courseData.courseId}
      disabled={!canSwitch}
      onValueChange={onSelectCourse}
    >
      <SelectTrigger
        ref={selectRef}
        className="course-select-trigger"
        aria-label="切换课程"
        data-testid="course-select-trigger"
      >
        <BookOpenIcon aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {choices.map((course) => (
          <SelectItem
            key={course.courseId}
            value={course.courseId}
            disabled={course.lifecycle === "retired"}
            data-testid={`course-option-${course.courseId}`}
          >
            {course.lifecycle === "retired" ? (
              <ArchiveIcon aria-hidden="true" />
            ) : null}
            {course.language.label} · {course.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RoadmapApplication({
  result,
  focusTarget,
  viewportCache,
  onSelectCourse,
}: {
  result: CanonicalCourseLoadResult
  focusTarget: LoadFocusTarget
  viewportCache: Map<string, Viewport>
  onSelectCourse: (courseId: string) => void
}) {
  const { catalog, courseData, courseRevision } = result
  const activeLessons = useMemo(
    () => courseData.lessons.filter((lesson) => lesson.lifecycle === "active"),
    [courseData.lessons]
  )
  const activeLessonIds = useMemo(
    () => new Set(activeLessons.map((lesson) => lesson.lessonId)),
    [activeLessons]
  )
  const activeStages = useMemo(
    () =>
      courseData.stages
        .map((stage) => ({
          ...stage,
          lessonIds: stage.lessonIds.filter((lessonId) =>
            activeLessonIds.has(lessonId)
          ),
        }))
        .filter((stage) => stage.lessonIds.length > 0),
    [activeLessonIds, courseData.stages]
  )
  const activeStageIds = useMemo(
    () => new Set(activeStages.map((stage) => stage.id)),
    [activeStages]
  )
  const activeTracks = useMemo(
    () =>
      courseData.tracks
        .map((track) => ({
          ...track,
          stageIds: track.stageIds.filter((stageId) =>
            activeStageIds.has(stageId)
          ),
        }))
        .filter((track) => track.stageIds.length > 0),
    [activeStageIds, courseData.tracks]
  )
  const summary = summarizeRoadmapProgress(courseData.lessons)
  const [zen, setZen] = useState(false)
  const [surface, setSurface] = useState<Surface>({ kind: "canvas" })
  const [dayInitialFocus, setDayInitialFocus] = useState<
    "close" | "resource"
  >("close")
  const [zenAnnouncement, setZenAnnouncement] = useState("")
  const roadmapRef = useRef<RoadmapCanvasHandle>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const courseSelectRef = useRef<HTMLButtonElement>(null)
  const focusFrame = useRef<number | null>(null)
  const panelLesson =
    surface.kind === "canvas"
      ? null
      : (courseData.lessons.find(
          (lesson) =>
            lesson.courseId === surface.identity.courseId &&
            lesson.lessonId === surface.identity.lessonId
        ) ?? null)
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
    if (focusTarget === "none") return
    scheduleFocus(() => {
      if (focusTarget === "course-select" && courseSelectRef.current) {
        courseSelectRef.current.focus()
      } else {
        headingRef.current?.focus()
      }
    })
  }, [focusTarget, scheduleFocus])

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
        if (trigger.isConnected) {
          trigger.focus()
        } else {
          headingRef.current?.focus()
        }
      })
    },
    [scheduleFocus]
  )

  const handleSelectLesson = useCallback(
    (lesson: RoadmapLesson, trigger: HTMLElement) => {
      setDayInitialFocus("close")
      setSurface({
        kind: "day",
        identity: {
          courseId: lesson.courseId,
          lessonId: lesson.lessonId,
        },
        trigger,
      })
    },
    []
  )

  const handleOpenCourseFromCanvas = useCallback(
    (lesson: RoadmapLesson, trigger: HTMLElement) => {
      setSurface({
        kind: "reader",
        identity: {
          courseId: lesson.courseId,
          lessonId: lesson.lessonId,
        },
        resource: courseResourceForLesson(lesson),
        origin: "canvas",
        trigger,
      })
    },
    []
  )

  const handleOpenCourseFromDay = useCallback(
    (lesson: RoadmapLesson) => {
      if (surface.kind !== "day") return
      setSurface({
        kind: "reader",
        identity: surface.identity,
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
    setSurface({
      kind: "day",
      identity: surface.identity,
      trigger: surface.trigger,
    })
  }, [surface])

  if (!surfaceBelongsToCourse(surface, courseData.courseId)) {
    throw new Error("交互 surface 与当前 Course 身份不一致")
  }
  if (surface.kind !== "canvas" && (!panelLesson || !panelStage)) {
    throw new Error(
      `课程数据缺失：${surface.identity.courseId}/${surface.identity.lessonId}`
    )
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

  const selectedLessonId =
    surface.kind === "day" ? surface.identity.lessonId : null
  const readerResource = surface.kind === "reader" ? surface.resource : null
  const readerOrigin = surface.kind === "reader" ? surface.origin : "canvas"
  const readerLesson = surface.kind === "reader" ? panelLesson : null
  const dayLesson = surface.kind === "day" ? panelLesson : null
  const dayStage = surface.kind === "day" ? panelStage : null
  const replacement = courseData.replacementCourseId
    ? catalog.courses.find(
        (course) => course.courseId === courseData.replacementCourseId
      ) ?? null
    : null

  return (
    <div
      className="app-shell"
      data-zen={zen ? "true" : "false"}
      data-course-revision={courseRevision}
    >
      {!zen ? (
        <header className="page-header">
          <div className="brand-mark" aria-hidden="true">
            <BracesIcon />
          </div>
          <div className="brand-copy min-w-0 flex-1">
            <h1 ref={headingRef} tabIndex={-1} data-testid="course-heading">
              {courseData.title}
            </h1>
            <p>{courseData.description}</p>
          </div>
          <div className="header-actions">
            <CourseIdentityControl
              catalog={catalog}
              courseData={courseData}
              canSwitch={surface.kind === "canvas"}
              selectRef={courseSelectRef}
              onSelectCourse={onSelectCourse}
            />
            <Badge variant="outline" className="header-course-range">
              {activeTracks.length} 条主干 · {activeStages.length} 个阶段
            </Badge>
            <RepositoryActions />
          </div>
        </header>
      ) : null}

      {!zen && courseData.lifecycle === "retired" ? (
        <div
          className="retired-course-notice"
          role="status"
          data-testid="retired-course-notice"
        >
          <ArchiveIcon aria-hidden="true" />
          <span>此课程已退役，内容与历史进度继续保留。</span>
          {replacement ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectCourse(replacement.courseId)}
            >
              查看替代课程：{replacement.title}
            </Button>
          ) : null}
        </div>
      ) : null}

      <main
        className="canvas-workspace"
        data-zen={zen ? "true" : "false"}
        data-testid="canvas-workspace"
      >
        <RoadmapCanvas
          ref={roadmapRef}
          courseId={courseData.courseId}
          courseRevision={courseRevision}
          courseTitle={courseData.title}
          courseDescription={courseData.description}
          tracks={activeTracks}
          stages={activeStages}
          lessons={activeLessons}
          selectedLessonId={selectedLessonId}
          recommendedLessonId={summary.recommendedLessonId}
          viewportCache={viewportCache}
          zen={zen}
          surfaceIsCanvas={surface.kind === "canvas"}
          onToggleZen={toggleZenMode}
          onSelectLesson={handleSelectLesson}
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
        {zenAnnouncement ||
          `已加载${courseData.lifecycle === "retired" ? "退役" : ""}课程${courseData.title}`}
      </div>
    </div>
  )
}

function App() {
  const [requestVersion, setRequestVersion] = useState(0)
  const [navigationVersion, setNavigationVersion] = useState(0)
  const [focusTarget, setFocusTarget] = useState<LoadFocusTarget>(() =>
    window.location.pathname === "/" ? "none" : "heading"
  )
  const [loadState, setLoadState] = useState<CourseLoadState>(INITIAL_LOAD_STATE)
  const requestGeneration = useRef(0)
  const [viewportCache] = useState(() => new Map<string, Viewport>())

  useEffect(() => {
    const handlePopState = () => {
      setFocusTarget("heading")
      setLoadState(INITIAL_LOAD_STATE)
      setNavigationVersion((version) => version + 1)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    let coursePath: string
    try {
      const route = resolveCoursePath(window.location.pathname)
      coursePath = route.canonicalPath
      if (route.shouldNormalize) {
        window.history.replaceState(
          window.history.state,
          "",
          `${route.canonicalPath}${window.location.search}${window.location.hash}`
        )
      }
    } catch (error: unknown) {
      queueMicrotask(() => {
        if (generation !== requestGeneration.current) return
        setLoadState({
          status: "error",
          result: null,
          error: error instanceof Error ? error.message : "当前课程 URL 无效",
        })
      })
      return () => controller.abort()
    }
    void loadCanonicalCourse(coursePath, { signal: controller.signal })
      .then((result) => {
        if (generation !== requestGeneration.current) return
        setLoadState({
          status: "ready",
          result,
          error: "",
        })
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          generation !== requestGeneration.current
        ) {
          return
        }
        setLoadState({
          status: "error",
          result: null,
          error: error instanceof Error ? error.message : "公开课程数据加载失败",
        })
      })
    return () => controller.abort()
  }, [navigationVersion, requestVersion])

  const handleSelectCourse = useCallback((courseId: string) => {
    const pathname = `/courses/${courseId}`
    if (window.location.pathname === pathname) return
    window.history.pushState(null, "", pathname)
    setFocusTarget("course-select")
    setLoadState(INITIAL_LOAD_STATE)
    setNavigationVersion((version) => version + 1)
  }, [])

  if (loadState.status === "ready") {
    return (
      <RoadmapApplication
        key={`${loadState.result.courseId}:${loadState.result.courseRevision}`}
        result={loadState.result}
        focusTarget={focusTarget}
        viewportCache={viewportCache}
        onSelectCourse={handleSelectCourse}
      />
    )
  }
  return (
    <CourseLoadingScreen
      error={loadState.status === "error" ? loadState.error : null}
      onRetry={() => {
        setLoadState(INITIAL_LOAD_STATE)
        setFocusTarget("heading")
        setRequestVersion((version) => version + 1)
      }}
    />
  )
}

export default App
