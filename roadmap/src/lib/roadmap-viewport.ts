export const ROADMAP_MIN_ZOOM = 0.18
export const ROADMAP_MOBILE_MIN_ZOOM = 0.08
export const ROADMAP_MAX_ZOOM = 1.6

export function createRoadmapViewportKey(
  courseId: string,
  courseRevision: string,
  isMobile: boolean
): string {
  return `${courseId}:${courseRevision}:${isMobile ? "mobile" : "desktop"}`
}

export type ViewportLayoutEvent =
  | "initial-layout"
  | "zen-enter"
  | "zen-exit"
  | "resize"
  | "surface-change"

export function shouldAutomaticallyFit(
  event: ViewportLayoutEvent,
  hasCompletedInitialFit: boolean
): boolean {
  return event === "initial-layout" && !hasCompletedInitialFit
}

export function getZoomControls(
  zoom: number,
  minZoom = ROADMAP_MIN_ZOOM
): {
  canZoomIn: boolean
  canZoomOut: boolean
} {
  return {
    canZoomIn: zoom < ROADMAP_MAX_ZOOM - Number.EPSILON,
    canZoomOut: zoom > minZoom + Number.EPSILON,
  }
}

export function getNextZoom(
  zoom: number,
  direction: "in" | "out",
  minZoom = ROADMAP_MIN_ZOOM
): number {
  const factor = direction === "in" ? 1.2 : 1 / 1.2
  return Math.min(
    ROADMAP_MAX_ZOOM,
    Math.max(minZoom, zoom * factor)
  )
}
