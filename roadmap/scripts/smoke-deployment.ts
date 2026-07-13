import { chromium } from "@playwright/test"

import { parseCourseData } from "../src/lib/course-data.ts"
import {
  createChromiumHostResolverRule,
  fetchTrustedResponse,
  parseTrustedDeploymentUrl,
  resolveTrustedDeployment,
  type ResolvedDeployment,
} from "./lib/deployment-url.ts"

function deploymentUrl(): URL {
  const input = process.argv[2] ?? process.env.DEPLOYMENT_URL
  if (!input) {
    throw new Error("请传入 Preview URL 或设置 DEPLOYMENT_URL")
  }
  return parseTrustedDeploymentUrl(input)
}

function at(base: URL, pathname: string): URL {
  return new URL(pathname.replace(/^\//, ""), base)
}

async function requireResponse(
  deployment: ResolvedDeployment,
  url: URL,
  expectedContentType: RegExp
): Promise<Response> {
  const response = await fetchTrustedResponse(deployment, url)
  if (response.status !== 200) {
    throw new Error(`${url.pathname} 返回 HTTP ${response.status}`)
  }
  const contentType = response.headers.get("content-type") ?? ""
  if (!expectedContentType.test(contentType)) {
    throw new Error(`${url.pathname} Content-Type 异常：${contentType}`)
  }
  return response
}

function requireHeader(response: Response, name: string, pattern: RegExp): void {
  const value = response.headers.get(name) ?? ""
  if (!pattern.test(value)) {
    throw new Error(`${response.url} 缺少或不符合 ${name}：${value}`)
  }
}

async function runHttpSmoke(deployment: ResolvedDeployment) {
  const base = deployment.baseUrl
  const indexResponse = await requireResponse(deployment, base, /text\/html/i)
  const indexHtml = await indexResponse.text()
  if (!indexHtml.includes('id="root"')) {
    throw new Error("首页缺少 React root")
  }
  requireHeader(indexResponse, "content-security-policy", /default-src 'self'/i)
  requireHeader(indexResponse, "content-security-policy", /frame-ancestors 'none'/i)
  requireHeader(indexResponse, "x-content-type-options", /^nosniff$/i)
  requireHeader(indexResponse, "referrer-policy", /strict-origin-when-cross-origin/i)
  requireHeader(indexResponse, "permissions-policy", /camera=\(\)/i)

  const courseResponse = await requireResponse(
    deployment,
    at(base, "/course.json"),
    /application\/json/i
  )
  requireHeader(courseResponse, "cache-control", /must-revalidate/i)
  const course = parseCourseData(await courseResponse.json())
  for (const day of [0, 36]) {
    const lesson = course.lessons[day]
    const lessonResponse = await requireResponse(
      deployment,
      at(base, lesson.lessonHref),
      /(?:text\/markdown|text\/plain)/i
    )
    requireHeader(lessonResponse, "cache-control", /must-revalidate/i)
    const markdown = await lessonResponse.text()
    if (!markdown.includes(`# Day ${String(day).padStart(2, "0")}`)) {
      throw new Error(`Day ${day} 教程内容不完整`)
    }
  }

  await requireResponse(
    deployment,
    at(base, "/roadmap-smoke"),
    /text\/html/i
  )
  const assetPath = indexHtml.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1]
  if (!assetPath) throw new Error("首页未引用带哈希的静态资源")
  const assetResponse = await requireResponse(
    deployment,
    at(base, assetPath),
    /(?:javascript|text\/css|font)/i
  )
  requireHeader(assetResponse, "cache-control", /immutable/i)
  return { course, assetPath }
}

async function runBrowserSmoke(deployment: ResolvedDeployment) {
  const base = deployment.baseUrl
  const runtimeErrors: string[] = []
  const browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: [
      `--host-resolver-rules=${createChromiumHostResolverRule(deployment)}`,
    ],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url())
      if (requestUrl.origin !== base.origin) {
        await route.abort("blockedbyclient")
        return
      }
      await route.continue()
    })
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text())
    })
    page.on("pageerror", (error) => runtimeErrors.push(error.message))
    page.on("requestfailed", (request) => {
      runtimeErrors.push(
        `${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`
      )
    })

    await page.goto(base.href, { waitUntil: "networkidle" })
    if (new URL(page.url()).origin !== base.origin) {
      throw new Error("浏览器导航跨越受信部署主机")
    }
    await page.locator(".react-flow__node").first().waitFor({ state: "visible" })
    if ((await page.locator(".react-flow__node").count()) !== 47) {
      throw new Error("线上路线图节点数不是 47")
    }
    await page
      .getByTestId("lesson-node-0")
      .locator('[data-slot="card-header"]')
      .click()
    await page.getByTestId("learning-drawer").waitFor({ state: "visible" })
    await page.getByTestId("learning-drawer-close").click()
    await page.getByTestId("lesson-node-course-0").click()
    await page.getByTestId("markdown-content").waitFor({ state: "visible" })
    await page.getByTestId("markdown-reader-close").click()
    await page.getByTestId("roadmap-zen-enter").click()
    await page.getByTestId("roadmap-zen-toolbar").waitFor({ state: "visible" })
    if (runtimeErrors.length > 0) {
      throw new Error(`线上运行时错误：${runtimeErrors.join(" | ")}`)
    }
  } finally {
    await browser.close()
  }
}

try {
  const base = deploymentUrl()
  const deployment = await resolveTrustedDeployment(base)
  const httpResult = await runHttpSmoke(deployment)
  await runBrowserSmoke(deployment)
  console.log(
    `部署 smoke 通过：${base.origin}，schema v${httpResult.course.schemaVersion}，静态资源 ${httpResult.assetPath}`
  )
} catch (error) {
  console.error("部署 smoke 失败：", error)
  process.exitCode = 1
}
