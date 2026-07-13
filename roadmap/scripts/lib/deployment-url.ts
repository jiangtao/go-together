import { lookup } from "node:dns/promises"
import { request as httpsRequest, type RequestOptions } from "node:https"
import type { LookupFunction } from "node:net"

import ipaddr from "ipaddr.js"

const PROJECT_HOST = "go-together-roadmap.vercel.app"
const PROJECT_PREVIEW_HOST = /^go-together-roadmap-[a-z0-9-]+\.vercel\.app$/

export type AddressResolver = (hostname: string) => Promise<string[]>
export type PinnedRequestImplementation = (
  options: RequestOptions,
  url: URL
) => Promise<Response>

export interface PinnedAddress {
  address: string
  family: 4 | 6
}

export interface ResolvedDeployment {
  baseUrl: URL
  addresses: PinnedAddress[]
  selectedAddress: PinnedAddress
}

function normalizedHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase()
}

function normalizePublicAddress(input: string): PinnedAddress | null {
  if (!ipaddr.isValid(input) || input.includes("%")) return null
  let parsed = ipaddr.parse(input)
  if (parsed.kind() === "ipv6") {
    const ipv6 = parsed as ReturnType<typeof ipaddr.IPv6.parse>
    if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address()
  }
  if (parsed.range() !== "unicast") return null
  return {
    address: parsed.toString(),
    family: parsed.kind() === "ipv4" ? 4 : 6,
  }
}

export function isPrivateOrLocalAddress(address: string): boolean {
  return normalizePublicAddress(address) === null
}

export function parseTrustedDeploymentUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error("Deployment URL 不是合法 URL")
  }
  const hostname = normalizedHost(url.hostname)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    ipaddr.isValid(hostname)
  ) {
    throw new Error("Deployment URL 必须是无凭证、无参数、无自定义端口的受信 HTTPS 地址")
  }
  if (hostname !== PROJECT_HOST && !PROJECT_PREVIEW_HOST.test(hostname)) {
    throw new Error(`Deployment URL 主机不在 Vercel 项目允许范围：${hostname}`)
  }
  url.hostname = hostname
  url.pathname = "/"
  return url
}

const resolveAddresses: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true, order: "verbatim" })).map(
    (record) => record.address
  )

export async function resolveTrustedDeployment(
  baseUrl: URL,
  resolver: AddressResolver = resolveAddresses
): Promise<ResolvedDeployment> {
  const answers = await resolver(baseUrl.hostname)
  const unique = new Map<string, PinnedAddress>()
  for (const answer of answers) {
    const normalized = normalizePublicAddress(answer)
    if (!normalized) {
      throw new Error(
        `Deployment URL DNS 必须全部为公网单播地址：${baseUrl.hostname}`
      )
    }
    unique.set(`${normalized.family}:${normalized.address}`, normalized)
  }
  const addresses = [...unique.values()].sort(
    (left, right) =>
      left.family - right.family || left.address.localeCompare(right.address)
  )
  if (addresses.length === 0) {
    throw new Error(`Deployment URL DNS 未返回公网单播地址：${baseUrl.hostname}`)
  }
  return {
    baseUrl,
    addresses,
    selectedAddress: addresses[0],
  }
}

export function createPinnedLookup(
  deployment: ResolvedDeployment
): LookupFunction {
  return (hostname, options, callback) => {
    if (normalizedHost(hostname) !== deployment.baseUrl.hostname) {
      callback(
        Object.assign(new Error(`拒绝解析非受信主机：${hostname}`), {
          code: "ENOTFOUND",
        }),
        "",
        0
      )
      return
    }
    const requestedFamily =
      options.family === "IPv4"
        ? 4
        : options.family === "IPv6"
          ? 6
          : options.family
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? deployment.addresses.filter(
            (candidate) => candidate.family === requestedFamily
          )
        : deployment.addresses
    if (candidates.length === 0) {
      callback(
        Object.assign(new Error(`受信 DNS 集合不含 IPv${requestedFamily}`), {
          code: "ENOTFOUND",
        }),
        "",
        0
      )
      return
    }
    if (options.all) {
      callback(null, candidates.map(({ address, family }) => ({ address, family })))
      return
    }
    callback(null, candidates[0].address, candidates[0].family)
  }
}

export function createPinnedHttpsRequestOptions(
  deployment: ResolvedDeployment,
  url: URL
): RequestOptions {
  if (url.origin !== deployment.baseUrl.origin) {
    throw new Error(`HTTP 请求跨越受信部署主机：${url.origin}`)
  }
  return {
    protocol: "https:",
    hostname: deployment.baseUrl.hostname,
    servername: deployment.baseUrl.hostname,
    port: 443,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: { Accept: "*/*" },
    lookup: createPinnedLookup(deployment),
    rejectUnauthorized: true,
  }
}

export function createChromiumHostResolverRule(
  deployment: ResolvedDeployment
): string {
  const { address, family } = deployment.selectedAddress
  const target = family === 6 ? `[${address}]` : address
  return `MAP ${deployment.baseUrl.hostname} ${target},EXCLUDE localhost`
}

const performPinnedRequest: PinnedRequestImplementation = (options, url) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(options, (incoming) => {
      const chunks: Buffer[] = []
      incoming.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      incoming.on("error", reject)
      incoming.on("end", () => {
        const headers = new Headers()
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) {
            value.forEach((entry) => headers.append(name, entry))
          } else if (value !== undefined) {
            headers.set(name, String(value))
          }
        }
        const response = new Response(Buffer.concat(chunks), {
          status: incoming.statusCode ?? 500,
          headers,
        })
        Object.defineProperty(response, "url", { value: url.href })
        resolve(response)
      })
    })
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`${url.pathname} 请求超时`))
    })
    request.on("error", reject)
    request.end()
  })

export async function fetchTrustedResponse(
  deployment: ResolvedDeployment,
  url: URL,
  requestImplementation: PinnedRequestImplementation = performPinnedRequest
): Promise<Response> {
  const options = createPinnedHttpsRequestOptions(deployment, url)
  const response = await requestImplementation(options, url)
  if (
    response.redirected ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new Error(`${url.pathname} 不允许 HTTP 重定向`)
  }
  if (response.url && new URL(response.url).origin !== url.origin) {
    throw new Error(`${url.pathname} 响应跨越受信主机`)
  }
  return response
}
