import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock("@/lib/email/unsubscribe-token", () => ({
  verifyUnsubscribeToken: vi.fn(),
}))

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token"

const mockVerify = verifyUnsubscribeToken as ReturnType<typeof vi.fn>
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>

describe("GET /api/email/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("unsubscribes with valid userId and token", async () => {
    mockVerify.mockReturnValue(true)

    const url = "http://localhost/api/email/unsubscribe?userId=user-123&token=valid-token"
    const request = new Request(url)

    const response = await GET(request as never)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(text).toContain("avregistrerad")
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { emailRemindersEnabled: false },
    })
  })

  it("returns 400 with invalid token", async () => {
    mockVerify.mockReturnValue(false)

    const url = "http://localhost/api/email/unsubscribe?userId=user-123&token=bad-token"
    const request = new Request(url)

    const response = await GET(request as never)

    expect(response.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 400 with missing userId", async () => {
    const url = "http://localhost/api/email/unsubscribe?token=some-token"
    const request = new Request(url)

    const response = await GET(request as never)

    expect(response.status).toBe(400)
  })

  it("returns 400 with missing token", async () => {
    const url = "http://localhost/api/email/unsubscribe?userId=user-123"
    const request = new Request(url)

    const response = await GET(request as never)

    expect(response.status).toBe(400)
  })
})
