import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

const mockMarkAsRead = vi.fn()

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: {
    markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
  },
}))

describe("PUT /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should mark notification as read for the owner", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)

    mockMarkAsRead.mockResolvedValue({
      id: "n1",
      userId: "user-1",
      isRead: true,
    })

    const request = new NextRequest(
      "http://localhost:3000/api/notifications/n1",
      { method: "PUT" }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: "n1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isRead).toBe(true)
    expect(mockMarkAsRead).toHaveBeenCalledWith("n1", "user-1")
  })

  it("should return 404 when notification not found or not owned", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)

    // Prisma throws P2025 when record not found in update with WHERE
    mockMarkAsRead.mockRejectedValue(
      Object.assign(new Error("Record not found"), {
        code: "P2025",
        constructor: { name: "PrismaClientKnownRequestError" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/notifications/nonexistent",
      { method: "PUT" }
    )

    const response = await PUT(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })
})
