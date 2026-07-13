import { useEffect, useRef, useState } from "react"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BookOpenTextIcon,
  ImageIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMobile } from "@/hooks/use-mobile"
import {
  normalizeExternalUrl,
  normalizeImageLink,
  normalizeSourceUrl,
} from "@/lib/markdown"
import type { CourseResource, RoadmapLesson } from "@/types/course"

interface MarkdownReaderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: RoadmapLesson | null
  resource: CourseResource | null
  origin: "canvas" | "day"
  onReturnToDay: () => void
}

type ReaderState =
  | { requestKey: null; status: "idle"; content: ""; error: "" }
  | { requestKey: string; status: "ready"; content: string; error: "" }
  | { requestKey: string; status: "error"; content: ""; error: string }

const INITIAL_STATE: ReaderState = {
  requestKey: null,
  status: "idle",
  content: "",
  error: "",
}

export function MarkdownReader({
  open,
  onOpenChange,
  lesson,
  resource,
  origin,
  onReturnToDay,
}: MarkdownReaderProps) {
  const isMobile = useMobile()
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [readerState, setReaderState] = useState<ReaderState>(INITIAL_STATE)
  const [requestVersion, setRequestVersion] = useState(0)
  const requestKey =
    open && resource ? `${resource.href}:${requestVersion}` : null
  const activeState =
    requestKey !== null && readerState.requestKey === requestKey
      ? readerState
      : requestKey === null
        ? INITIAL_STATE
        : { requestKey, status: "loading" as const, content: "", error: "" }

  useEffect(() => {
    if (!open || !resource || requestKey === null) {
      return
    }

    const controller = new AbortController()
    const currentRequestKey = requestKey
    void Promise.resolve()
      .then(() =>
        normalizeSourceUrl(resource.href, window.location.origin)
      )
      .then((safeHref) => fetch(safeHref, { signal: controller.signal }))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`课程内容加载失败（HTTP ${response.status}）`)
        }
        return response.text()
      })
      .then((content) => {
        setReaderState({
          requestKey: currentRequestKey,
          status: "ready",
          content,
          error: "",
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setReaderState({
          requestKey: currentRequestKey,
          status: "error",
          content: "",
          error: error instanceof Error ? error.message : "课程内容加载失败",
        })
      })

    return () => controller.abort()
  }, [open, requestKey, resource])

  useEffect(() => {
    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (origin === "day") {
        backButtonRef.current?.focus()
      } else {
        closeButtonRef.current?.focus()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, origin])

  const title = lesson ? `${lesson.label} · ${lesson.title}` : "课程阅读"

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      autoFocus
    >
      <DrawerContent
        className="markdown-reader data-[vaul-drawer-direction=right]:sm:max-w-none"
        data-testid="markdown-reader"
        style={{
          width: isMobile ? "100dvw" : "70vw",
          maxWidth: "none",
          height: "100dvh",
        }}
      >
        <DrawerHeader className="markdown-reader-header">
          <div className="flex min-w-0 items-start gap-3">
            {origin === "day" && lesson ? (
              <Button
                ref={backButtonRef}
                type="button"
                variant="ghost"
                size="sm"
                className="markdown-reader-back"
                data-testid="markdown-reader-back"
                aria-label={`返回 ${lesson.label} 详情`}
                onClick={onReturnToDay}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                返回 {lesson.label}
              </Button>
            ) : null}
            <div className="markdown-reader-mark" aria-hidden="true">
              <BookOpenTextIcon />
            </div>
            <div className="min-w-0 flex-1">
              <DrawerTitle data-testid="markdown-reader-title">
                {title}
              </DrawerTitle>
              <DrawerDescription>
                {resource?.label ?? "同源课程 Markdown"}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="关闭课程阅读器"
                data-testid="markdown-reader-close"
              >
                <XIcon />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="markdown-reader-body" data-testid="markdown-reader-body">
          {activeState.status === "loading" ? (
            <div
              className="markdown-reader-loading"
              role="status"
              aria-live="polite"
              data-testid="markdown-reader-loading"
            >
              <span className="reader-skeleton reader-skeleton-title" />
              <span className="reader-skeleton" />
              <span className="reader-skeleton" />
              <span className="reader-skeleton reader-skeleton-short" />
              <span className="sr-only">正在加载课程内容</span>
            </div>
          ) : null}

          {activeState.status === "error" ? (
            <div
              className="markdown-reader-error"
              role="alert"
              data-testid="markdown-reader-error"
            >
              <AlertCircleIcon aria-hidden="true" />
              <div>
                <h2>无法打开课程内容</h2>
                <p>{activeState.error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRequestVersion((version) => version + 1)}
              >
                <RotateCwIcon data-icon="inline-start" />
                重新加载
              </Button>
            </div>
          ) : null}

          {activeState.status === "ready" ? (
            <article className="markdown-content" data-testid="markdown-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  a: ({ children, href, title: linkTitle }) => {
                    const safeHref = href ? normalizeExternalUrl(href) : null
                    return safeHref ? (
                      <a
                        href={safeHref}
                        title={linkTitle}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ) : (
                      <span
                        className="markdown-disabled-link"
                        title="应用内暂不打开本地相对链接"
                      >
                        {children}
                      </span>
                    )
                  },
                  img: ({ alt, src, title: imageTitle }) => {
                    const safeHref =
                      src && resource
                        ? normalizeImageLink(
                            src,
                            resource.href,
                            window.location.origin
                          )
                        : null
                    return safeHref ? (
                      <a
                        className="markdown-image-fallback"
                        href={safeHref}
                        title={imageTitle}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ImageIcon aria-hidden="true" />
                        {alt || "查看图片"}
                      </a>
                    ) : (
                      <span className="markdown-disabled-link">
                        {alt || "图片已安全阻止"}
                      </span>
                    )
                  },
                }}
              >
                {activeState.content}
              </Markdown>
            </article>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
