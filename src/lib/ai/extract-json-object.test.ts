import { describe, it, expect } from "vitest"
import { extractJsonObject } from "./extract-json-object"

describe("extractJsonObject", () => {
  it("returns plain JSON as-is", () => {
    const json = '{"foo":"bar","n":1}'
    expect(extractJsonObject(json)).toBe(json)
  })

  it("trims surrounding whitespace on plain JSON", () => {
    const json = '{"foo":"bar"}'
    expect(extractJsonObject(`  \n${json}\n  `)).toBe(json)
  })

  it("strips markdown code fences (```json)", () => {
    const json = '{"foo":"bar"}'
    expect(extractJsonObject(`\`\`\`json\n${json}\n\`\`\``)).toBe(json)
  })

  it("strips markdown code fences without language tag (```)", () => {
    const json = '{"foo":"bar"}'
    expect(extractJsonObject(`\`\`\`\n${json}\n\`\`\``)).toBe(json)
  })

  it("strips prose before the JSON object", () => {
    const json = '{"foo":"bar"}'
    expect(extractJsonObject(`Här är analysen:\n${json}`)).toBe(json)
  })

  it("strips prose after the JSON object", () => {
    const json = '{"foo":"bar"}'
    expect(extractJsonObject(`${json}\n\nHoppas detta hjälper!`)).toBe(json)
  })

  it("strips prose both before and after JSON", () => {
    const json = '{"foo":"bar"}'
    expect(
      extractJsonObject(`Visst, här:\n${json}\n\nHör av dig om något.`)
    ).toBe(json)
  })

  it("handles markdown code block wrapped in prose", () => {
    const json = '{"foo":"bar"}'
    expect(
      extractJsonObject(
        `Visst, här kommer analysen:\n\`\`\`json\n${json}\n\`\`\`\nHör av dig.`
      )
    ).toBe(json)
  })

  it("preserves nested objects (returns full outer object via lastIndexOf)", () => {
    const json = '{"outer":{"inner":1},"x":2}'
    expect(extractJsonObject(`Result:\n${json}\nDone`)).toBe(json)
  })

  it("preserves braces inside string values", () => {
    const json = '{"text":"this has {braces} inside","n":1}'
    expect(extractJsonObject(json)).toBe(json)
  })

  it("returns trimmed input when no opening brace exists", () => {
    expect(extractJsonObject("This is not JSON at all")).toBe(
      "This is not JSON at all"
    )
  })

  it("returns trimmed input when no closing brace exists", () => {
    expect(extractJsonObject("Plain text { missing close")).toBe(
      "Plain text { missing close"
    )
  })

  it("returns trimmed input when closing brace comes before opening", () => {
    expect(extractJsonObject("} text {")).toBe("} text {")
  })

  it("returns trimmed input for empty string", () => {
    expect(extractJsonObject("")).toBe("")
  })

  it("returns trimmed input for whitespace-only string", () => {
    expect(extractJsonObject("   \n\t  ")).toBe("")
  })
})
