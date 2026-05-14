import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  setRuntimeSetting,
  clearRuntimeSettings,
} from "@/lib/settings/runtime-settings"
import { logger } from "@/lib/logger"

// We test the EmailService class behavior via `send()` since `isConfigured` is private.
// When not configured, `send()` returns a mock messageId (starts with "mock-").

describe("EmailService runtime toggle", () => {
  beforeEach(() => {
    clearRuntimeSettings()
    vi.unstubAllEnvs()
  })

  it("uses mock mode when runtime setting disable_emails is true", async () => {
    // Clear RESEND_API_KEY so we can isolate the runtime setting test
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")
    vi.stubEnv("DISABLE_EMAILS", "")

    // Re-import to pick up stubbed env
    const { emailService } = await import("./email-service")

    setRuntimeSetting("disable_emails", "true")

    const result = await emailService.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^mock-/)
  })

  it("env DISABLE_EMAILS takes priority over runtime setting", async () => {
    vi.stubEnv("DISABLE_EMAILS", "true")
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")

    const { emailService } = await import("./email-service")

    // Even if runtime says emails are enabled, env overrides
    setRuntimeSetting("disable_emails", "false")

    const result = await emailService.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^mock-/)
  })
})

describe("EmailService demo-mode blocker", () => {
  beforeEach(() => {
    clearRuntimeSettings()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("blocks email send when NEXT_PUBLIC_DEMO_MODE=true, returns mock success", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")
    vi.stubEnv("DISABLE_EMAILS", "")

    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const { emailService } = await import("./email-service")
    const result = await emailService.send({
      to: "real-customer@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^demo-blocked-/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("logs [DEMO_EMAIL_BLOCKED] with recipient and subject when blocking", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")

    // Import the logger from the *fresh* module graph (after resetModules)
    // so we spy on the same instance email-service.ts will use.
    const { logger: freshLogger } = await import("@/lib/logger")
    const infoSpy = vi.spyOn(freshLogger, "info").mockImplementation(() => {})

    const { emailService } = await import("./email-service")
    await emailService.send({
      to: "real-customer@example.com",
      subject: "Bokningsbekräftelse",
      html: "<p>x</p>",
    })

    const blockedCall = infoSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[DEMO_EMAIL_BLOCKED]"),
    )
    expect(blockedCall).toBeDefined()
    expect(blockedCall?.[1]).toMatchObject({
      to: "real-customer@example.com",
      subject: "Bokningsbekräftelse",
    })
  })

  it("demo-mode blocks even when Resend is properly configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")
    vi.stubEnv("DISABLE_EMAILS", "")

    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const { emailService } = await import("./email-service")
    const result = await emailService.send({
      to: "x@example.com",
      subject: "x",
      html: "<p>x</p>",
    })

    expect(result.success).toBe(true)
    expect(result.messageId).not.toMatch(/^mock-/)
    expect(result.messageId).toMatch(/^demo-blocked-/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("does not block when NEXT_PUBLIC_DEMO_MODE is unset (normal env)", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "")
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("DISABLE_EMAILS", "")

    const { emailService } = await import("./email-service")
    const result = await emailService.send({
      to: "x@example.com",
      subject: "x",
      html: "<p>x</p>",
    })

    // Falls back to mock mode (no API key) — NOT demo-blocked
    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^mock-/)
    expect(result.messageId).not.toMatch(/^demo-blocked-/)
  })
})
