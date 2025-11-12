import { describe, it, expect } from "vitest"
import {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeSearchQuery,
  stripXss,
  sanitizeUrl,
} from "./sanitize"

describe("sanitizeString", () => {
  it("should allow normal text", () => {
    expect(sanitizeString("Hello World")).toBe("Hello World")
  })

  it("should allow Swedish characters", () => {
    expect(sanitizeString("Åsa Öberg Ärligt")).toBe("Åsa Öberg Ärligt")
  })

  it("should allow common punctuation", () => {
    expect(sanitizeString("Hello, World! How are you?")).toBe(
      "Hello, World! How are you?"
    )
  })

  it("should remove null bytes", () => {
    expect(sanitizeString("Hello\x00World")).toBe("HelloWorld")
  })

  it("should remove control characters", () => {
    expect(sanitizeString("Hello\x01\x02World")).toBe("HelloWorld")
  })

  it("should handle empty string", () => {
    expect(sanitizeString("")).toBe("")
  })

  it("should normalize multiple spaces", () => {
    expect(sanitizeString("Hello    World")).toBe("Hello World")
  })

  it("should trim whitespace", () => {
    expect(sanitizeString("  Hello World  ")).toBe("Hello World")
  })
})

describe("sanitizeEmail", () => {
  it("should normalize email to lowercase", () => {
    expect(sanitizeEmail("Test@Example.COM")).toBe("test@example.com")
  })

  it("should trim whitespace", () => {
    expect(sanitizeEmail("  test@example.com  ")).toBe("test@example.com")
  })

  it("should remove null bytes", () => {
    expect(sanitizeEmail("test\x00@example.com")).toBe("test@example.com")
  })

  it("should handle valid emails", () => {
    expect(sanitizeEmail("user.name+tag@example.co.uk")).toBe(
      "user.name+tag@example.co.uk"
    )
  })

  it("should handle empty string", () => {
    expect(sanitizeEmail("")).toBe("")
  })
})

describe("sanitizePhone", () => {
  it("should keep only digits, spaces, hyphens, parentheses, and plus", () => {
    expect(sanitizePhone("+46 (70) 123-4567")).toBe("+46 (70) 123-4567")
  })

  it("should remove letters", () => {
    expect(sanitizePhone("070-ABC-1234")).toBe("070--1234")
  })

  it("should remove special characters except allowed ones", () => {
    expect(sanitizePhone("070#123$4567")).toBe("0701234567")
  })

  it("should handle Swedish format", () => {
    expect(sanitizePhone("070-123 45 67")).toBe("070-123 45 67")
  })

  it("should handle international format", () => {
    expect(sanitizePhone("+46701234567")).toBe("+46701234567")
  })

  it("should handle empty string", () => {
    expect(sanitizePhone("")).toBe("")
  })
})

describe("sanitizeSearchQuery", () => {
  it("should allow normal search terms", () => {
    expect(sanitizeSearchQuery("hovslagning stockholm")).toBe(
      "hovslagning stockholm"
    )
  })

  it("should allow Swedish characters", () => {
    expect(sanitizeSearchQuery("ridlärare göteborg")).toBe("ridlärare göteborg")
  })

  it("should remove SQL injection attempts - quotes", () => {
    expect(sanitizeSearchQuery("test' OR '1'='1")).toBe("test OR 1=1")
  })

  it("should remove SQL injection attempts - double quotes", () => {
    expect(sanitizeSearchQuery('test" OR "1"="1')).toBe("test OR 1=1")
  })

  it("should remove SQL injection attempts - semicolons", () => {
    expect(sanitizeSearchQuery("test; DROP TABLE users;")).toBe(
      "test DROP TABLE users"
    )
  })

  it("should remove wildcards", () => {
    expect(sanitizeSearchQuery("test%value*")).toBe("testvalue")
  })

  it("should not remove backticks (not in sanitize list)", () => {
    // Note: backticks are not removed by sanitizeSearchQuery
    expect(sanitizeSearchQuery("test`DROP`")).toBe("test`DROP`")
  })

  it("should remove backslashes", () => {
    expect(sanitizeSearchQuery("test\\escape")).toBe("testescape")
  })

  it("should handle empty string", () => {
    expect(sanitizeSearchQuery("")).toBe("")
  })

  it("should preserve hyphens and spaces", () => {
    expect(sanitizeSearchQuery("häst-massage göteborg")).toBe(
      "häst-massage göteborg"
    )
  })
})

describe("stripXss", () => {
  it("should allow plain text", () => {
    expect(stripXss("Hello World")).toBe("Hello World")
  })

  it("should remove script tags", () => {
    expect(stripXss("<script>alert('xss')</script>")).toBe("")
  })

  it("should remove script tags case-insensitive", () => {
    expect(stripXss("<SCRIPT>alert('xss')</SCRIPT>")).toBe("")
  })

  it("should remove inline event handlers - onclick", () => {
    expect(stripXss("<div onclick='alert(1)'>Click</div>")).toBe(
      "&lt;div &gt;Click&lt;/div&gt;"
    )
  })

  it("should remove inline event handlers - onload", () => {
    expect(stripXss("<img onload='alert(1)'>")).toBe("&lt;img &gt;")
  })

  it("should remove inline event handlers - onerror", () => {
    expect(stripXss("<img onerror='alert(1)'>")).toBe("&lt;img &gt;")
  })

  it("should remove javascript: protocol and escape HTML", () => {
    expect(stripXss("<a href='javascript:alert(1)'>Link</a>")).toBe(
      "&lt;a href='alert(1)'&gt;Link&lt;/a&gt;"
    )
  })

  it("should remove data:text/html and escape remaining HTML", () => {
    // The script tag is removed, so only outer img tag remains, and scripts are stripped
    expect(stripXss("<img src='data:text/html,<script>alert(1)</script>'>")).toBe(
      "&lt;img src=','&gt;"
    )
  })

  it("should escape HTML tags", () => {
    expect(stripXss("<div>Test</div>")).toBe("&lt;div&gt;Test&lt;/div&gt;")
  })

  it("should handle multiple XSS attempts", () => {
    const malicious =
      "<script>alert(1)</script><div onclick='alert(2)'>Test</div>"
    expect(stripXss(malicious)).toBe("&lt;div &gt;Test&lt;/div&gt;")
  })

  it("should handle empty string", () => {
    expect(stripXss("")).toBe("")
  })
})

describe("sanitizeUrl", () => {
  it("should allow HTTP URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/")
  })

  it("should allow HTTPS URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/")
  })

  it("should allow URLs with paths", () => {
    expect(sanitizeUrl("https://example.com/path/to/page")).toBe(
      "https://example.com/path/to/page"
    )
  })

  it("should allow URLs with query parameters", () => {
    expect(sanitizeUrl("https://example.com?key=value&foo=bar")).toBe(
      "https://example.com/?key=value&foo=bar"
    )
  })

  it("should block javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull()
  })

  it("should block data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
  })

  it("should block file: protocol", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBeNull()
  })

  it("should block vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull()
  })

  it("should handle invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull()
  })

  it("should handle empty string", () => {
    expect(sanitizeUrl("")).toBeNull()
  })

  it("should handle URLs with fragments", () => {
    expect(sanitizeUrl("https://example.com#section")).toBe(
      "https://example.com/#section"
    )
  })

  it("should handle relative URLs by blocking them", () => {
    expect(sanitizeUrl("/path/to/page")).toBeNull()
  })
})
