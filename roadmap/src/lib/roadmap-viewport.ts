export const ROADMAP_MIN_ZOOM = 0.18
export const ROADMAP_MAX_ZOOM = 1.6

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

export function getZoomControls(zoom: number): {
  canZoomIn: boolean
  canZoomOut: boolean
} {
  return {
    canZoomIn: zoom < ROADMAP_MAX_ZOOM - Number.EPSILON,
    canZoomOut: zoom > ROADMAP_MIN_ZOOM + Number.EPSILON,
  }
}

export function getNextZoom(zoom: number, direction: "in" | "out"): number {
  const factor = direction === "in" ? 1.2 : 1 / 1.2
  return Math.min(
    ROADMAP_MAX_ZOOM,
    Math.max(ROADMAP_MIN_ZOOM, zoom * factor)
  )
}
