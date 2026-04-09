import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}))

const mockMarkAllAsRead = vi.fn()

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args),
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function mockSupabaseNotifications(notifications: unknown[], unreadCount: number) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "Notification") {
        return {
          select: vi.fn().mockImplementation((fields: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              // Count query: select().eq("userId").eq("isRead")
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: unreadCount, error: null }),
                }),
              }
            }
            // List query: select().eq("userId").order().limit()
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: notifications, error: null }),
                }),
              }),
            }
          }),
        }
      }
      return {}
    }),
  } as never)
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return notifications and unreadCount for authenticated user (via Supabase RLS)", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1", email: "", userType: "customer", isAdmin: false,
      providerId: null, stableId: null, authMethod: "supabase" as const,
    })

    const mockNotifications = [
      {
        id: "n1",
        type: "booking_confirmed",
        message: "Din bokning har bekräftats",
        isRead: false,
        linkUrl: "/customer/bookings",
        createdAt: "2026-01-30T10:00:00Z",
      },
      {
        id: "n2",
        type: "payment_received",
        message: "Betalning mottagen",
        isRead: true,
        linkUrl: null,
        createdAt: "2026-01-29T10:00:00Z",
      },
    ]
    mockSupabaseNotifications(mockNotifications, 1)

    const request = new NextRequest("http://localhost:3000/api/notifications")

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toHaveLength(2)
    expect(data.notifications[0].id).toBe("n1")
    expect(data.notifications[0].type).toBe("booking_confirmed")
    expect(data.unreadCount).toBe(1)
  })

  it("should return empty notifications when none exist", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1", email: "", userType: "customer", isAdmin: false,
      providerId: null, stableId: null, authMethod: "supabase" as const,
    })
    mockSupabaseNotifications([], 0)

    const request = new NextRequest(
      "http://localhost:3000/api/notifications?limit=5"
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notifications).toHaveLength(0)
    expect(data.unreadCount).toBe(0)
  })

  it("should return 401 for unauthenticated request", async () => {
    vi.mocked(getAuthUser).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/notifications")

    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const request = new NextRequest("http://localhost:3000/api/notifications")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })
})

describe("POST /api/notifications (mark all as read)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const request = new NextRequest("http://localhost:3000/api/notifications", {
      method: "POST",
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("should mark all notifications as read", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1", email: "", userType: "customer", isAdmin: false,
      providerId: null, stableId: null, authMethod: "supabase" as const,
    })
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
