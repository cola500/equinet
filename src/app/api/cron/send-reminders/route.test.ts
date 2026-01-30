import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"

const mockProcessAll = vi.fn()

vi.mock("@/domain/reminder/ReminderService", () => ({
  ReminderService: class {
    processAll = mockProcessAll
  },
}))

describe("GET /api/cron/send-reminders", () => {
  const CRON_SECRET = "test-cron-secret"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", CRON_SECRET)
  })

  it("should process reminders when authorized with correct secret", async () => {
    mockProcessAll.mockResolvedValue(3)

    const request = new NextRequest(
      "http://localhost:3000/api/cron/send-reminders",
      {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
        },
      }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.remindersSent).toBe(3)
    expect(mockProcessAll).toHaveBeenCalledTimes(1)
  })

  it("should return 401 when authorization is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/cron/send-reminders"
    )

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(mockProcessAll).not.toHaveBeenCalled()
  })

  it("should return 401 when secret is wrong", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/cron/send-reminders",
      {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }
    )

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(mockProcessAll).not.toHaveBeenCalled()
  })

  it("should return 500 when processing fails", async () => {
    mockProcessAll.mockRejectedValue(new Error("Database error"))

    const request = new NextRequest(
      "http://localhost:3000/api/cron/send-reminders",
      {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
        },
      }
    )

    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})
