import { describe, expect, it } from "vitest"

import {
  getNextZoom,
  getZoomControls,
  ROADMAP_MAX_ZOOM,
  ROADMAP_MIN_ZOOM,
  shouldAutomaticallyFit,
  type ViewportLayoutEvent,
} from "@/lib/roadmap-viewport"

describe("路线图自动适配边界", () => {
  it("仅首次稳定布局自动适配", () => {
    expect(shouldAutomaticallyFit("initial-layout", false)).toBe(true)
    expect(shouldAutomaticallyFit("initial-layout", true)).toBe(false)

    const forbidden: ViewportLayoutEvent[] = [
      "zen-enter",
      "zen-exit",
      "resize",
      "surface-change",
    ]
    forbidden.forEach((event) => {
      expect(shouldAutomaticallyFit(event, false)).toBe(false)
    })
  })

  it("缩放按钮在边界禁用并钳制结果", () => {
    expect(getZoomControls(ROADMAP_MIN_ZOOM)).toEqual({
      canZoomIn: true,
      canZoomOut: false,
    })
    expect(getZoomControls(ROADMAP_MAX_ZOOM)).toEqual({
      canZoomIn: false,
      canZoomOut: true,
    })
    expect(getNextZoom(ROADMAP_MAX_ZOOM, "in")).toBe(ROADMAP_MAX_ZOOM)
    expect(getNextZoom(ROADMAP_MIN_ZOOM, "out")).toBe(ROADMAP_MIN_ZOOM)
  })
})
