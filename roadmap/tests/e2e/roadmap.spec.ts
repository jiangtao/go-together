import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

function watchRuntimeErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  return () => {
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  }
}

async function waitForViewportToSettle(viewport: Locator) {
  await viewport.evaluate(
    (element) =>
      new Promise<void>((resolve, reject) => {
        let previous = element.getAttribute("style")
        let stableFrames = 0
        let sampledFrames = 0

        const sample = () => {
          const current = element.getAttribute("style")
          stableFrames = current === previous ? stableFrames + 1 : 0
          previous = current
          sampledFrames += 1

          if (sampledFrames >= 20 && stableFrames >= 5) {
            resolve()
            return
          }
          if (sampledFrames >= 180) {
            reject(new Error("路线图视口未能稳定"))
            return
          }
          window.requestAnimationFrame(sample)
        }

        window.requestAnimationFrame(sample)
      })
  )
}

async function waitForElementToSettle(locator: Locator) {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve, reject) => {
        let previous = element.getBoundingClientRect().toJSON()
        let stableFrames = 0
        let sampledFrames = 0

        const sample = () => {
          const current = element.getBoundingClientRect().toJSON()
          const isStable =
            current.x === previous.x &&
            current.y === previous.y &&
            current.width === previous.width &&
            current.height === previous.height
          stableFrames = isStable ? stableFrames + 1 : 0
          previous = current
          sampledFrames += 1

          if (sampledFrames >= 12 && stableFrames >= 5) {
            resolve()
            return
          }
          if (sampledFrames >= 180) {
            reject(new Error("学习抽屉未能稳定"))
            return
          }
          window.requestAnimationFrame(sample)
        }

        window.requestAnimationFrame(sample)
      })
  )
}

async function expectNodeInsideCanvas(node: Locator, canvas: Locator) {
  const [nodeBox, canvasBox] = await Promise.all([
    node.boundingBox(),
    canvas.boundingBox(),
  ])
  expect(nodeBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()

  const nodeCenter = {
    x: nodeBox!.x + nodeBox!.width / 2,
    y: nodeBox!.y + nodeBox!.height / 2,
  }
  expect(nodeCenter.x).toBeGreaterThanOrEqual(canvasBox!.x)
  expect(nodeCenter.x).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width)
  expect(nodeCenter.y).toBeGreaterThanOrEqual(canvasBox!.y)
  expect(nodeCenter.y).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height)
}

async function expectElementInsideViewport(locator: Locator, viewportHeight: number) {
  const box = await locator.boundingBox()
  expect(box, `${await locator.getAttribute("data-testid")} 应出现在首屏`).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight)
}

async function panNodeIntoCanvas(
  page: Page,
  node: Locator,
  canvas: Locator,
  viewport: Locator
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [nodeBox, canvasBox] = await Promise.all([
      node.boundingBox(),
      canvas.boundingBox(),
    ])
    if (!nodeBox || !canvasBox) {
      throw new Error("无法测量路线图节点或画布")
    }

    const nodeCenter = {
      x: nodeBox.x + nodeBox.width / 2,
      y: nodeBox.y + nodeBox.height / 2,
    }
    const canvasCenter = {
      x: canvasBox.x + canvasBox.width / 2,
      y: canvasBox.y + canvasBox.height / 2,
    }
    const isInside =
      nodeCenter.x >= canvasBox.x &&
      nodeCenter.x <= canvasBox.x + canvasBox.width &&
      nodeCenter.y >= canvasBox.y &&
      nodeCenter.y <= canvasBox.y + canvasBox.height
    if (isInside) {
      return
    }

    const browserViewport = page.viewportSize()
    if (!browserViewport) {
      throw new Error("无法读取浏览器视口")
    }
    const visibleCanvas = {
      left: Math.max(0, canvasBox.x),
      right: Math.min(browserViewport.width, canvasBox.x + canvasBox.width),
      top: Math.max(0, canvasBox.y),
      bottom: Math.min(browserViewport.height, canvasBox.y + canvasBox.height),
    }
    if (
      visibleCanvas.left >= visibleCanvas.right ||
      visibleCanvas.top >= visibleCanvas.bottom
    ) {
      await canvas.scrollIntoViewIfNeeded()
      continue
    }

    await page.mouse.move(
      (visibleCanvas.left + visibleCanvas.right) / 2,
      (visibleCanvas.top + visibleCanvas.bottom) / 2
    )
    await page.mouse.wheel(
      nodeCenter.x - canvasCenter.x,
      nodeCenter.y - canvasCenter.y
    )
    await viewport.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve())
          )
        )
    )
  }

  throw new Error("无法将后段课程节点平移到路线图画布内")
}

