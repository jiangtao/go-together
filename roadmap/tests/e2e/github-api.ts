import type { Page } from "@playwright/test"

import { GITHUB_REPOSITORY_API_URL } from "../../src/lib/github-repository"

export const MOCK_REPOSITORY_COUNTS = {
  stargazers_count: 321,
  forks_count: 45,
}

export async function mockGitHubRepositoryApi(page: Page): Promise<void> {
  await page.route(GITHUB_REPOSITORY_API_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(MOCK_REPOSITORY_COUNTS),
    })
  })
}
