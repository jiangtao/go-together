import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page, type Route } from "@playwright/test"

import {
  GITHUB_REPOSITORY_API_URL,
  GITHUB_REPOSITORY_FORK_URL,
  GITHUB_REPOSITORY_URL,
} from "../../src/lib/github-repository"

const VISUAL_EVIDENCE_DIRECTORY = process.env.REPOSITORY_ACTION_EVIDENCE_DIR

async function fulfillRepository(
  route: Route,
  response: { status: number; body?: unknown }
) {
  await route.fulfill({
    status: response.status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response.body ?? {}),
  })
}

async function expectFallbackLinks(page: Page) {
  await expect(page.getByTestId("repository-actions")).toBeVisible()
  await expect(page.getByTestId("repository-link")).toHaveAttribute(
    "href",
    GITHUB_REPOSITORY_URL
  )
  await expect(page.getByTestId("repository-star")).toHaveAttribute(
    "href",
    GITHUB_REPOSITORY_URL
  )
  await expect(page.getByTestId("repository-fork")).toHaveAttribute(
    "href",
    GITHUB_REPOSITORY_FORK_URL
  )
  await expect(page.getByTestId("repository-star-count")).toHaveCount(0)
  await expect(page.getByTestId("repository-fork-count")).toHaveCount(0)
  await expect(page.getByTestId("repository-star")).toHaveAccessibleName(
    "在 GitHub 为 go-together 点 Star"
  )
  await expect(page.getByTestId("repository-fork")).toHaveAccessibleName(
    "在 GitHub Fork go-together"
  )
}

test("公开仓库操作展示实时计数、规范链接且四视口不溢出", async ({
  page,
}, testInfo) => {
  let requestCount = 0
  let requestHeaders: Record<string, string> = {}
  await page.route(GITHUB_REPOSITORY_API_URL, async (route) => {
    requestCount += 1
    requestHeaders = await route.request().allHeaders()
    await fulfillRepository(route, {
      status: 200,
      body: { stargazers_count: 321, forks_count: 45 },
    })
  })

  await page.goto("/")
  const repositoryActions = page.getByTestId("repository-actions")
  await expect(repositoryActions).toBeVisible()
  await expect(page.getByTestId("repository-star-count")).toHaveText("321")
  await expect(page.getByTestId("repository-fork-count")).toHaveText("45")
  expect(requestCount).toBe(1)
  expect(requestHeaders.accept).toBe("application/vnd.github+json")
  expect(requestHeaders["x-github-api-version"]).toBe("2022-11-28")
  expect(requestHeaders.authorization).toBeUndefined()

  const links = [
    {
      testId: "repository-link",
      href: GITHUB_REPOSITORY_URL,
      name: "在 GitHub 查看 jiangtao/go-together 源码",
    },
    {
      testId: "repository-star",
      href: GITHUB_REPOSITORY_URL,
      name: "在 GitHub 为 go-together 点 Star，当前 321 个 Star",
    },
    {
      testId: "repository-fork",
      href: GITHUB_REPOSITORY_FORK_URL,
      name: "在 GitHub Fork go-together，当前 45 个 Fork",
    },
  ]
  for (const link of links) {
    const locator = page.getByTestId(link.testId)
    await expect(locator).toHaveAttribute("href", link.href)
    await expect(locator).toHaveAttribute("target", "_blank")
    await expect(locator).toHaveAttribute("rel", "noreferrer noopener")
    await expect(locator).toHaveAccessibleName(link.name)
  }

  const layout = await repositoryActions.evaluate((element) => {
    const actionRect = element.getBoundingClientRect()
    const links = Array.from(element.querySelectorAll("a")).map((link) => {
      const rect = link.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    })
    return {
      left: actionRect.left,
      right: actionRect.right,
      top: actionRect.top,
      bottom: actionRect.bottom,
      links,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      hasPageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.top).toBeGreaterThanOrEqual(0)
  expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight)
  expect(layout.hasPageOverflow).toBe(false)
  for (let index = 1; index < layout.links.length; index += 1) {
    expect(layout.links[index].left).toBeGreaterThanOrEqual(
      layout.links[index - 1].right
    )
  }

  if (
    VISUAL_EVIDENCE_DIRECTORY &&
    ["desktop-chromium", "mobile-390"].includes(testInfo.project.name)
  ) {
    await mkdir(VISUAL_EVIDENCE_DIRECTORY, { recursive: true })
    await page.screenshot({
      path: path.join(
        VISUAL_EVIDENCE_DIRECTORY,
        `repository-actions-${testInfo.project.name}.png`
      ),
      fullPage: true,
    })
  }

  await page.getByTestId("roadmap-zen-enter").click()
  await expect(page.getByTestId("repository-actions")).toHaveCount(0)
  await expect(page.getByTestId("roadmap-zen-toolbar")).toBeVisible()
})

test("畸形 API 响应保留三个链接并隐藏计数", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "回退分支集中在桌面项目验证"
  )
  let requestCount = 0
  await page.route(GITHUB_REPOSITORY_API_URL, async (route) => {
    requestCount += 1
    await fulfillRepository(route, {
      status: 200,
      body: { stargazers_count: "321", forks_count: -1 },
    })
  })
  await page.goto("/")
  await expect.poll(() => requestCount).toBe(1)
  await expectFallbackLinks(page)
})

for (const status of [403, 429]) {
  test(`GitHub API HTTP ${status} 时无重试并优雅回退`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "回退分支集中在桌面项目验证"
    )
    let requestCount = 0
    await page.route(GITHUB_REPOSITORY_API_URL, async (route) => {
      requestCount += 1
      await fulfillRepository(route, { status })
    })
    await page.goto("/")
    await expect.poll(() => requestCount).toBe(1)
    await expectFallbackLinks(page)
  })
}

test("GitHub API 网络错误时无重试并优雅回退", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "回退分支集中在桌面项目验证"
  )
  let requestCount = 0
  await page.route(GITHUB_REPOSITORY_API_URL, async (route) => {
    requestCount += 1
    await route.abort("failed")
  })
  await page.goto("/")
  await expect.poll(() => requestCount).toBe(1)
  await expectFallbackLinks(page)
})