test("桌面与移动路线图可见、可交互且无布局碰撞", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Go 36 天学习路线图"
  )
  await expect(page.getByTestId("roadmap-canvas")).toBeVisible()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await expect(page.getByTestId("lesson-detail")).toHaveCount(0)
  await expect(page.locator(".react-flow__node-lesson")).toHaveCount(37)
  await expect(page.locator(".react-flow__node-stage")).toHaveCount(6)
  await expect(page.locator(".react-flow__node-overview")).toHaveCount(4)
  await expect(page.locator(".react-flow__edge")).toHaveCount(45)
  await expect(
    page.locator('.react-flow__edge[data-id^="structure-"].animated')
  ).toHaveCount(9)
  await expect(
    page.locator('.react-flow__edge[data-id^="path-"].animated')
  ).toHaveCount(0)
  const crossStageEdges = page.locator(
    '.react-flow__edge.roadmap-cross-stage-edge[data-id^="path-"]'
  )
  await expect(crossStageEdges).toHaveCount(5)
  const crossStageDashArrays = await crossStageEdges
    .locator(".react-flow__edge-path")
    .evaluateAll((paths) =>
      paths.map((edgePath) => window.getComputedStyle(edgePath).strokeDasharray)
    )
  expect(crossStageDashArrays.every((dashArray) => dashArray !== "none")).toBe(
    true
  )
  const animatedEdgeStyles = await page
    .locator(
      '.react-flow__edge[data-id^="structure-"].animated .react-flow__edge-path'
    )
    .evaluateAll((paths) =>
      paths.map((edgePath) => {
        const style = window.getComputedStyle(edgePath)
        return {
          animationName: style.animationName,
          strokeDasharray: style.strokeDasharray,
        }
      })
    )
  expect(animatedEdgeStyles).toHaveLength(9)
  expect(
    animatedEdgeStyles.every(
      ({ animationName, strokeDasharray }) =>
        animationName !== "none" && strokeDasharray !== "none"
    )
  ).toBe(true)
  const canvasBox = await page.getByTestId("roadmap-canvas").boundingBox()
  const browserViewport = page.viewportSize()
  expect(browserViewport).not.toBeNull()
  expect(canvasBox?.width ?? 0).toBeGreaterThan(300)
  expect(canvasBox?.width ?? 0).toBeGreaterThan(browserViewport!.width * 0.9)
  expect(canvasBox?.height ?? 0).toBeGreaterThan(browserViewport!.height * 0.65)

  const pageHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  )
  expect(pageHasHorizontalOverflow).toBe(false)

  if (testInfo.project.name.startsWith("mobile")) {
    const hiddenToolbarControls = await page
      .locator('.roadmap-toolbar [role="combobox"], .roadmap-toolbar button')
      .evaluateAll((controls) =>
        controls
          .filter((control) => {
            const rect = control.getBoundingClientRect()
            return rect.left < 0 || rect.right > window.innerWidth
          })
          .map(
            (control) =>
              control.getAttribute("aria-label") ?? control.textContent?.trim()
          )
      )
    expect(hiddenToolbarControls).toEqual([])
  }

  const overlappingPairs = await page
    .locator('.lesson-node-card[data-testid^="lesson-node-"]')
    .evaluateAll((elements) => {
      const rectangles = elements.map((element) => ({
        id: element.getAttribute("data-testid") ?? "unknown",
        rect: element.getBoundingClientRect(),
      }))
      const overlaps: string[] = []
      for (let left = 0; left < rectangles.length; left += 1) {
        for (let right = left + 1; right < rectangles.length; right += 1) {
          const first = rectangles[left]
          const second = rectangles[right]
          const overlapWidth = Math.min(first.rect.right, second.rect.right) -
            Math.max(first.rect.left, second.rect.left)
          const overlapHeight = Math.min(first.rect.bottom, second.rect.bottom) -
            Math.max(first.rect.top, second.rect.top)
          if (overlapWidth > 1 && overlapHeight > 1) {
            overlaps.push(`${first.id}/${second.id}`)
          }
        }
      }
      return overlaps
    })
  expect(overlappingPairs).toEqual([])

  const textWithVisibleOverflow = await page
    .locator(".lesson-node-title")
    .evaluateAll((elements) =>
      elements.filter((element) => {
        const style = window.getComputedStyle(element)
        const horizontalOverflow = element.scrollWidth > element.clientWidth + 1
        const verticalOverflow = element.scrollHeight > element.clientHeight + 1
        return (
          (horizontalOverflow && style.overflowX === "visible") ||
          (verticalOverflow && style.overflowY === "visible")
        )
      }).length
    )
  expect(textWithVisibleOverflow).toBe(0)

  const lessonTitleLineHeightRatios = await page
    .locator(".lesson-node-title")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = window.getComputedStyle(element)
        return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize)
      })
    )
  expect(
    lessonTitleLineHeightRatios.every((ratio) => ratio >= 1.3)
  ).toBe(true)
  await expect(page.getByTestId("lesson-node-course-0")).toContainText("课程")

  const overviewChrome = await page
    .locator(".overview-node-card")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = window.getComputedStyle(element)
        return {
          borderWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
        }
      })
    )
  expect(
    overviewChrome.every(
      ({ borderWidth, boxShadow }) =>
        borderWidth === "0px" && boxShadow === "none"
    )
  ).toBe(true)

  const excessiveCardRadii = await page
    .locator('[data-slot="card"]')
    .evaluateAll((elements) =>
      elements.filter(
        (element) =>
          Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius) > 8
      ).length
    )
  expect(excessiveCardRadii).toBe(0)

  const viewport = page.locator(".react-flow__viewport")
  const transformBeforeZoom = await viewport.getAttribute("style")
  await page.locator(".react-flow__controls-zoomin").click()
  await expect
    .poll(async () => viewport.getAttribute("style"))
    .not.toBe(transformBeforeZoom)

  await page.locator(".react-flow__controls-fitview").click()
  await waitForViewportToSettle(viewport)

  const canvas = page.getByTestId("roadmap-canvas")
  const lateLesson = page.getByTestId("lesson-node-30")
  await panNodeIntoCanvas(page, lateLesson, canvas, viewport)
  await expectNodeInsideCanvas(lateLesson, canvas)
  const transformBeforeSelection = await viewport.getAttribute("style")

  await lateLesson.click()
  const learningDrawer = page.getByTestId("learning-drawer")
  await expect(learningDrawer).toBeVisible()
  await waitForElementToSettle(learningDrawer)
  const drawerBox = await learningDrawer.boundingBox()
  expect(drawerBox).not.toBeNull()
  if (testInfo.project.name.startsWith("mobile")) {
    expect(drawerBox!.width).toBeGreaterThan(browserViewport!.width * 0.9)
  } else {
    expect(drawerBox!.width).toBeGreaterThan(browserViewport!.width * 0.48)
    expect(drawerBox!.width).toBeLessThan(browserViewport!.width * 0.52)
  }
  await expect(learningDrawer).toHaveAttribute(
    "data-vaul-drawer-direction",
    testInfo.project.name.startsWith("mobile") ? "bottom" : "right"
  )
  if (testInfo.project.name.startsWith("mobile")) {
    await expect(page.getByTestId("progress-overview")).not.toBeVisible()
    await page.getByTestId("learning-progress-toggle").click()
  }
  await expect(page.getByTestId("progress-overview")).toBeVisible()
  await expect(page.locator('[data-testid^="stage-progress-"]')).toHaveCount(6)
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "minimal Tool interface"
  )
  const detailPathsBottom = await page
    .locator(".lesson-detail .path-row")
    .evaluateAll((rows) =>
      Math.max(...rows.map((row) => row.getBoundingClientRect().bottom))
    )
  const detailFooterTop = await page
    .getByTestId("lesson-detail")
    .locator('[data-slot="card-footer"]')
    .evaluate((footer) => footer.getBoundingClientRect().top)
  expect(detailFooterTop).toBeGreaterThanOrEqual(detailPathsBottom - 1)
  await waitForViewportToSettle(viewport)
  expect(await viewport.getAttribute("style")).toBe(transformBeforeSelection)

  await expect(page.getByTestId("lesson-node-course-30")).toHaveAttribute(
    "href",
    "/sources/docs/go-learning/daily-lessons/day-30-minimal-tool-interface.md"
  )
  await expect(page.getByTestId("lesson-resource-notes")).toBeDisabled()
  await expect(page.getByTestId("lesson-resource-evaluation")).toBeDisabled()

  const sourcePagePromise = page.waitForEvent("popup")
  await page.getByTestId("lesson-resource-lesson").click()
  const sourcePage = await sourcePagePromise
  await sourcePage.waitForLoadState("domcontentloaded")
  await expect(sourcePage.locator("body")).toContainText(
    "# Day 30：minimal Tool interface"
  )
  await sourcePage.close()

  await page.getByRole("button", { name: "关闭学习抽屉" }).click()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)

  await page.getByRole("button", { name: /定位 Day 0/ }).click()
  await waitForViewportToSettle(viewport)
  expect(await viewport.getAttribute("style")).not.toBe(
    transformBeforeSelection
  )
  await expectNodeInsideCanvas(page.getByTestId("lesson-node-0"), canvas)

  await page.locator(".react-flow__controls-fitview").click()
  await waitForViewportToSettle(viewport)
  await expectNodeInsideCanvas(page.getByTestId("roadmap-root"), canvas)
  await expectNodeInsideCanvas(page.getByTestId("roadmap-track-3"), canvas)

  const screenshotDirectory = path.resolve("output/playwright")
  await mkdir(screenshotDirectory, { recursive: true })
  const screenshotName = testInfo.project.name.startsWith("mobile")
    ? "mobile.png"
    : "desktop.png"
  await canvas.screenshot({
    path: path.join(
      screenshotDirectory,
      screenshotName.replace(".png", "-canvas.png")
    ),
  })
  await page.screenshot({
    path: path.join(screenshotDirectory, screenshotName),
    fullPage: true,
  })

  await page.getByTestId("progress-drawer-trigger").click()
  const reopenedDrawer = page.getByTestId("learning-drawer")
  await expect(reopenedDrawer).toBeVisible()
  await waitForElementToSettle(reopenedDrawer)
  await page.screenshot({
    path: path.join(
      screenshotDirectory,
      screenshotName.replace(".png", "-drawer.png")
    ),
    fullPage: true,
  })

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test("Day 节点支持键盘激活且课程链接保持独立", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "键盘回归使用桌面浏览器")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)

  await page.goto("/")
  const dayZero = page.locator('.react-flow__node-lesson[data-id="day-00"]')
  await dayZero.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "为什么 Node.js 开发者要学 Go"
  )
  await page.getByRole("button", { name: "关闭学习抽屉" }).click()

  const dayOne = page.locator('.react-flow__node-lesson[data-id="day-01"]')
  await dayOne.focus()
  await page.keyboard.press("Space")
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "module / package / toolchain"
  )
  await page.getByRole("button", { name: "关闭学习抽屉" }).click()

  const lessonLink = page.getByTestId("lesson-node-course-1")
  await lessonLink.focus()
  const sourcePagePromise = page.waitForEvent("popup")
  await page.keyboard.press("Enter")
  const sourcePage = await sourcePagePromise
  await sourcePage.waitForLoadState("domcontentloaded")
  await expect(sourcePage.locator("body")).toContainText("# Day 01")
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await sourcePage.close()
  expectNoRuntimeErrors()
})

