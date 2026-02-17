import { describe, it, expect, vi, beforeEach } from "vitest"

const mockProcessAll = vi.fn().mockResolvedValue(3)

vi.mock("@/domain/reminder/BookingReminderService", () => ({
  BookingReminderService: class {
    processAll = mockProcessAll
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { GET } from "./route"

describe("GET /api/cron/booking-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-secret"
  })

  it("returns 200 and processes reminders with valid CRON_SECRET", async () => {
    const request = new Request("http://localhost/api/cron/booking-reminders", {
      headers: { authorization: "Bearer test-secret" },
    })

    const response = await GET(request as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.remindersSent).toBe(3)
    expect(body.processedAt).toBeDefined()
  })

  it("returns 401 with invalid auth", async () => {
    const request = new Request("http://localhost/api/cron/booking-reminders", {
      headers: { authorization: "Bearer wrong-secret" },
    })

    const response = await GET(request as never)

    expect(response.status).toBe(401)
  })

  it("returns 401 with missing auth", async () => {
    const request = new Request("http://localhost/api/cron/booking-reminders")

    const response = await GET(request as never)

    expect(response.status).toBe(401)
  })

  it("returns 500 on database error", async () => {
    mockProcessAll.mockRejectedValueOnce(new Error("DB down"))

    const request = new Request("http://localhost/api/cron/booking-reminders", {
      headers: { authorization: "Bearer test-secret" },
    })

    const response = await GET(request as never)

    expect(response.status).toBe(500)
  })
})
