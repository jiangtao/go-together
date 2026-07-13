import type { CourseResource } from "@/types/course"

export type Surface =
  | { kind: "canvas" }
  | { kind: "day"; day: number; trigger: HTMLElement }
  | {
      kind: "reader"
      day: number
      resource: CourseResource
      origin: "canvas" | "day"
      trigger: HTMLElement
    }

export interface AppViewState {
  zen: boolean
  surface: Surface
}

export interface ZenShortcutInput {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  repeat: boolean
  isComposing: boolean
  targetIsEditable: boolean
}

export function shouldToggleZen(
  input: ZenShortcutInput,
  surface: Surface
): boolean {
  return (
    surface.kind === "canvas" &&
    input.key.toLowerCase() === "z" &&
    input.shiftKey &&
    !input.ctrlKey &&
    !input.altKey &&
    !input.metaKey &&
    !input.repeat &&
    !input.isComposing &&
    !input.targetIsEditable
  )
}

export function toggleZen(state: AppViewState): AppViewState {
  if (state.surface.kind !== "canvas") {
    return state
  }

  return { ...state, zen: !state.zen }
}

export function escapeOneLayer(state: AppViewState): AppViewState {
  if (state.surface.kind === "reader") {
    return {
      zen: state.zen,
      surface:
        state.surface.origin === "day"
          ? {
              kind: "day",
              day: state.surface.day,
              trigger: state.surface.trigger,
            }
          : { kind: "canvas" },
    }
  }

  if (state.surface.kind === "day") {
    return { zen: state.zen, surface: { kind: "canvas" } }
  }

  return state.zen
    ? { zen: false, surface: state.surface }
    : state
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
    )
  )
}
