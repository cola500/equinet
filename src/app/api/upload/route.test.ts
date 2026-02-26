import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    upload: { create: vi.fn(), count: vi.fn() },
    horse: { findFirst: vi.fn(), update: vi.fn() },
    provider: { findUnique: vi.fn(), update: vi.fn() },
    providerVerification: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))
vi.mock("@/lib/supabase-storage", () => ({
  validateFile: vi.fn().mockReturnValue(null),
  uploadFile: vi.fn().mockResolvedValue({
    data: { path: "horses/test.jpg", url: "https://storage.example.com/horses/test.jpg" },
  }),
}))

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

const mockProviderSession = {
  user: {
    id: "provider-user-1",
    email: "magnus@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

/**
 * Create a mock NextRequest with working FormData.
 * JSDOM FormData + NextRequest don't cooperate well in vitest,
 * so we mock request.formData() directly.
 */
function createMockUploadRequest(
  fields: Record<string, string>,
  file?: { name: string; type: string; size: number }
): NextRequest {
  const request = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
  })

  // Override formData() to return our mock
  const mockFormData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    mockFormData.append(key, value)
  }
  if (file) {
    const content = new Uint8Array([0xff, 0xd8, 0xff]) // JPEG magic bytes
    const blob = new Blob([content], { type: file.type })
    const mockFile = new File([blob], file.name, { type: file.type })
    // Override size to test validation without real file data
    Object.defineProperty(mockFile, "size", { value: file.size, writable: false })
    mockFormData.append("file", mockFile)
  }

  vi.spyOn(request, "formData").mockResolvedValue(mockFormData)
  return request
}

describe("POST /api/upload", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should upload a horse photo", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
    } as never)
    vi.mocked(prisma.horse.update).mockResolvedValue({} as never)
    vi.mocked(prisma.upload.create).mockResolvedValue({
      id: "upload-1",
      url: "https://storage.example.com/horses/test.jpg",
      path: "horses/test.jpg",
    } as never)

    const request = createMockUploadRequest(
      { bucket: "horses", entityId: "horse-1" },
      { name: "photo.jpg", type: "image/jpeg", size: 1024 }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.url).toContain("horses/test.jpg")
  })

  it("should upload a provider avatar", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as never)
    vi.mocked(prisma.provider.update).mockResolvedValue({} as never)
    vi.mocked(prisma.upload.create).mockResolvedValue({
      id: "upload-2",
      url: "https://storage.example.com/avatars/test.jpg",
      path: "avatars/test.jpg",
    } as never)

    const request = createMockUploadRequest(
      { bucket: "avatars", entityId: "provider-1" },
      { name: "avatar.jpg", type: "image/jpeg", size: 2048 }
    )

    const response = await POST(request)

    expect(response.status).toBe(201)
  })

  it("should return 400 when no file is uploaded", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const request = createMockUploadRequest({ bucket: "horses", entityId: "horse-1" })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("fil")
  })

  it("should return 400 for invalid bucket", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const request = createMockUploadRequest(
      { bucket: "invalid", entityId: "horse-1" },
      { name: "photo.jpg", type: "image/jpeg", size: 1024 }
    )
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("should return 404 for non-owned horse (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = createMockUploadRequest(
      { bucket: "horses", entityId: "other-horse" },
      { name: "photo.jpg", type: "image/jpeg", size: 1024 }
    )
    const response = await POST(request)

    expect(response.status).toBe(404)
  })

  it("should upload a verification image", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
    } as never)
    vi.mocked(prisma.upload.count).mockResolvedValue(0)
    vi.mocked(prisma.upload.create).mockResolvedValue({
      id: "upload-ver",
      url: "https://storage.example.com/verifications/test.jpg",
      path: "verifications/test.jpg",
    } as never)

    const request = createMockUploadRequest(
      { bucket: "verifications", entityId: "ver-1" },
      { name: "cert.jpg", type: "image/jpeg", size: 2048 }
    )

    const response = await POST(request)

    expect(response.status).toBe(201)
  })

  it("should return 404 for verification upload by non-owner (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(null)

    const request = createMockUploadRequest(
      { bucket: "verifications", entityId: "other-ver" },
      { name: "cert.jpg", type: "image/jpeg", size: 1024 }
    )

    const response = await POST(request)

    expect(response.status).toBe(404)
  })

  it("should reject upload to approved verification", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    // findFirst with status: { in: ["pending", "rejected"] } returns null for approved
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(null)

    const request = createMockUploadRequest(
      { bucket: "verifications", entityId: "ver-approved" },
      { name: "cert.jpg", type: "image/jpeg", size: 1024 }
    )

    const response = await POST(request)

    expect(response.status).toBe(404)
  })

  it("should reject when max 5 images per verification reached", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
    } as never)
    vi.mocked(prisma.upload.count).mockResolvedValue(5)

    const request = createMockUploadRequest(
      { bucket: "verifications", entityId: "ver-1" },
      { name: "cert6.jpg", type: "image/jpeg", size: 1024 }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("5")
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = createMockUploadRequest(
      { bucket: "horses", entityId: "horse-1" },
      { name: "photo.jpg", type: "image/jpeg", size: 1024 }
    )
    const response = await POST(request)

    expect(response.status).toBe(401)
  })
})
