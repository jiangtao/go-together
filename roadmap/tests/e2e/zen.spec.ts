import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

import { mockGitHubRepositoryApi } from "./github-api"

const SCREENSHOT_DIRECTORY = path.resolve(
  process.env.E2E_EVIDENCE_DIR ?? ".generated/e2e-evidence"
)

test.beforeEach(async ({ page }) => {
  await mockGitHubRepositoryApi(page)
})

function watchRuntime(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  let popupCount = 0

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("popup", () => {
    popupCount += 1
  })

  return () => {
    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
    expect(popupCount).toBe(0)
  }
}

async function settleViewport(viewport: Locator) {
  await viewport.evaluate(
    (element) =>
      new Promise<void>((resolve, reject) => {
        let previous = element.getAttribute("style")
        let stableFrames = 0
        let frames = 0
        const sample = () => {
          const current = element.getAttribute("style")
          stableFrames = current === previous ? stableFrames + 1 : 0
          previous = current
          frames += 1
          if (frames >= 12 && stableFrames >= 4) {
            resolve()
          } else if (frames >= 180) {
            reject(new Error("路线图视口未稳定"))
          } else {
            window.requestAnimationFrame(sample)
          }
        }
        window.requestAnimationFrame(sample)
      })
  )
}

async function settleElement(locator: Locator) {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve, reject) => {
        let previous = element.getBoundingClientRect().toJSON()
        let stableFrames = 0
        let frames = 0
        const sample = () => {
          const current = element.getBoundingClientRect().toJSON()
          const stable =
            current.x === previous.x &&
            current.y === previous.y &&
            current.width === previous.width &&
            current.height === previous.height
          stableFrames = stable ? stableFrames + 1 : 0
          previous = current
          frames += 1
          if (frames >= 12 && stableFrames >= 4) {
            resolve()
          } else if (frames >= 180) {
            reject(new Error("面板位置未稳定"))
          } else {
            window.requestAnimationFrame(sample)
          }
        }
        window.requestAnimationFrame(sample)
      })
  )
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
  ).toBe(true)
}

async function screenshot(page: Page, name: string) {
  await mkdir(SCREENSHOT_DIRECTORY, { recursive: true })
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, `${name}.png`),
    fullPage: true,
  })
}

test("四视口保持 normal/Zen 变换且 Resize 不自动适配", async ({
  page,
}, testInfo) => {
  const expectNoRuntime = watchRuntime(page)
  await page.goto("/")

  const projectName = testInfo.project.name
  const viewportSize = page.viewportSize()
  expect(viewportSize).not.toBeNull()
  const flowViewport = page.locator(".react-flow__viewport")
  await settleViewport(flowViewport)
  const normalTransform = await flowViewport.getAttribute("style")

  await expect(page.getByTestId("roadmap-location")).toHaveText("全图概览")
  await expect(
    page.locator('.lesson-node-card[data-selected="true"]')
  ).toHaveCount(0)
  await expect(page.locator(".react-flow__node")).toHaveCount(47)
  await expectNoPageOverflow(page)

  if (projectName === "desktop-chromium") {
    await screenshot(page, "desktop-normal")
  } else if (projectName === "mobile-390") {
    await screenshot(page, "mobile-normal")
  }

  const enter = page.getByTestId("roadmap-zen-enter")
  const enterBox = await enter.boundingBox()
  expect(enterBox?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(enterBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  await enter.click()

  const workspace = page.getByTestId("canvas-workspace")
  const zenToolbar = page.getByTestId("roadmap-zen-toolbar")
  await expect(workspace).toHaveAttribute("data-zen", "true")
  await expect(zenToolbar).toBeVisible()
  await expect(page.getByTestId("roadmap-zen-exit")).toBeFocused()
  await expect(page.locator(".page-header")).toHaveCount(0)
  await expect(page.locator(".roadmap-panel-header")).toHaveCount(0)
  await expect(page.locator(".react-flow__controls")).toHaveCount(0)
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(normalTransform)

  const workspaceMetrics = await workspace.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      position: style.position,
      zIndex: style.zIndex,
    }
  })
  expect(workspaceMetrics).toEqual({
    x: 0,
    y: 0,
    width: viewportSize!.width,
    height: viewportSize!.height,
    position: "fixed",
    zIndex: "40",
  })

  const toolbarNodeCollisions = await page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-testid="roadmap-zen-toolbar"]'
    )
    if (!toolbar) return ["missing-toolbar"]
    const toolbarRect = toolbar.getBoundingClientRect()
    return Array.from(
      document.querySelectorAll<HTMLElement>(".react-flow__node")
    )
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        return (
          Math.min(rect.right, toolbarRect.right) -
              Math.max(rect.left, toolbarRect.left) >
            1 &&
          Math.min(rect.bottom, toolbarRect.bottom) -
              Math.max(rect.top, toolbarRect.top) >
            1
        )
      })
      .map((node) => node.dataset.id ?? "unknown")
  })
  expect(toolbarNodeCollisions).toEqual([])
  await expectNoPageOverflow(page)

  if (projectName === "desktop-chromium") {
    await screenshot(page, "desktop-zen")
  } else if (projectName === "mobile-390") {
    await screenshot(page, "mobile-zen")
  }

  await page.getByRole("button", { name: "放大路线图" }).click()
  await settleViewport(flowViewport)
  const userTransform = await flowViewport.getAttribute("style")
  expect(userTransform).not.toBe(normalTransform)

  await page.setViewportSize({
    width: viewportSize!.width - 8,
    height: viewportSize!.height,
  })
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(userTransform)
  await page.setViewportSize(viewportSize!)
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(userTransform)

  await page.getByTestId("roadmap-zen-exit").click()
  await expect(workspace).toHaveAttribute("data-zen", "false")
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(userTransform)
  await expect(page.getByTestId("roadmap-zen-enter")).toBeFocused()

  await page.keyboard.press("Shift+Z")
  await expect(workspace).toHaveAttribute("data-zen", "true")
  await expect(page.getByTestId("roadmap-zen-exit")).toBeFocused()
  await page.keyboard.press("Shift+Z")
  await expect(workspace).toHaveAttribute("data-zen", "false")
  await expect(page.getByTestId("roadmap-zen-enter")).toBeFocused()
  await expectNoPageOverflow(page)
  expectNoRuntime()
})

