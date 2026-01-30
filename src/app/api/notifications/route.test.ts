import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

const mockGetForUser = vi.fn()
const mockMarkAllAsRead = vi.fn()

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    getForUser: (...args: unknown[]) => mockGetForUser(...args),
    markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args),
  },
}))

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return notifications for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)

    const mockNotifications = [
      {
        id: "n1",
        type: "booking_confirmed",
        message: "Din bokning har bekräftats",
        isRead: false,
        linkUrl: "/customer/bookings",
        createdAt: new Date("2026-01-30T10:00:00Z"),
      },
      {
        id: "n2",
        type: "payment_received",
        message: "Betalning mottagen",
        isRead: true,
        linkUrl: null,
        createdAt: new Date("2026-01-29T10:00:00Z"),
      },
    ]
    mockGetForUser.mockResolvedValue(mockNotifications)

    const request = new NextRequest("http://localhost:3000/api/notifications")

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0].id).toBe("n1")
    expect(data[0].type).toBe("booking_confirmed")
    expect(mockGetForUser).toHaveBeenCalledWith("user-1", { limit: 20 })
  })

  it("should respect limit query parameter", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)
    mockGetForUser.mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/notifications?limit=5"
    )

    await GET(request)

    expect(mockGetForUser).toHaveBeenCalledWith("user-1", { limit: 5 })
  })

  it("should return 401 for unauthenticated request", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/notifications")

    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})

describe("POST /api/notifications (mark all as read)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should mark all notifications as read", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)
    mockMarkAllAsRead.mockResolvedValue({ count: 3 })

    const request = new NextRequest("http://localhost:3000/api/notifications", {
      method: "POST",
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.markedAsRead).toBe(3)
    expect(mockMarkAllAsRead).toHaveBeenCalledWith("user-1")
  })
})
