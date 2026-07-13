import { describe, expect, it } from "vitest"

import {
  createChromiumHostResolverRule,
  createPinnedHttpsRequestOptions,
  fetchTrustedResponse,
  isPrivateOrLocalAddress,
  parseTrustedDeploymentUrl,
  resolveTrustedDeployment,
} from "./deployment-url.ts"

describe("部署 URL 信任边界", () => {
  it.each([
    ["https://go-together-roadmap.vercel.app", undefined],
    ["https://go-together-roadmap-git-main-team.vercel.app/path", undefined],
    ["https://go-together-roadmap-pr-123-a1b2c3.vercel.app/path", undefined],
  ])("允许受信 Vercel HTTPS 主机 %s", (input) => {
    expect(parseTrustedDeploymentUrl(input).href).toMatch(/\/$/)
  })

  it.each([
    "http://go-together-roadmap.vercel.app",
    "https://user:password@go-together-roadmap.vercel.app",
    "https://go-together-roadmap.vercel.app?token=x",
    "https://go-together-roadmap.vercel.app#fragment",
    "https://go-together-roadmap.vercel.app:444",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://learn.example.com",
    "https://unrelated-project.vercel.app",
    "https://go-together-roadmap.vercel.app.evil.example",
  ])("拒绝不受信地址 %s", (input) => {
    expect(() => parseTrustedDeploymentUrl(input)).toThrow()
  })

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::",
    "ff02::1",
    "2001:db8::1",
    "not-an-address",
  ])("识别私有或链路本地地址 %s", (address) => {
    expect(isPrivateOrLocalAddress(address)).toBe(true)
  })

  it.each(["76.76.21.21", "::ffff:76.76.21.21", "2606:4700:4700::1111"])(
    "允许公网单播地址 %s",
    (address) => {
      expect(isPrivateOrLocalAddress(address)).toBe(false)
    }
  )

  it("DNS 只解析一次并冻结公网地址，后续 lookup 不接受重绑定结果", async () => {
    const url = parseTrustedDeploymentUrl(
      "https://go-together-roadmap.vercel.app"
    )
    let calls = 0
    const resolved = await resolveTrustedDeployment(url, async () => {
      calls += 1
      return calls === 1 ? ["76.76.21.21"] : ["127.0.0.1"]
    })
    expect(calls).toBe(1)
    expect(resolved.addresses).toEqual([
      { address: "76.76.21.21", family: 4 },
    ])

    const requestOptions = createPinnedHttpsRequestOptions(resolved, url)
    const lookup = requestOptions.lookup
    expect(lookup).toBeTypeOf("function")
    const pinned = await new Promise<{ address: string; family: number }>(
      (resolve, reject) => {
        lookup!(url.hostname, {}, (error, address, family) => {
          if (error) reject(error)
          else resolve({ address: address as string, family: family as number })
        })
      }
    )
    expect(pinned).toEqual({ address: "76.76.21.21", family: 4 })
    expect(calls).toBe(1)
    expect(requestOptions.servername).toBe(url.hostname)
    expect(createChromiumHostResolverRule(resolved)).toBe(
      "MAP go-together-roadmap.vercel.app 76.76.21.21,EXCLUDE localhost"
    )

    await expect(
      resolveTrustedDeployment(url, async () => ["169.254.169.254"])
    ).rejects.toThrow("公网单播")
  })

  it("无 IPv4 时生成经过固定格式验证的 IPv6 Chromium 映射", async () => {
    const url = parseTrustedDeploymentUrl(
      "https://go-together-roadmap-ipv6.vercel.app"
    )
    const resolved = await resolveTrustedDeployment(url, async () => [
      "2606:4700:4700::1111",
    ])
    expect(resolved.selectedAddress).toEqual({
      address: "2606:4700:4700::1111",
      family: 6,
    })
    expect(createChromiumHostResolverRule(resolved)).toBe(
      "MAP go-together-roadmap-ipv6.vercel.app [2606:4700:4700::1111],EXCLUDE localhost"
    )
  })

  it("不发外部请求即可验证重定向和跨主机响应被拒绝", async () => {
    const url = parseTrustedDeploymentUrl(
      "https://go-together-roadmap.vercel.app"
    )
    const resolved = await resolveTrustedDeployment(url, async () => [
      "76.76.21.21",
    ])
    const redirectFetch = async () =>
      ({
        status: 302,
        redirected: false,
        url: url.href,
        headers: new Headers({ location: "https://evil.example" }),
      }) as Response
    await expect(
      fetchTrustedResponse(resolved, url, redirectFetch)
    ).rejects.toThrow(
      "不允许 HTTP 重定向"
    )

    const crossHostFetch = async () =>
      ({
        status: 200,
        redirected: false,
        url: "https://evil.example/",
        headers: new Headers(),
      }) as Response
    await expect(
      fetchTrustedResponse(resolved, url, crossHostFetch)
    ).rejects.toThrow("跨越受信主机")
  })
})
