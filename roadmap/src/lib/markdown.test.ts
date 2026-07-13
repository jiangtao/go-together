import { describe, expect, it } from "vitest"

import {
  normalizeExternalUrl,
  normalizeImageLink,
  normalizeSourceUrl,
} from "@/lib/markdown"

const ORIGIN = "http://127.0.0.1:5173"

describe("Markdown 资源安全边界", () => {
  it("只接受同源 sources 路径并保持规范化结果", () => {
    expect(normalizeSourceUrl("/sources/lessons/day-01.md", ORIGIN)).toBe(
      "/sources/lessons/day-01.md"
    )
    expect(
      normalizeSourceUrl(
        "http://127.0.0.1:5173/sources/lessons/day%2001.md",
        ORIGIN
      )
    ).toBe("/sources/lessons/day%2001.md")
  })

  it.each([
    "https://example.com/sources/day.md",
    "/sources/docs/day.md",
    "/not-sources/day.md",
    "/sources/%2e%2e/secret.md",
    "/sources/folder%2fsecret.md",
    "/sources/file.md?raw=1",
    "file:///tmp/day.md",
    "data:text/markdown,hello",
    "javascript:alert(1)",
  ])("拒绝不安全资源地址 %s", (href) => {
    expect(() => normalizeSourceUrl(href, ORIGIN)).toThrow("拒绝加载")
  })

  it("只允许 http(s) 与 mailto 外链", () => {
    expect(normalizeExternalUrl("https://go.dev/doc/")).toBe(
      "https://go.dev/doc/"
    )
    expect(normalizeExternalUrl("mailto:learn@example.com")).toBe(
      "mailto:learn@example.com"
    )
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeExternalUrl("README.md")).toBeNull()
  })

  it("图片仅降级为安全链接，不扩大本地读取范围", () => {
    expect(
      normalizeImageLink(
        "./assets/diagram.png",
        "/sources/lessons/day-01.md",
        ORIGIN
      )
    ).toBe("/sources/lessons/assets/diagram.png")
    expect(
      normalizeImageLink(
        "https://example.com/diagram.png",
        "/sources/lessons/a.md",
        ORIGIN
      )
    ).toBe("https://example.com/diagram.png")
    expect(
      normalizeImageLink(
        "data:image/png;base64,abc",
        "/sources/lessons/a.md",
        ORIGIN
      )
    ).toBeNull()
  })
})
