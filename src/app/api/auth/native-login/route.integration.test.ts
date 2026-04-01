/**
 * POST /api/auth/native-login -- Integration test
 *
 * Tests the full route -> AuthService -> AuthRepository integration.
 * AuthService.verifyCredentials runs un-mocked; only boundaries are mocked:
 * - PrismaAuthRepository (database)
 * - bcrypt (password hashing)
 * - rate-limit (Upstash Redis)
 * - mobile-auth (token generation + session cookie)
 * - logger (side-effect)
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Mocks -- boundaries only, AuthService runs for real
// ---------------------------------------------------------------------------

const mockAuthRepo = {
  findUserByEmail: vi.fn(),
  findUserWithCredentials: vi.fn(),
  findUserForResend: vi.fn(),
  createUser: vi.fn(),
  createProvider: vi.fn(),
  createVerificationToken: vi.fn(),
  findVerificationToken: vi.fn(),
  verifyEmail: vi.fn(),
  upgradeGhostUser: vi.fn(),
  createPasswordResetToken: vi.fn(),
  findPasswordResetToken: vi.fn(),
  invalidatePasswordResetTokens: vi.fn(),
  resetPassword: vi.fn(),
}

vi.mock("@/infrastructure/persistence/auth/PrismaAuthRepository", () => ({
  PrismaAuthRepository: class MockPrismaAuthRepository {
    findUserByEmail = mockAuthRepo.findUserByEmail
    findUserWithCredentials = mockAuthRepo.findUserWithCredentials
    findUserForResend = mockAuthRepo.findUserForResend
    createUser = mockAuthRepo.createUser
    createProvider = mockAuthRepo.createProvider
    createVerificationToken = mockAuthRepo.createVerificationToken
    findVerificationToken = mockAuthRepo.findVerificationToken
    verifyEmail = mockAuthRepo.verifyEmail
    upgradeGhostUser = mockAuthRepo.upgradeGhostUser
    createPasswordResetToken = mockAuthRepo.createPasswordResetToken
    findPasswordResetToken = mockAuthRepo.findPasswordResetToken
    invalidatePasswordResetTokens = mockAuthRepo.invalidatePasswordResetTokens
    resetPassword = mockAuthRepo.resetPassword
  },
}))

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { login: vi.fn() },
  resetRateLimit: vi.fn(),
}))

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenService: vi.fn(),
  createSessionCookieValue: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

// email service is pulled in by AuthService factory -- stub it
vi.mock("@/lib/email", () => ({
  sendEmailVerificationNotification: vi.fn(),
  sendPasswordResetNotification: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "./route"
import { rateLimiters, resetRateLimit } from "@/lib/rate-limit"
import { getMobileTokenService, createSessionCookieValue } from "@/lib/mobile-auth"
import bcrypt from "bcrypt"
import type { AuthUserWithCredentials } from "@/infrastructure/persistence/auth/IAuthRepository"

const mockRateLimit = vi.mocked(rateLimiters.login)
const mockResetRateLimit = vi.mocked(resetRateLimit)
const mockGetMobileTokenService = vi.mocked(getMobileTokenService)
const mockCreateSessionCookieValue = vi.mocked(createSessionCookieValue)
const mockBcryptCompare = vi.mocked(bcrypt.compare)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser: AuthUserWithCredentials = {
  id: "a0000000-0000-4000-a000-000000000001",
  email: "anna@test.se",
  firstName: "Anna",
  lastName: "Svensson",
  userType: "provider",
  isAdmin: false,
  isBlocked: false,
  passwordHash: "$2b$10$hashedpassword",
  emailVerified: true,
  provider: { id: "prov-1" },
  stable: { id: "stable-1" },
}

const mockTokenService = {
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
  refreshToken: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllForUser: vi.fn(),
  revokeAndCreate: vi.fn(),
}

const tokenResult = {
  jwt: "eyJ.test.jwt",
  expiresAt: new Date("2026-07-01T00:00:00Z"),
}

const sessionCookieValue = {
  name: "next-auth.session-token",
  value: "signed-session-jwt",
  maxAge: 86400,
  secure: false,
  domain: "localhost",
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/native-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createInvalidJsonRequest() {
  return new NextRequest("http://localhost:3000/api/auth/native-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/native-login (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Happy-path defaults
    mockRateLimit.mockResolvedValue(true)
    mockAuthRepo.findUserWithCredentials.mockResolvedValue(validUser)
    mockBcryptCompare.mockResolvedValue(true as never)
    mockGetMobileTokenService.mockReturnValue(mockTokenService as never)
    mockTokenService.generateToken.mockResolvedValue(tokenResult)
    mockCreateSessionCookieValue.mockResolvedValue(sessionCookieValue as never)
  })

  // -----------------------------------------------------------------------
  // 1. Successful login
  // -----------------------------------------------------------------------

  it("returns token, session cookie, and user data on successful login", async () => {
    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      token: "eyJ.test.jwt",
      expiresAt: "2026-07-01T00:00:00.000Z",
      sessionCookie: sessionCookieValue,
      user: {
        id: validUser.id,
        name: "Anna Svensson",
        userType: "provider",
        providerId: "prov-1",
      },
    })

    // Verify the real AuthService called the repo with the email
    expect(mockAuthRepo.findUserWithCredentials).toHaveBeenCalledWith("anna@test.se")

    // Verify bcrypt was called with correct arguments (password, hash)
    expect(mockBcryptCompare).toHaveBeenCalledWith("hemligt123", validUser.passwordHash)

    // Verify rate limit reset on success
    expect(mockResetRateLimit).toHaveBeenCalledWith("anna@test.se")

    // Verify token generation was called with userId
    expect(mockTokenService.generateToken).toHaveBeenCalledWith(
      validUser.id,
      undefined // no deviceName
    )
  })

  it("passes deviceName to token generation when provided", async () => {
    const req = createRequest({
      email: "anna@test.se",
      password: "hemligt123",
      deviceName: "iPhone 17 Pro",
    })
    await POST(req)

    expect(mockTokenService.generateToken).toHaveBeenCalledWith(
      validUser.id,
      "iPhone 17 Pro"
    )
  })

  // -----------------------------------------------------------------------
  // 2. Invalid credentials -- wrong password
  // -----------------------------------------------------------------------

  it("returns 401 when password is wrong", async () => {
    mockBcryptCompare.mockResolvedValue(false as never)

    const req = createRequest({ email: "anna@test.se", password: "wrong" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Ogiltig email eller lösenord")

    // Rate limit should NOT be reset on failure
    expect(mockResetRateLimit).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 3. User not found
  // -----------------------------------------------------------------------

  it("returns 401 when user does not exist", async () => {
    mockAuthRepo.findUserWithCredentials.mockResolvedValue(null)

    const req = createRequest({ email: "nobody@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Ogiltig email eller lösenord")
    expect(mockBcryptCompare).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 4. Email not verified
  // -----------------------------------------------------------------------

  it("returns 403 when email is not verified", async () => {
    mockAuthRepo.findUserWithCredentials.mockResolvedValue({
      ...validUser,
      emailVerified: false,
    })

    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Kontot är inte verifierat")
  })

  // -----------------------------------------------------------------------
  // 5. Account blocked
  // -----------------------------------------------------------------------

  it("returns 403 when account is blocked", async () => {
    mockAuthRepo.findUserWithCredentials.mockResolvedValue({
      ...validUser,
      isBlocked: true,
    })

    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Ditt konto har blockerats")
  })

  // -----------------------------------------------------------------------
  // 6. Invalid JSON
  // -----------------------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const req = createInvalidJsonRequest()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Ogiltig JSON")
  })

  // -----------------------------------------------------------------------
  // 7. Zod validation failure
  // -----------------------------------------------------------------------

  it("returns 400 when body fails Zod validation", async () => {
    const req = createRequest({ email: "not-an-email", password: "" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Valideringsfel")
    expect(body.details).toBeDefined()
  })

  it("returns 400 when body has unknown fields (strict mode)", async () => {
    const req = createRequest({
      email: "anna@test.se",
      password: "hemligt123",
      extraField: "sneaky",
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Valideringsfel")
  })

  // -----------------------------------------------------------------------
  // 8. Rate limited
  // -----------------------------------------------------------------------

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)

    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain("För många inloggningsförsök")

    // Auth service should not be called
    expect(mockAuthRepo.findUserWithCredentials).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 9. Max tokens exceeded
  // -----------------------------------------------------------------------

  it("returns 409 when max active tokens are exceeded", async () => {
    const { MaxTokensExceededError } = await import(
      "@/domain/auth/MobileTokenService"
    )
    mockTokenService.generateToken.mockRejectedValue(
      new MaxTokensExceededError(validUser.id)
    )

    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain("Max antal aktiva tokens")
  })

  // -----------------------------------------------------------------------
  // 10. Unexpected error -> 500
  // -----------------------------------------------------------------------

  it("returns 500 on unexpected errors", async () => {
    mockAuthRepo.findUserWithCredentials.mockRejectedValue(
      new Error("DB connection lost")
    )

    const req = createRequest({ email: "anna@test.se", password: "hemligt123" })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Internt serverfel")
  })
})
