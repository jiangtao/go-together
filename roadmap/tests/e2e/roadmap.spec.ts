import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

import { mockGitHubRepositoryApi } from "./github-api"

const DIAGNOSTIC_SCREENSHOT_DIRECTORY = path.resolve(
  process.env.PLAYWRIGHT_ARTIFACT_DIR ?? ".generated/playwright-artifacts"
)
const EVIDENCE_SCREENSHOT_DIRECTORY = path.resolve(
  process.env.E2E_EVIDENCE_DIR ?? ".generated/e2e-evidence"
)
const MULTI_COURSE_REVISION = `sha256:${"4".repeat(64)}`
const MULTI_CONTENT_REVISION = `sha256:${"5".repeat(64)}`

function secondaryCourse(
  courseId: "python-core" | "go-legacy",
  lifecycle: "published" | "retired"
) {
  const language =
    courseId === "python-core"
      ? { id: "python", label: "Python" }
      : { id: "go", label: "Go" }
  const title = courseId === "python-core" ? "Python Core" : "Go Legacy"
  const lessonIds = ["functions", "decorators", "data-model"]
  return {
    course: {
      schemaVersion: 1,
      courseId,
      courseRevision: MULTI_COURSE_REVISION,
      title,
      description:
        courseId === "python-core"
          ? "Python 语言基础"
          : "已退役的 Go 基础课程",
      language,
      lifecycle,
      replacementCourseId: lifecycle === "retired" ? "go-backend" : null,
      tracks: [
        {
          trackId: "language-model",
          title: "语言模型",
          description: "理解语言语义",
          stages: [
            {
              stageId: "functions-and-objects",
              title: "函数与对象",
              description: "从函数进入对象模型",
              lessons: lessonIds.map((lessonId, index) => ({
                lessonId,
                lifecycle: "active",
                day: null,
                title: ["函数", "装饰器", "数据模型"][index],
                objective: `掌握${["函数", "装饰器", "数据模型"][index]}`,
                goals: ["解释核心行为"],
                contentRevision: MULTI_CONTENT_REVISION,
                lessonHref: `/courses/${courseId}/sources/lessons/${lessonId}.md`,
              })),
            },
          ],
        },
      ],
    },
    progress: {
      schemaVersion: 1,
      courseId,
      courseRevision: MULTI_COURSE_REVISION,
      lessons: lessonIds.map((lessonId) => ({
        lessonId,
        status: "未开始",
        referenceScore: null,
      })),
    },
    declaration: {
      courseId,
      courseRevision: MULTI_COURSE_REVISION,
      title,
      description:
        courseId === "python-core"
          ? "Python 语言基础"
          : "已退役的 Go 基础课程",
      language,
      lifecycle,
      replacementCourseId: lifecycle === "retired" ? "go-backend" : null,
      pageHref: `/courses/${courseId}`,
      courseHref: `/courses/${courseId}/course.json`,
      progressHref: `/courses/${courseId}/progress.json`,
    },
  }
}

async function mockMultiCourseProjection(
  page: Page,
  options: { pythonDelayMs?: number } = {}
) {
  const python = secondaryCourse("python-core", "published")
  const retired = secondaryCourse("go-legacy", "retired")
  await page.route("**/courses/catalog.json", async (route) => {
    const response = await route.fetch()
    const catalog = (await response.json()) as {
      schemaVersion: 1
      defaultCourseId: string
      courses: unknown[]
    }
    await route.fulfill({
      json: {
        ...catalog,
        courses: [...catalog.courses, python.declaration, retired.declaration],
      },
    })
  })
  for (const fixture of [python, retired]) {
    await page.route(
      `**/courses/${fixture.course.courseId}/course.json`,
      async (route) => {
        if (
          fixture.course.courseId === "python-core" &&
          options.pythonDelayMs
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, options.pythonDelayMs)
          )
        }
        await route.fulfill({ json: fixture.course })
      }
    )
    await page.route(
      `**/courses/${fixture.course.courseId}/progress.json`,
      (route) => route.fulfill({ json: fixture.progress })
    )
    await page.route(
      `**/courses/${fixture.course.courseId}/sources/lessons/*.md`,
      (route) =>
        route.fulfill({
          contentType: "text/markdown; charset=utf-8",
          body: `# ${fixture.course.title}\n\n安全的同源课程正文。`,
        })
    )
  }
}

