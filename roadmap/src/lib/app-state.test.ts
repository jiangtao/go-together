import { describe, expect, it } from "vitest"

import {
  escapeOneLayer,
  shouldToggleZen,
  surfaceBelongsToCourse,
  toggleZen,
  type AppViewState,
  type Surface,
} from "@/lib/app-state"
import type { CourseResource } from "@/types/course"

const trigger = {} as HTMLElement
const resource = {
  label: "课程 Markdown",
  href: "/sources/lessons/day-01-course.md",
} as CourseResource
const goIdentity = { courseId: "go-backend", lessonId: "interfaces" }

describe("应用层 Zen 与 surface 状态", () => {
  it("Day 与 Reader surface 绑定完整稳定学习身份", () => {
    expect(
      surfaceBelongsToCourse(
        {
          kind: "day",
          identity: { courseId: "go-backend", lessonId: "interfaces" },
          trigger,
        },
        "go-backend"
      )
    ).toBe(true)
    expect(
      surfaceBelongsToCourse(
        {
          kind: "reader",
          identity: { courseId: "python-core", lessonId: "decorators" },
          resource,
          origin: "canvas",
          trigger,
        },
        "go-backend"
      )
    ).toBe(false)
    expect(surfaceBelongsToCourse({ kind: "canvas" }, "go-backend")).toBe(
      true
    )
  })

  it("Zen 与 Day/Reader surface 保持正交", () => {
    const day: AppViewState = {
      zen: true,
      surface: { kind: "day", identity: goIdentity, trigger },
    }
    const reader: AppViewState = {
      zen: true,
      surface: {
        kind: "reader",
        identity: goIdentity,
        resource,
        origin: "day",
        trigger,
      },
    }

    expect(toggleZen(day)).toBe(day)
    expect(toggleZen(reader)).toBe(reader)
    expect(toggleZen({ zen: false, surface: { kind: "canvas" } })).toEqual({
      zen: true,
      surface: { kind: "canvas" },
    })
  })

  it("Escape 每次只关闭一层并保留 Zen", () => {
    const reader: AppViewState = {
      zen: true,
      surface: {
        kind: "reader",
        identity: goIdentity,
        resource,
        origin: "day",
        trigger,
      },
    }
    const day = escapeOneLayer(reader)
    const canvas = escapeOneLayer(day)
    const normal = escapeOneLayer(canvas)

    expect(day).toEqual({
      zen: true,
      surface: { kind: "day", identity: goIdentity, trigger },
    })
    expect(canvas).toEqual({ zen: true, surface: { kind: "canvas" } })
    expect(normal).toEqual({ zen: false, surface: { kind: "canvas" } })
  })

  it("从画布打开的 Reader 只退回画布", () => {
    expect(
      escapeOneLayer({
        zen: true,
        surface: {
          kind: "reader",
          identity: goIdentity,
          resource,
          origin: "canvas",
          trigger,
        },
      })
    ).toEqual({ zen: true, surface: { kind: "canvas" } })
  })
})

describe("Shift+Z 冲突过滤", () => {
  const valid = {
    key: "Z",
    shiftKey: true,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    isComposing: false,
    targetIsEditable: false,
  }
  const canvas: Surface = { kind: "canvas" }

  it("只在 canvas 接受无冲突的 Shift+Z", () => {
    expect(shouldToggleZen(valid, canvas)).toBe(true)
    expect(
      shouldToggleZen(valid, {
        kind: "day",
        identity: goIdentity,
        trigger,
      })
    ).toBe(false)
  })

  it.each([
    { repeat: true },
    { isComposing: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { targetIsEditable: true },
    { shiftKey: false },
    { key: "x" },
  ])("过滤冲突输入 %#", (override) => {
    expect(shouldToggleZen({ ...valid, ...override }, canvas)).toBe(false)
  })
})
