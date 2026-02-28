import { describe, it, expect } from "vitest"
import manifest from "./manifest"

describe("PWA Manifest", () => {
  it("returns correct app name", () => {
    const m = manifest()
    expect(m.name).toBe("Equinet - Hästtjänster")
  })

  it("returns correct short name", () => {
    const m = manifest()
    expect(m.short_name).toBe("Equinet")
  })

  it("uses standalone display mode", () => {
    const m = manifest()
    expect(m.display).toBe("standalone")
  })

  it("has correct theme and background colors", () => {
    const m = manifest()
    expect(m.theme_color).toBe("#2d7a4e")
    expect(m.background_color).toBe("#ffffff")
  })

  it("starts at root URL", () => {
    const m = manifest()
    expect(m.start_url).toBe("/")
  })

  it("includes required icon sizes", () => {
    const m = manifest()
    const sizes = m.icons?.map((icon) => icon.sizes)
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
  })

  it("includes a maskable icon", () => {
    const m = manifest()
    const maskable = m.icons?.find((icon) => icon.purpose === "maskable")
    expect(maskable).toBeDefined()
    expect(maskable?.sizes).toBe("512x512")
  })

  it("uses Swedish language", () => {
    const m = manifest()
    expect(m.lang).toBe("sv")
  })
})
