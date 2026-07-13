import { describe, expect, it, vi } from "vitest"

import {
  fetchGitHubRepositoryCounts,
  GITHUB_REPOSITORY_API_URL,
  GITHUB_REPOSITORY_FORK_URL,
  GITHUB_REPOSITORY_URL,
  parseGitHubRepositoryCounts,
} from "./github-repository"

describe("GitHub 公开仓库元数据", () => {
  it("使用规范 URL 与官方请求头读取并校验 Star/Fork 数", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ stargazers_count: 1_234, forks_count: 56 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    await expect(fetchGitHubRepositoryCounts(fetcher)).resolves.toEqual({
      stars: 1_234,
      forks: 56,
    })
    expect(GITHUB_REPOSITORY_URL).toBe(
      "https://github.com/jiangtao/go-together"
    )
    expect(GITHUB_REPOSITORY_FORK_URL).toBe(
      "https://github.com/jiangtao/go-together/fork"
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      GITHUB_REPOSITORY_API_URL,
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: expect.any(AbortSignal),
      })
    )
  })

  it("拒绝畸形、负数、小数与越界计数", () => {
    expect(parseGitHubRepositoryCounts(null)).toBeNull()
    expect(
      parseGitHubRepositoryCounts({ stargazers_count: "12", forks_count: 3 })
    ).toBeNull()
    expect(
      parseGitHubRepositoryCounts({ stargazers_count: -1, forks_count: 3 })
    ).toBeNull()
    expect(
      parseGitHubRepositoryCounts({ stargazers_count: 12, forks_count: 1.5 })
    ).toBeNull()
    expect(
      parseGitHubRepositoryCounts({
        stargazers_count: Number.MAX_SAFE_INTEGER + 1,
        forks_count: 3,
      })
    ).toBeNull()
  })

  it.each([403, 429])("HTTP %s 时静默降级且不重试", async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status }))

    await expect(fetchGitHubRepositoryCounts(fetcher)).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("网络错误与超时均静默降级", async () => {
    const failedFetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"))
    await expect(fetchGitHubRepositoryCounts(failedFetcher)).resolves.toBeNull()

    const hangingFetcher = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        })
      })
    })
    await expect(fetchGitHubRepositoryCounts(hangingFetcher, 5)).resolves.toBeNull()
    expect(hangingFetcher).toHaveBeenCalledTimes(1)
  })
})
