import { describe, it, expect, beforeEach, vi } from "vitest"
import { requireAdmin } from "./admin-auth"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    security: vi.fn(),
  },
}))

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se" },
} as never

const mockNonAdminSession = {
  user: { id: "user-1", email: "user@test.se" },
} as never

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return user when session user is admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as never)

    const user = await requireAdmin(mockAdminSession)

    expect(user).toEqual({ id: "admin-1", isAdmin: true })
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      select: { id: true, isAdmin: true },
    })
  })

  it("should throw 403 Response when user is not admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      isAdmin: false,
    } as never)

    try {
      await requireAdmin(mockNonAdminSession)
      expect.fail("Should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Åtkomst nekad")
    }
  })

  it("should throw 403 Response when user not found in DB", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    try {
      await requireAdmin(mockAdminSession)
      expect.fail("Should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(403)
    }
  })

  it("should throw 401 Response when session has no user", async () => {
    try {
      await requireAdmin(null as never)
      expect.fail("Should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(401)
    }
  })

  it("should throw 401 Response when session user has no id", async () => {
    try {
      await requireAdmin({ user: {} } as never)
      expect.fail("Should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(401)
    }
  })
})
