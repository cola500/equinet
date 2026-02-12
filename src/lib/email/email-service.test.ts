import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  setRuntimeSetting,
  clearRuntimeSettings,
} from "@/lib/settings/runtime-settings"

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