test("文字导航、当前位置和图例能解释并定位路线图", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "完整导航回归使用桌面浏览器")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)

  await page.goto("/")
  const canvas = page.getByTestId("roadmap-canvas")
  const viewport = page.locator(".react-flow__viewport")

  await page.getByTestId("roadmap-fit-view").click()
  await waitForViewportToSettle(viewport)
  await expectNodeInsideCanvas(page.getByTestId("roadmap-root"), canvas)
  await expectNodeInsideCanvas(page.getByTestId("roadmap-track-3"), canvas)

  await page.getByRole("combobox", { name: "跳转阶段" }).click()
  await page.getByRole("option", { name: /阶段 6.*Agent 切片与复盘/ }).click()
  await waitForViewportToSettle(viewport)
  await expectNodeInsideCanvas(page.getByTestId("stage-6"), canvas)

  await page.getByTestId("day-search-trigger").click()
  await page.getByTestId("day-search-input").fill("Day 30")
  await page.getByRole("option", { name: /Day 30.*minimal Tool interface/ }).click()
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "minimal Tool interface"
  )
  await page.getByRole("button", { name: "关闭学习抽屉" }).click()
  await waitForViewportToSettle(viewport)
  await expectNodeInsideCanvas(page.getByTestId("lesson-node-30"), canvas)
  await expect(page.getByTestId("roadmap-location")).toHaveText(
    "阶段 6/6 · Day 30"
  )

  await expect(page.getByTestId("recommended-marker-0")).toHaveText("推荐")
  await expect(page.getByTestId("lesson-node-0")).not.toHaveAttribute(
    "data-selected",
    "true"
  )
  await expect(page.getByTestId("lesson-node-30")).toHaveAttribute(
    "data-selected",
    "true"
  )
  await expect(page.getByTestId("lesson-node-30")).not.toHaveAttribute(
    "data-recommended",
    "true"
  )
  const recommendationOutline = await page
    .getByTestId("lesson-node-0")
    .evaluate((element) => window.getComputedStyle(element).outlineStyle)
  const selectionRing = await page
    .getByTestId("lesson-node-30")
    .evaluate((element) => window.getComputedStyle(element).boxShadow)
  expect(recommendationOutline).toBe("none")
  expect(selectionRing).not.toBe("none")

  await page.getByTestId("roadmap-legend-trigger").click()
  const legend = page.getByTestId("roadmap-legend")
  await expect(legend).toBeVisible()
  await expect(legend).toContainText("未开始")
  await expect(legend).toContainText("定向回炉")
  await expect(legend).toContainText("重新学习")
  await expect(legend).toContainText("通过")
  await expect(legend).toContainText("选中")
  await expect(legend).toContainText("推荐")
  await expect(legend).toContainText("阶段内实线")
  await expect(legend).toContainText("跨阶段虚线")
  await expect(legend).toContainText("结构线")
  expectNoRuntimeErrors()
})