test.beforeEach(async ({ page }) => {
  await mockGitHubRepositoryApi(page)
})

function watchRuntimeErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const networkErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "unknown"
    if (error !== "net::ERR_ABORTED") {
      networkErrors.push(`${request.method()} ${request.url()} ${error}`)
    }
  })
  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`)
    }
  })

  return () => {
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    expect(networkErrors).toEqual([])
  }
}

async function captureEvidenceScreenshot(page: Page, state: string) {
  await mkdir(EVIDENCE_SCREENSHOT_DIRECTORY, { recursive: true })
  await page.screenshot({
    path: path.join(EVIDENCE_SCREENSHOT_DIRECTORY, `${state}.png`),
    fullPage: true,
  })
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

async function expectWholeRoadmapInsideCanvas(page: Page, canvas: Locator) {
  const outsideNodeIds = await canvas.evaluate((canvasElement) => {
    const canvasRect = canvasElement.getBoundingClientRect()
    return Array.from(
      canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")
    )
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        return (
          rect.left < canvasRect.left - 1 ||
          rect.top < canvasRect.top - 1 ||
          rect.right > canvasRect.right + 1 ||
          rect.bottom > canvasRect.bottom + 1
        )
      })
      .map((node) => node.dataset.id ?? "unknown")
  })

  expect(outsideNodeIds, "首屏应完整显示路线图全部节点").toEqual([])
  expect(
    await page.locator(".react-flow__viewport").getAttribute("style")
  ).toContain("scale(")
}

async function expectElementInsideViewport(locator: Locator, viewportHeight: number) {
  const box = await locator.boundingBox()
  expect(box, `${await locator.getAttribute("data-testid")} 应出现在首屏`).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight)
}

async function expectMinimumTouchTargets(locator: Locator) {
  const undersized = await locator.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map(
        (element) =>
          element.getAttribute("aria-label") ??
          element.getAttribute("data-testid") ??
          element.textContent?.trim() ??
          "unknown"
      )
  )
  expect(undersized).toEqual([])
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

test("公开课程数据提供确定加载态", async ({ page }) => {
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  let releaseResponse!: () => void
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route("**/courses/catalog.json", async (route) => {
    await responseGate
    await route.continue()
  })
  await page.goto("/")
  await expect(page.getByTestId("course-load-screen")).toBeVisible()
  await expect(page.getByRole("status")).toContainText("正在加载学习路线")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
  ).toBe(false)
  await expect(page.locator(".react-flow__node")).toHaveCount(0)
  releaseResponse()
  await expect(page.locator(".react-flow__node")).toHaveCount(47)
  await expect(page.getByTestId("course-load-screen")).toHaveCount(0)
  expectNoRuntimeErrors()
})

test("公开课程数据错误后可重试", async ({ page }) => {
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    const testWindow = window as Window & {
      __restoreCourseFetch?: () => void
    }
    testWindow.__restoreCourseFetch = () => {
      window.fetch = originalFetch
    }
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString()
      if (
        new URL(url, window.location.origin).pathname ===
        "/courses/catalog.json"
      ) {
        return new Response('{"error":"temporary"}', {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      }
      return originalFetch(input, init)
    }
  })

  await page.goto("/")
  await expect(page.getByRole("alert")).toContainText("HTTP 503")
  await expect(page.getByTestId("course-load-error")).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
  ).toBe(false)
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __restoreCourseFetch?: () => void
    }
    testWindow.__restoreCourseFetch?.()
  })
  await page.getByRole("button", { name: "重新加载" }).click()
  await expect(page.locator(".react-flow__node")).toHaveCount(47)
  expectNoRuntimeErrors()
})

test("根路径与规范 Go 路径只消费同一组 canonical revision", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "canonical 网络契约使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  const courseRequests: string[] = []
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.includes("course") || pathname.includes("sources/lessons")) {
      courseRequests.push(pathname)
    }
  })

  await page.goto("/")
  const rootRevision = await page.locator(".app-shell").getAttribute(
    "data-course-revision"
  )
  const canonicalRevision = await page.evaluate(async () => {
    const response = await fetch("/courses/go-backend/course.json")
    const value = (await response.json()) as { courseRevision: string }
    return value.courseRevision
  })
  expect(rootRevision).toBe(canonicalRevision)

  await page.goto("/courses/go-backend")
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-course-revision",
    canonicalRevision
  )
  expect(courseRequests).not.toContain("/course.json")
  expect(courseRequests).toContain("/courses/catalog.json")
  expect(courseRequests).toContain("/courses/go-backend/course.json")
  expect(courseRequests).toContain("/courses/go-backend/progress.json")
  expectNoRuntimeErrors()
})

test("Course Select 以 URL 切换任意结构课程并按 history 恢复 transform", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "多课程 history 与 transform 隔离使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page)
  await page.goto("/")

  const courseSelect = page.getByTestId("course-select-trigger")
  await expect(courseSelect).toBeVisible()
  await courseSelect.click()
  await page.getByRole("option", { name: "Python · Python Core" }).click()
  await expect(page).toHaveURL(/\/courses\/python-core$/)
  await expect(page.getByTestId("course-heading")).toHaveText("Python Core")
  await expect(courseSelect).toBeFocused()
  await expect(page.locator(".react-flow__node")).toHaveCount(6)
  await expect(page.getByTestId("lesson-node-functions")).toContainText(
    "课次 1"
  )

  const viewport = page.locator(".react-flow__viewport")
  await page.locator(".react-flow__controls-zoomin").click()
  await waitForViewportToSettle(viewport)
  const pythonViewport = await viewport.getAttribute("style")

  const firstLesson = page.locator(
    '.react-flow__node-lesson[data-id="lesson:functions"]'
  )
  await firstLesson.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("course-select-trigger")).toBeDisabled()
  await expect(page.getByTestId("learning-drawer-close")).toBeFocused()
  await page.getByTestId("learning-drawer-close").click()

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId("course-heading")).toContainText("Go")
  await expect(page.getByTestId("course-heading")).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL(/\/courses\/python-core$/)
  await expect(page.getByTestId("course-heading")).toBeFocused()
  await waitForViewportToSettle(viewport)
  await expect(viewport).toHaveAttribute("style", pythonViewport ?? "")
  expectNoRuntimeErrors()
})

test("候选证据固定 Course Select 展开与非默认 Course 全览", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-chromium", "mobile-390"].includes(testInfo.project.name),
    "候选视觉证据固定使用 1440 桌面与 390 移动视口"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page)
  await page.goto("/")
  await waitForViewportToSettle(page.locator(".react-flow__viewport"))

  await page.getByTestId("course-select-trigger").click()
  await expect(
    page.getByRole("option", { name: "Python · Python Core" })
  ).toBeVisible()
  await captureEvidenceScreenshot(
    page,
    testInfo.project.name === "desktop-chromium"
      ? "desktop-course-select"
      : "mobile-course-select"
  )

  await page.getByRole("option", { name: "Python · Python Core" }).click()
  await expect(page).toHaveURL(/\/courses\/python-core$/)
  await expect(page.getByTestId("course-heading")).toHaveText("Python Core")
  await waitForViewportToSettle(page.locator(".react-flow__viewport"))
  await expectWholeRoadmapInsideCanvas(
    page,
    page.getByTestId("roadmap-canvas")
  )
  await captureEvidenceScreenshot(
    page,
    testInfo.project.name === "desktop-chromium"
      ? "desktop-nondefault-normal"
      : "mobile-nondefault-normal"
  )
  expectNoRuntimeErrors()
})

test("迟到 Course 请求不能覆盖 history 已选择的 Active Course", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "请求 generation 与 abort 回归使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page, { pythonDelayMs: 700 })
  await page.goto("/")
  await page.getByTestId("course-select-trigger").click()
  await page.getByRole("option", { name: "Python · Python Core" }).click()
  await expect(page).toHaveURL(/\/courses\/python-core$/)
  await expect(page.getByTestId("course-load-screen")).toBeVisible()
  await page.evaluate(() => window.history.back())
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId("course-heading")).toContainText("Go")
  await page.waitForTimeout(850)
  await expect(page.getByTestId("course-heading")).toContainText("Go")
  await expect(page.locator(".react-flow__node")).toHaveCount(47)
  expectNoRuntimeErrors()
})

test("Course 变化会关闭 Reader 并丢弃旧 Course 的迟到 Markdown", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Reader 异步隔离使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page)
  await page.route("**/courses/go-backend/sources/lessons/why-go-after-node.md", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({
      contentType: "text/markdown; charset=utf-8",
      body: "# OLD COURSE READER",
    })
  })
  await page.goto("/")
  await page.getByTestId("lesson-node-course-0").click()
  await expect(page.getByTestId("markdown-reader-loading")).toBeVisible()
  await page.evaluate(() => {
    window.history.pushState(null, "", "/courses/python-core")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page.getByTestId("course-heading")).toHaveText("Python Core")
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await page.waitForTimeout(700)
  await expect(page.getByText("OLD COURSE READER")).toHaveCount(0)
  expectNoRuntimeErrors()
})

test("面板 trigger 被销毁时焦点回退到当前 Course 标题", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "焦点回退使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await page.goto("/")
  const trigger = page.locator(
    '.react-flow__node-lesson[data-id="lesson:why-go-after-node"]'
  )
  await trigger.locator('[data-slot="card-header"]').click()
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await trigger.evaluate((element) => element.remove())
  await page.getByTestId("learning-drawer-close").click()
  await expect(page.getByTestId("course-heading")).toBeFocused()
  expectNoRuntimeErrors()
})

test("尾斜杠规范化、未知 Course 与 Retired Replacement 均失败透明", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "路由错误与退役课程回归使用 1440 桌面浏览器"
  )
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page)

  await page.goto("/courses/go-backend/")
  await expect(page).toHaveURL(/\/courses\/go-backend$/)
  await expect(page.getByTestId("course-heading")).toBeFocused()

  await page.goto("/courses/not-registered")
  await expect(page.getByTestId("course-load-error")).toContainText(
    "课程不存在"
  )
  await expect(page.getByTestId("course-load-error")).toBeFocused()
  await expect(page.locator(".react-flow__node")).toHaveCount(0)

  await page.goto("/courses/go-legacy")
  await expect(page).toHaveURL(/\/courses\/go-legacy$/)
  await expect(page.getByTestId("retired-course-notice")).toContainText(
    "内容与历史进度继续保留"
  )
  await expect(page.getByTestId("retired-course-notice")).toContainText(
    "Go 36 天学习路线图"
  )
  await page
    .getByRole("button", { name: /查看替代课程/ })
    .click()
  await expect(page).toHaveURL(/\/courses\/go-backend$/)
  expectNoRuntimeErrors()
})

test("非默认无 Day Course 在四视口保持全览、触控尺寸与 Reader 宽度", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  await mockMultiCourseProjection(page)
  await page.goto("/courses/python-core")
  await expect(page.locator(".react-flow__node")).toHaveCount(6)

  const canvas = page.getByTestId("roadmap-canvas")
  const viewport = page.locator(".react-flow__viewport")
  await waitForViewportToSettle(viewport)
  await expectWholeRoadmapInsideCanvas(page, canvas)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
  ).toBe(false)

  const selectBox = await page.getByTestId("course-select-trigger").boundingBox()
  expect(selectBox).not.toBeNull()
  expect(selectBox!.height).toBeGreaterThanOrEqual(44)

  await page.getByTestId("lesson-node-course-functions").click()
  const reader = page.getByTestId("markdown-reader")
  await expect(reader).toBeVisible()
  const [readerBox, browserViewport] = await Promise.all([
    reader.boundingBox(),
    Promise.resolve(page.viewportSize()),
  ])
  expect(readerBox).not.toBeNull()
  expect(browserViewport).not.toBeNull()
  if (testInfo.project.name.startsWith("mobile")) {
    expect(readerBox!.width).toBeGreaterThanOrEqual(browserViewport!.width * 0.99)
  } else {
    expect(readerBox!.width).toBeGreaterThan(browserViewport!.width * 0.68)
    expect(readerBox!.width).toBeLessThan(browserViewport!.width * 0.72)
  }
  await expect(page.getByTestId("markdown-reader-close")).toBeFocused()
  expectNoRuntimeErrors()
})

test("桌面与移动路线图可见、可交互且无布局碰撞", async ({
  page,
}, testInfo) => {
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  let popupCount = 0
  page.on("popup", () => {
    popupCount += 1
  })

  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Go 36 天学习路线图"
  )
  await expect(page.getByTestId("roadmap-canvas")).toBeVisible()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect(page.getByTestId("lesson-detail")).toHaveCount(0)
  await expect(page.getByTestId("progress-drawer-trigger")).toHaveCount(0)
  await expect(page.getByTestId("roadmap-location")).toHaveText("全图概览")
  await expect(
    page.locator('.lesson-node-card[data-selected="true"]')
  ).toHaveCount(0)
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
  expect(canvasBox?.height ?? 0).toBeGreaterThan(
    browserViewport!.height *
      (testInfo.project.name.startsWith("mobile") ? 0.55 : 0.65)
  )

  const canvas = page.getByTestId("roadmap-canvas")
  const viewport = page.locator(".react-flow__viewport")
  await waitForViewportToSettle(viewport)
  await expectWholeRoadmapInsideCanvas(page, canvas)

  const pageHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  )
  expect(pageHasHorizontalOverflow).toBe(false)

  const clippedHeaderActions = await page
    .locator(
      ".header-actions [data-slot='button'], .header-actions [role='combobox']"
    )
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
  expect(clippedHeaderActions).toEqual([])
  await expectMinimumTouchTargets(
    page.locator(
      ".header-actions [data-slot='button'], .header-actions [role='combobox'], .roadmap-toolbar button, .roadmap-toolbar [role='combobox']"
    )
  )

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
  await expect(page.locator(".lesson-node-footer")).toHaveCount(0)
  await expect(page.getByTestId("lesson-node-course-0")).toHaveText(
    "为什么 Node.js 开发者要学 Go"
  )

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

  const transformBeforeZoom = await viewport.getAttribute("style")
  await page.locator(".react-flow__controls-zoomin").click()
  await expect
    .poll(async () => viewport.getAttribute("style"))
    .not.toBe(transformBeforeZoom)

  await page.locator(".react-flow__controls-fitview").click()
  await waitForViewportToSettle(viewport)

  const lateLesson = page.getByTestId("lesson-node-30")
  await panNodeIntoCanvas(page, lateLesson, canvas, viewport)
  await expectNodeInsideCanvas(lateLesson, canvas)
  const transformBeforeSelection = await viewport.getAttribute("style")

  await lateLesson.locator('[data-slot="card-header"]').click()
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
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "minimal Tool interface"
  )
  await expect(page.getByTestId("progress-overview")).toHaveCount(0)
  await expect(page.getByTestId("learning-progress-toggle")).toHaveCount(0)
  await expect(page.locator('[data-testid^="stage-progress-"]')).toHaveCount(0)
  await expect(learningDrawer).not.toContainText("总进度")
  await expect(learningDrawer).not.toContainText("推荐 Day")
  await expect(learningDrawer.locator(".status-badge")).toHaveCount(1)
  await expect(learningDrawer.locator(".status-badge")).toHaveText("未开始")
  await expect(learningDrawer).not.toContainText("状态生命周期")
  await expect(learningDrawer).not.toContainText("阶段进度")
  await expect(learningDrawer).not.toContainText("阶段完成")
  await expect(page.getByTestId("lesson-score")).toHaveText("—")
  await expectMinimumTouchTargets(
    learningDrawer.locator("button, [role='button']")
  )
  await expect(learningDrawer).toContainText("发布前脱敏的进度摘要")
  await expect(learningDrawer).toContainText("页面只展示，不提供手工修改")
  await expect(learningDrawer).not.toContainText("notes.md")
  await expect(learningDrawer).not.toContainText("notes-eval.md")
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
    "/courses/go-backend/sources/lessons/minimal-tool-interface.md"
  )
  await expect(page.getByTestId("lesson-resource-notes")).toHaveCount(0)
  await expect(page.getByTestId("lesson-resource-evaluation")).toHaveCount(0)

  await page.getByTestId("lesson-resource-lesson").click()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  const markdownReader = page.getByTestId("markdown-reader")
  await expect(markdownReader).toBeVisible()
  await waitForElementToSettle(markdownReader)
  const readerBox = await markdownReader.boundingBox()
  expect(readerBox).not.toBeNull()
  if (testInfo.project.name.startsWith("mobile")) {
    expect(readerBox!.width).toBeGreaterThanOrEqual(browserViewport!.width * 0.99)
    expect(readerBox!.height).toBeGreaterThanOrEqual(
      browserViewport!.height * 0.99
    )
  } else {
    expect(readerBox!.width).toBeGreaterThan(browserViewport!.width * 0.68)
    expect(readerBox!.width).toBeLessThan(browserViewport!.width * 0.72)
  }
  expect(readerBox!.height).toBeGreaterThanOrEqual(browserViewport!.height * 0.99)
  await expect(page.getByTestId("markdown-reader-back")).toHaveAccessibleName(
    "返回 Day 30 详情"
  )
  await expectMinimumTouchTargets(markdownReader.locator("button"))
  await expect(page.getByTestId("markdown-reader-title")).toHaveText(
    "Day 30 · minimal Tool interface"
  )
  const markdownContent = page.getByTestId("markdown-content")
  await expect(markdownContent).toBeVisible()
  await expect(
    markdownContent.getByRole("heading", {
      level: 1,
      name: "Day 30：minimal Tool interface",
    })
  ).toBeVisible()
  await expect(markdownContent).not.toContainText(
    "# Day 30：minimal Tool interface"
  )
  await expect(markdownContent.locator("pre code").first()).toContainText(
    "type Tool interface"
  )
  await expect(markdownContent.locator("ol > li")).not.toHaveCount(0)
  const readerHasHorizontalOverflow = await page
    .getByTestId("markdown-reader-body")
    .evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(readerHasHorizontalOverflow).toBe(false)

  const screenshotDirectory = DIAGNOSTIC_SCREENSHOT_DIRECTORY
  await mkdir(screenshotDirectory, { recursive: true })
  const screenshotName = `${testInfo.project.name}.png`
  await page.screenshot({
    path: path.join(
      screenshotDirectory,
      screenshotName.replace(".png", "-reader.png")
    ),
    fullPage: true,
  })

  await page.getByTestId("markdown-reader-back").click()
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-resource-lesson")).toBeFocused()
  await page.getByTestId("lesson-resource-lesson").click()
  await expect(page.getByTestId("markdown-reader")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-resource-lesson")).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await expect(
    page.locator(
      '.react-flow__node-lesson[data-id="lesson:minimal-tool-interface"]'
    )
  ).toBeFocused()
  await expect(page.getByTestId("roadmap-location")).toHaveText("全图概览")

  const courseTitleLink = page.getByTestId("lesson-node-course-30")
  const transformBeforeReader = await viewport.getAttribute("style")
  await courseTitleLink.click()
  await expect(page.getByTestId("markdown-reader")).toBeVisible()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await expect(page.getByTestId("markdown-reader-back")).toHaveCount(0)
  await waitForViewportToSettle(viewport)
  expect(await viewport.getAttribute("style")).toBe(transformBeforeReader)
  await page.getByRole("button", { name: "关闭课程阅读器" }).click()
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect(courseTitleLink).toBeFocused()
  expect(popupCount).toBe(0)

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

  await page.getByTestId("lesson-node-30").locator('[data-slot="card-header"]').click()
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
  await page.getByRole("button", { name: "关闭学习抽屉" }).click()

  expectNoRuntimeErrors()
  expect(popupCount).toBe(0)
})

test("Day 节点与应用内课程阅读器支持键盘操作", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "键盘回归使用 1440 桌面浏览器")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  let remoteImageRequests = 0
  page.on("request", (request) => {
    if (request.url().startsWith("https://images.example.com/")) {
      remoteImageRequests += 1
    }
  })

  await page.goto("/")
  const dayZero = page.locator(
    '.react-flow__node-lesson[data-id="lesson:why-go-after-node"]'
  )
  await dayZero.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "为什么 Node.js 开发者要学 Go"
  )
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  await expect(dayZero).toBeFocused()

  const dayOne = page.locator(
    '.react-flow__node-lesson[data-id="lesson:module-package-toolchain"]'
  )
  await dayOne.focus()
  await page.keyboard.press("Space")
  await expect(page.getByTestId("learning-drawer")).toBeVisible()
  await expect(page.getByTestId("lesson-detail-title")).toHaveText(
    "module / package / toolchain"
  )
  await page.getByRole("button", { name: "关闭学习抽屉" }).click()

  await page.route(
    "**/courses/go-backend/sources/lessons/module-package-toolchain.md",
    async (route) => {
      await route.fulfill({
        contentType: "text/markdown; charset=utf-8",
        body: [
          "# 键盘阅读测试",
          "",
          "- 列表项目",
          "",
          "| 状态 | 分数 |",
          "| --- | ---: |",
          "| 通过 | 100 |",
          "",
          "```go",
          "func main() {}",
          "```",
          "",
          "[安全外链](https://go.dev/doc/)",
          "[危险外链](javascript:alert(1))",
          "[本地相对链接](README.md)",
          "![远程图片](https://images.example.com/remote.png)",
          "![本地图片](./assets/diagram.png)",
          "",
          "<script>window.__unsafeMarkdown = true</script>",
        ].join("\n"),
      })
    }
  )
  const lessonLink = page.getByTestId("lesson-node-course-1")
  await lessonLink.focus()
  await page.keyboard.press("Enter")
  const reader = page.getByTestId("markdown-reader")
  await expect(reader).toBeVisible()
  await expect(page.getByTestId("learning-drawer")).toHaveCount(0)
  const markdownContent = page.getByTestId("markdown-content")
  await expect(
    markdownContent.getByRole("heading", { name: "键盘阅读测试" })
  ).toBeVisible()
  await expect(markdownContent.locator("ul > li")).toHaveText("列表项目")
  await expect(markdownContent.locator("table")).toBeVisible()
  await expect(markdownContent.locator("pre code")).toHaveText("func main() {}")
  await expect(markdownContent.locator("script")).toHaveCount(0)
  await expect(markdownContent.locator("img")).toHaveCount(0)
  await expect(markdownContent.getByRole("link", { name: "安全外链" })).toHaveAttribute(
    "rel",
    "noopener noreferrer"
  )
  await expect(markdownContent.getByText("危险外链")).not.toHaveAttribute(
    "href"
  )
  await expect(markdownContent.getByText("本地相对链接")).not.toHaveAttribute(
    "href"
  )
  expect(remoteImageRequests).toBe(0)
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __unsafeMarkdown?: boolean }).__unsafeMarkdown
    )
  ).toBeUndefined()

  await page.keyboard.press("Escape")
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect(lessonLink).toBeFocused()
  expectNoRuntimeErrors()
})

