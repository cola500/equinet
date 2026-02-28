import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    profileUpdate: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/domain/account/AccountDeletionService", () => ({
  createAccountDeletionService: vi.fn(),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { createAccountDeletionService } from "@/domain/account/AccountDeletionService"
import { Result } from "@/domain/shared"
import { DELETE } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockCreateService = vi.mocked(createAccountDeletionService)

function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/account", {
    method: "DELETE",
    body: JSON.stringify(body),
  })
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)
    mockRateLimiters.profileUpdate.mockResolvedValue(true)
    mockCreateService.mockReturnValue({
      deleteAccount: vi.fn().mockResolvedValue(Result.ok({ deleted: true })),
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await DELETE(createRequest({ confirmation: "RADERA", password: "test" }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimiters.profileUpdate.mockResolvedValueOnce(false)

    const response = await DELETE(createRequest({ confirmation: "RADERA", password: "test" }))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toBe("För många förfrågningar")
  })

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost:3000/api/account", {
      method: "DELETE",
      body: "not-json",
    })

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 when confirmation is not RADERA", async () => {
    const response = await DELETE(createRequest({ confirmation: "DELETE", password: "test" }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 401 when password is wrong", async () => {
    mockCreateService.mockReturnValue({
      deleteAccount: vi.fn().mockResolvedValue(
        Result.fail({ type: "INVALID_PASSWORD", message: "Felaktigt lösenord" })
      ),
    } as never)

    const response = await DELETE(createRequest({ confirmation: "RADERA", password: "wrong" }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("Felaktigt lösenord")
  })

  it("returns 200 on successful deletion", async () => {
    const response = await DELETE(createRequest({ confirmation: "RADERA", password: "correct" }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe("Ditt konto har raderats")
  })

  it("calls service with correct arguments", async () => {
    const mockDeleteAccount = vi.fn().mockResolvedValue(Result.ok({ deleted: true }))
    mockCreateService.mockReturnValue({ deleteAccount: mockDeleteAccount } as never)

    await DELETE(createRequest({ confirmation: "RADERA", password: "my-password" }))

    expect(mockDeleteAccount).toHaveBeenCalledWith("user-1", "my-password", "RADERA")
  })
})
