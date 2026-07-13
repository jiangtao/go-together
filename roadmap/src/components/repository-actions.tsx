import { useEffect, useState } from "react"
import { GitForkIcon, StarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  GITHUB_REPOSITORY_FORK_URL,
  GITHUB_REPOSITORY_URL,
  loadGitHubRepositoryCountsOnce,
  type GitHubRepositoryCounts,
} from "@/lib/github-repository"

const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noreferrer noopener",
} as const

const countFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.9 18 5.2 18 5.2c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2V23c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}

function Count({ value, testId }: { value: number; testId: string }) {
  return (
    <span className="repository-count" data-testid={testId} aria-hidden="true">
      {countFormatter.format(value)}
    </span>
  )
}

export function RepositoryActions() {
  const [counts, setCounts] = useState<GitHubRepositoryCounts | null>(null)

  useEffect(() => {
    let active = true
    void loadGitHubRepositoryCountsOnce().then((nextCounts) => {
      if (active) setCounts(nextCounts)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <nav
      className="repository-actions"
      aria-label="项目开源仓库操作"
      data-testid="repository-actions"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="outline" size="sm" className="repository-action">
            <a
              href={GITHUB_REPOSITORY_URL}
              aria-label="在 GitHub 查看 jiangtao/go-together 源码"
              data-testid="repository-link"
              {...EXTERNAL_LINK_PROPS}
            >
              <GitHubMark />
              <span className="repository-action-label repository-source-label">
                go-together
              </span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>在 GitHub 查看项目源码</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="outline" size="sm" className="repository-action">
            <a
              href={GITHUB_REPOSITORY_URL}
              aria-label={
                counts
                  ? `在 GitHub 为 go-together 点 Star，当前 ${counts.stars} 个 Star`
                  : "在 GitHub 为 go-together 点 Star"
              }
              data-testid="repository-star"
              {...EXTERNAL_LINK_PROPS}
            >
              <StarIcon aria-hidden="true" />
              <span className="repository-action-label">Star</span>
              {counts ? (
                <Count value={counts.stars} testId="repository-star-count" />
              ) : null}
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>前往 GitHub Star 项目</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="outline" size="sm" className="repository-action">
            <a
              href={GITHUB_REPOSITORY_FORK_URL}
              aria-label={
                counts
                  ? `在 GitHub Fork go-together，当前 ${counts.forks} 个 Fork`
                  : "在 GitHub Fork go-together"
              }
              data-testid="repository-fork"
              {...EXTERNAL_LINK_PROPS}
            >
              <GitForkIcon aria-hidden="true" />
              <span className="repository-action-label">Fork</span>
              {counts ? (
                <Count value={counts.forks} testId="repository-fork-count" />
              ) : null}
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>在 GitHub 创建项目 Fork</TooltipContent>
      </Tooltip>
    </nav>
  )
}
