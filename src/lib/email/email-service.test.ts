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
    // Production so the env-safety guard does not block first — this test
    // isolates the runtime disable_emails setting.
    vi.stubEnv("VERCEL_ENV", "production")
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
    // Production so the env-safety guard does not block first.
    vi.stubEnv("VERCEL_ENV", "production")
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

describe("EmailService env-safety blocker", () => {
  beforeEach(() => {
    clearRuntimeSettings()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("blocks email send in a staging-safe environment, returns mock success", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
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
    vi.stubEnv("VERCEL_ENV", "preview")
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

  it("blocks even when Resend is properly configured, in a staging-safe env", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
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

  it("follows environment, not demo: blocks in preview even with NEXT_PUBLIC_DEMO_MODE unset", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "")
    vi.stubEnv("RESEND_API_KEY", "re_valid_key_123")
    vi.stubEnv("DISABLE_EMAILS", "")

    const { emailService } = await import("./email-service")
    const result = await emailService.send({
      to: "x@example.com",
      subject: "x",
      html: "<p>x</p>",
    })

    // Demo is off but the environment is staging-safe → still blocked.
    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^demo-blocked-/)
  })

  it("does not block in production (real side effects allowed)", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("DISABLE_EMAILS", "")

    const { emailService } = await import("./email-service")
    const result = await emailService.send({
      to: "x@example.com",
      subject: "x",
      html: "<p>x</p>",
    })

    // Falls back to mock mode (no API key) — NOT env-blocked
    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^mock-/)
    expect(result.messageId).not.toMatch(/^demo-blocked-/)
  })
})