test("课程阅读器提供稳定加载态", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "加载态回归使用 1440 桌面浏览器")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  let releaseResponse!: () => void
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route(
    "**/courses/go-backend/sources/lessons/value-model-struct-zero-value.md",
    async (route) => {
      await responseGate
      await route.fulfill({
        contentType: "text/markdown; charset=utf-8",
        body: "# 加载完成\n\n课程内容已就绪。",
      })
    }
  )

  await page.goto("/")
  await page.getByTestId("lesson-node-course-2").click()
  await expect(page.getByTestId("markdown-reader-loading")).toBeVisible()
  releaseResponse()
  await expect(
    page.getByTestId("markdown-content").getByRole("heading", {
      name: "加载完成",
    })
  ).toBeVisible()
  expectNoRuntimeErrors()
})

test("课程阅读器提供错误与重试状态", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "错误态回归使用 1440 桌面浏览器")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)
  let requestCount = 0

  await page.route(
    "**/courses/go-backend/sources/lessons/value-model-struct-zero-value.md",
    async (route) => {
      requestCount += 1
      await route.fulfill({
        contentType: "text/markdown; charset=utf-8",
        body: "# 重试成功\n\n课程内容已恢复。",
      })
    }
  )

  await page.goto("/")
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window)
    const testWindow = window as Window & { __restoreMarkdownFetch?: () => void }
    testWindow.__restoreMarkdownFetch = () => {
      window.fetch = originalFetch
    }
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString()
      if (url.includes("/sources/lessons/value-model-struct-zero-value.md")) {
        return new Response("暂不可用", { status: 503 })
      }
      return originalFetch(input, init)
    }
  })
  await page.getByTestId("lesson-node-course-2").click()
  const reader = page.getByTestId("markdown-reader")
  await expect(reader).toBeVisible()
  await expect(page.getByTestId("markdown-reader-error")).toContainText(
    "HTTP 503"
  )
  await page.evaluate(() =>
    (
      window as Window & { __restoreMarkdownFetch?: () => void }
    ).__restoreMarkdownFetch?.()
  )
  await page.getByRole("button", { name: "重新加载" }).click()
  await expect(
    page.getByTestId("markdown-content").getByRole("heading", {
      name: "重试成功",
    })
  ).toBeVisible()
  expect(requestCount).toBe(1)

  await page.getByRole("button", { name: "关闭课程阅读器" }).click()
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window)
    const testWindow = window as Window & { __readerAbortCount?: number }
    testWindow.__readerAbortCount = 0
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString()
      if (url.includes("/sources/lessons/data-structures-i-array-slice-capacity-copy.md")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              testWindow.__readerAbortCount =
                (testWindow.__readerAbortCount ?? 0) + 1
              reject(new DOMException("Aborted", "AbortError"))
            },
            { once: true }
          )
        })
      }
      return originalFetch(input, init)
    }
  })
  const dayThreeLink = page.getByTestId("lesson-node-course-3")
  await dayThreeLink.click()
  await expect(page.getByTestId("markdown-reader-loading")).toBeVisible()
  const abortCountBeforeClose = await page.evaluate(
    () =>
      (window as Window & { __readerAbortCount?: number })
        .__readerAbortCount ?? 0
  )
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("markdown-reader")).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __readerAbortCount?: number })
            .__readerAbortCount ?? 0
      )
    )
    .toBeGreaterThan(abortCountBeforeClose)
  await expect(dayThreeLink).toBeFocused()
  expectNoRuntimeErrors()
})

