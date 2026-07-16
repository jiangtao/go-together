import { lstatSync, readdirSync, realpathSync } from "node:fs"
import type { ServerResponse } from "node:http"
import path from "node:path"

import type { Plugin, PreviewServer, ViteDevServer } from "vite"

const STRICT_PUBLIC_PATH =
  /^(?:\/vite-manifest\.json$|\/course\.json|\/sources\/lessons\/|\/courses\/catalog\.json$|\/courses\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:course\.json|progress\.json)$|\/courses\/[a-z0-9]+(?:-[a-z0-9]+)*\/sources\/)/
const RAW_PUBLIC_PREFIX = /^\/(?:course(?:\.|%2e)json|courses|sources)(?:\/|%|$)/i
const DATA_LIKE_PUBLIC_PATH =
  /^(?:\/vite-manifest\.json$|\/course\.json$|\/sources(?:\/|$)|\/courses\/(?:catalog\.json$|[^/]+\/(?:course\.json$|progress\.json$|sources(?:\/|$))))/i

function notFound(response: ServerResponse): void {
  response.statusCode = 404
  response.setHeader("Content-Type", "text/plain; charset=utf-8")
  response.end("Not Found")
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isContainedRegularFile(publicRoot: string, candidate: string): boolean {
  try {
    const rootMetadata = lstatSync(publicRoot)
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) return false
    const relative = path.relative(publicRoot, candidate)
    if (relative.startsWith("..") || path.isAbsolute(relative)) return false
    let current = publicRoot
    for (const segment of relative.split(path.sep)) {
      if (segment === "") continue
      if (!readdirSync(current).includes(segment)) return false
      current = path.join(current, segment)
      const metadata = lstatSync(current)
      if (metadata.isSymbolicLink()) return false
    }
    if (!lstatSync(candidate).isFile()) return false
    return isInside(realpathSync(publicRoot), realpathSync(candidate))
  } catch {
    return false
  }
}

export function strictPublicFilesPlugin(publicDirectory: string): Plugin {
  const publicRoot = path.resolve(publicDirectory)
  const install = (
    server: Pick<ViteDevServer, "middlewares"> | Pick<PreviewServer, "middlewares">
  ) => {
    server.middlewares.use((request, response, next) => {
      if (request.method !== "GET" && request.method !== "HEAD") return next()
      const rawPathname = new URL(request.url ?? "/", "http://localhost").pathname
      const rawPublicPath = RAW_PUBLIC_PREFIX.test(rawPathname)
      if (rawPublicPath && rawPathname.includes("%")) {
        notFound(response)
        return
      }
      let pathname: string
      try {
        pathname = decodeURIComponent(rawPathname)
      } catch {
        if (!rawPublicPath) return next()
        notFound(response)
        return
      }
      const canonicalPublicPath = STRICT_PUBLIC_PATH.test(pathname)
      if (DATA_LIKE_PUBLIC_PATH.test(pathname) && !canonicalPublicPath) {
        notFound(response)
        return
      }
      if (!canonicalPublicPath) return next()
      const candidate = path.resolve(publicRoot, `.${pathname}`)
      if (!isContainedRegularFile(publicRoot, candidate)) {
        notFound(response)
        return
      }
      next()
    })
  }
  return {
    name: "strict-public-file-404",
    configureServer(server) {
      install(server)
    },
    configurePreviewServer(server) {
      install(server)
    },
  }
}
