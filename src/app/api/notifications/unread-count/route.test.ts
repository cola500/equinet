import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

const mockGetUnreadCount = vi.fn()

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
  },
}))

describe("GET /api/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return unread count for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)
    mockGetUnreadCount.mockResolvedValue(5)

    const request = new NextRequest(
      "http://localhost:3000/api/notifications/unread-count"
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.count).toBe(5)
    expect(mockGetUnreadCount).toHaveBeenCalledWith("user-1")
  })

  it("should return 0 when no unread notifications", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)
    mockGetUnreadCount.mockResolvedValue(0)

    const request = new NextRequest(
      "http://localhost:3000/api/notifications/unread-count"
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.count).toBe(0)
  })
})
