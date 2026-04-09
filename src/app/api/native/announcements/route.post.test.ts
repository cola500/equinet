/**
 * POST /api/native/announcements - Create announcement
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    routeOrder: { findMany: vi.fn(), create: vi.fn() },
    service: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))
vi.mock("@/lib/geo/municipalities", () => ({
  isValidMunicipality: vi.fn().mockReturnValue(true),
}))

import { POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(getAuthUser)
const PROVIDER_ID = "b0000000-0000-4000-a000-000000000001"
const SERVICE_ID = "b0000000-0000-4000-a000-000000000010"
const USER_ID = "b0000000-0000-4000-a000-000000000002"

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/announcements", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]

const validBody = {
  serviceIds: [SERVICE_ID],
  dateFrom: tomorrow,
  dateTo: nextWeek,
  municipality: "Stockholm",
  specialInstructions: "Test",
}

describe("POST /api/native/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: SERVICE_ID, name: "Hovbeläggning" },
    ] as never)
    vi.mocked(prisma.routeOrder.create).mockResolvedValue({
      id: "ann-new",
      serviceType: "Hovbeläggning",
      municipality: "Stockholm",
      dateFrom: new Date(tomorrow),
      dateTo: new Date(nextWeek),
      status: "open",
      specialInstructions: "Test",
      createdAt: new Date(),
      services: [{ id: SERVICE_ID, name: "Hovbeläggning" }],
    } as never)

    mockAuth.mockResolvedValue({
      id: USER_ID,
      email: "test@test.com",
      providerId: PROVIDER_ID,
      customerId: null,
      stableId: null,
      isAdmin: false,
      authMethod: "supabase",
    })
  })

  it("returns 201 on successful create", async () => {
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe("ann-new")
  })

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-provider", async () => {
    mockAuth.mockResolvedValue({
      id: USER_ID,
      email: "test@test.com",
      providerId: null,
      customerId: "cust-1",
      stableId: null,
      isAdmin: false,
      authMethod: "supabase",
    })
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 400 for missing serviceIds", async () => {
    const res = await POST(createPostRequest({ ...validBody, serviceIds: [] }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid service ownership", async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([] as never)
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("tillhör inte dig")
  })
})