test("从普通 Day 节点进入 Zen 后两种快捷退出都聚焦入口", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "焦点盲区回归使用 1440 桌面浏览器"
  )
  const expectNoRuntime = watchRuntime(page)
  await page.goto("/")

  const workspace = page.getByTestId("canvas-workspace")
  const dayNode = page.locator('.react-flow__node-lesson[data-id="day-00"]')
  const enter = page.getByTestId("roadmap-zen-enter")

  for (const exitKey of ["Shift+Z", "Escape"]) {
    await dayNode.focus()
    await expect(dayNode).toBeFocused()
    await page.keyboard.press("Shift+Z")
    await expect(workspace).toHaveAttribute("data-zen", "true")
    await expect(page.getByTestId("roadmap-zen-exit")).toBeFocused()

    await page.keyboard.press(exitKey)
    await expect(workspace).toHaveAttribute("data-zen", "false")
    await expect(enter).toBeFocused()
  }

  expectNoRuntime()
})

test("Zen 内 Day/Reader 逐层退出并恢复准确焦点", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-chromium", "mobile-390"].includes(testInfo.project.name),
    "分层面板回归使用桌面与 390 移动视口"
  )
  const expectNoRuntime = watchRuntime(page)
  await page.goto("/")
  const flowViewport = page.locator(".react-flow__viewport")
  await settleViewport(flowViewport)
  await page.getByTestId("roadmap-zen-enter").click()
  await expect(page.getByTestId("canvas-workspace")).toHaveAttribute(
    "data-zen",
    "true"
  )
  const zenTransform = await flowViewport.getAttribute("style")

  const dayNode = page.locator('.react-flow__node-lesson[data-id="day-00"]')
  await dayNode.locator('[data-slot="card-header"]').click()
  const drawer = page.getByTestId("learning-drawer")
  await expect(drawer).toBeVisible()
  await settleElement(drawer)
  await expect(page.getByTestId("roadmap-zen-toolbar")).toHaveCount(0)
  await expect(page.getByTestId("learning-drawer-close")).toBeFocused()
  await expect(page.getByTestId("canvas-workspace")).toHaveAttribute(
    "data-zen",
    "true"
  )
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(zenTransform)

  if (testInfo.project.name === "desktop-chromium") {
    await screenshot(page, "desktop-zen-day")
  } else {
    await screenshot(page, "mobile-zen-day")
  }

  await page.getByTestId("lesson-resource-lesson").click()
  const reader = page.getByTestId("markdown-reader")
  await expect(reader).toBeVisible()
  await settleElement(reader)
  await expect(drawer).toHaveCount(0)
  await expect(page.getByTestId("roadmap-zen-toolbar")).toHaveCount(0)
  await expect(page.getByTestId("markdown-reader-back")).toBeFocused()
  const readerBox = await reader.boundingBox()
  const viewportSize = page.viewportSize()
  expect(readerBox).not.toBeNull()
  expect(viewportSize).not.toBeNull()
  if (testInfo.project.name === "mobile-390") {
    expect(readerBox!.x).toBeLessThanOrEqual(1)
    expect(readerBox!.y).toBeLessThanOrEqual(1)
    expect(readerBox!.width).toBeGreaterThanOrEqual(viewportSize!.width * 0.99)
    expect(readerBox!.height).toBeGreaterThanOrEqual(
      viewportSize!.height * 0.99
    )
  } else {
    expect(readerBox!.width).toBeGreaterThan(viewportSize!.width * 0.68)
    expect(readerBox!.width).toBeLessThan(viewportSize!.width * 0.72)
  }
  await expect(page.getByTestId("markdown-content")).toBeVisible()
  await expectNoPageOverflow(page)

  if (testInfo.project.name === "desktop-chromium") {
    await screenshot(page, "desktop-zen-reader")
  } else {
    await screenshot(page, "mobile-zen-reader")
  }

  await page.keyboard.press("Escape")
  await expect(reader).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await expect(page.getByTestId("lesson-resource-lesson")).toBeFocused()
  await expect(page.getByTestId("canvas-workspace")).toHaveAttribute(
    "data-zen",
    "true"
  )

  await page.keyboard.press("Escape")
  await expect(drawer).toHaveCount(0)
  await expect(page.getByTestId("roadmap-zen-toolbar")).toBeVisible()
  await expect(dayNode).toBeFocused()
  await settleViewport(flowViewport)
  expect(await flowViewport.getAttribute("style")).toBe(zenTransform)

  const canvasCourseLink = page.getByTestId("lesson-node-course-0")
  await canvasCourseLink.click()
  await expect(reader).toBeVisible()
  await expect(page.getByTestId("markdown-reader-back")).toHaveCount(0)
  await expect(page.getByTestId("markdown-reader-close")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(reader).toHaveCount(0)
  await expect(page.getByTestId("roadmap-zen-toolbar")).toBeVisible()
  await expect(canvasCourseLink).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(page.getByTestId("canvas-workspace")).toHaveAttribute(
    "data-zen",
    "false"
  )
  await expect(page.getByTestId("roadmap-zen-enter")).toBeFocused()
  await expectNoPageOverflow(page)
  expectNoRuntime()
})