test("文字导航、当前位置和图例能解释并定位路线图", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "完整导航回归使用 1440 桌面浏览器")
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

  await page.getByRole("button", { name: "关闭学习抽屉" }).click()
  await waitForViewportToSettle(viewport)
  await expectNodeInsideCanvas(page.getByTestId("lesson-node-30"), canvas)
  await expect(page.getByTestId("roadmap-location")).toHaveText("全图概览")
  await expect(
    page.locator('.lesson-node-card[data-selected="true"]')
  ).toHaveCount(0)

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

test("移动 Day Drawer 仅展示当日状态与证据", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Day Drawer 回归使用 390 移动视口")
  const expectNoRuntimeErrors = watchRuntimeErrors(page)

  await page.goto("/")
  await page.getByTestId("lesson-node-0").click()

  const drawer = page.getByTestId("learning-drawer")
  await expect(drawer).toBeVisible()
  await waitForElementToSettle(drawer)
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  await expect(page.getByTestId("learning-progress-toggle")).toHaveCount(0)
  await expect(page.getByTestId("progress-overview")).toHaveCount(0)
  await expect(page.locator('[data-testid^="stage-progress-"]')).toHaveCount(0)
  await expect(page.getByTestId("lesson-detail-title")).toBeVisible()
  await expect(drawer.locator(".status-badge")).toHaveCount(1)
  await expect(drawer.locator(".status-badge")).toHaveText("未开始")
  await expectElementInsideViewport(
    page.getByTestId("lesson-detail-title"),
    viewport!.height
  )
  await expectElementInsideViewport(
    drawer.locator(".lesson-evaluation-summary"),
    viewport!.height
  )
  await expect(drawer).not.toContainText("总进度")
  await expect(drawer).not.toContainText("阶段进度")
  expectNoRuntimeErrors()
})
