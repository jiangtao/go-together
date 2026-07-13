export const GITHUB_REPOSITORY_URL =
  "https://github.com/jiangtao/go-together"
export const GITHUB_REPOSITORY_FORK_URL = `${GITHUB_REPOSITORY_URL}/fork`
export const GITHUB_REPOSITORY_API_URL =
  "https://api.github.com/repos/jiangtao/go-together"

export interface GitHubRepositoryCounts {
  stars: number
  forks: number
}

const GITHUB_API_VERSION = "2022-11-28"
const REQUEST_TIMEOUT_MS = 5_000

function isPublicCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

export function parseGitHubRepositoryCounts(
  value: unknown
): GitHubRepositoryCounts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  if (
    !isPublicCount(record.stargazers_count) ||
    !isPublicCount(record.forks_count)
  ) {
    return null
  }

  return {
    stars: record.stargazers_count,
    forks: record.forks_count,
  }
}

export async function fetchGitHubRepositoryCounts(
  fetcher: typeof fetch = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<GitHubRepositoryCounts | null> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(GITHUB_REPOSITORY_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
    if (!response.ok) return null
    return parseGitHubRepositoryCounts(await response.json())
  } catch {
    return null
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

let repositoryCountsRequest: Promise<GitHubRepositoryCounts | null> | null = null

export function loadGitHubRepositoryCountsOnce(): Promise<GitHubRepositoryCounts | null> {
  repositoryCountsRequest ??= fetchGitHubRepositoryCounts()
  return repositoryCountsRequest
}
