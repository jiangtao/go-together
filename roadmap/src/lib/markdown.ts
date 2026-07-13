const ENCODED_SEPARATOR_OR_NULL = /%(?:00|2f|5c)/i

export function normalizeSourceUrl(href: string, origin: string): string {
  const expectedOrigin = new URL(origin)
  const sourceUrl = new URL(href, expectedOrigin)

  if (
    !["http:", "https:"].includes(sourceUrl.protocol) ||
    sourceUrl.origin !== expectedOrigin.origin ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.search ||
    sourceUrl.hash ||
    !sourceUrl.pathname.startsWith("/sources/lessons/") ||
    ENCODED_SEPARATOR_OR_NULL.test(sourceUrl.pathname)
  ) {
    throw new Error("拒绝加载不安全的课程资源地址")
  }

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(sourceUrl.pathname)
  } catch {
    throw new Error("拒绝加载无法解析的课程资源地址")
  }

  const pathSegments = decodedPath.split("/")
  if (
    decodedPath.includes("\\") ||
    decodedPath.includes("\0") ||
    pathSegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("拒绝加载越界的课程资源地址")
  }

  return sourceUrl.pathname
}

export function normalizeExternalUrl(href: string): string | null {
  try {
    const url = new URL(href)
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.href
      : null
  } catch {
    return null
  }
}

export function normalizeImageLink(
  src: string,
  sourceHref: string,
  origin: string
): string | null {
  const externalUrl = normalizeExternalUrl(src)
  if (externalUrl && !externalUrl.startsWith("mailto:")) {
    return externalUrl
  }

  try {
    const absoluteSourceUrl = new URL(sourceHref, origin)
    const imageUrl = new URL(src, absoluteSourceUrl)
    return normalizeSourceUrl(imageUrl.href, origin)
  } catch {
    return null
  }
}