test("移动 Drawer 首屏优先展示当日详情并可展开进度", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "移动端专属回归")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)

  await page.goto("/")
  await page.getByTestId("lesson-node-0").click()

  const drawer = page.getByTestId("learning-drawer")
  await expect(drawer).toBeVisible()
  await waitForElementToSettle(drawer)
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  await expect(page.getByTestId("learning-progress-toggle")).toContainText(
    "总进度 0/37"
  )
  await expect(page.getByTestId("progress-overview")).not.toBeVisible()
  await expect(page.getByTestId("lesson-detail-title")).toBeVisible()
  await expect(page.getByTestId("lesson-objective")).toBeVisible()
  await expect(page.getByTestId("lesson-resource-lesson")).toBeVisible()
  await expectElementInsideViewport(
    page.getByTestId("lesson-detail-title"),
    viewport!.height
  )
  await expectElementInsideViewport(
    page.getByTestId("lesson-objective"),
    viewport!.height
  )
  await expectElementInsideViewport(
    page.getByTestId("lesson-resource-lesson"),
    viewport!.height
  )

  await page.getByTestId("learning-progress-toggle").click()
  await expect(page.getByTestId("progress-overview")).toBeVisible()
  await expect(page.locator('[data-testid^="stage-progress-"]')).toHaveCount(6)
  expectNoRuntimeErrors()
})
