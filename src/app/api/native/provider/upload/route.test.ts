/**
 * Tests for POST /api/native/provider/upload
 * BDD outer loop: integration-style tests for the upload route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    upload: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/supabase-storage", () => ({
  validateFile: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {
    constructor() {
      super("Rate limit service error")
    }
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { validateFile, uploadFile } from "@/lib/supabase-storage"
import { rateLimiters } from "@/lib/rate-limit"

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockValidateFile = vi.mocked(validateFile)
const mockUploadFile = vi.mocked(uploadFile)
const mockRateLimiters = vi.mocked(rateLimiters)

const PROVIDER_ID = "b0000000-0000-4000-a000-000000000001"
const USER_ID = "b0000000-0000-4000-a000-000000000002"

function createFormDataRequest(
  file?: { name: string; type: string; content: string },
  headers?: Record<string, string>
): Request {
  const formData = new FormData()
  if (file) {
    const blob = new Blob([file.content], { type: file.type })
    formData.append("file", blob, file.name)
  }

  return new Request("http://localhost/api/native/provider/upload", {
    method: "POST",
    body: formData,
    headers: {
      ...headers,
    },
  })
}

describe("POST /api/native/provider/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimiters.api.mockResolvedValue(true)

    mockGetAuthUser.mockResolvedValue({
      id: USER_ID,
      email: "test@example.com",
      providerId: PROVIDER_ID,
      customerId: null,
      stableId: null,
      isAdmin: false,
      authMethod: "supabase",
    })

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: PROVIDER_ID,
      userId: USER_ID,
    } as never)

    mockValidateFile.mockReturnValue(null)

    mockUploadFile.mockResolvedValue({
      data: {
        path: "avatars/test-123.jpg",
        url: "https://storage.example.com/avatars/test-123.jpg",
      },
    })

    vi.mocked(prisma.upload.create).mockResolvedValue({
      id: "upload-1",
      url: "https://storage.example.com/avatars/test-123.jpg",
      path: "avatars/test-123.jpg",
    } as never)

    vi.mocked(prisma.provider.update).mockResolvedValue({} as never)
  })

  it("returns 201 with url on successful upload", async () => {
    const req = createFormDataRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      content: "fake-image-data",
    })

    const res = await POST(req as never)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.url).toBe("https://storage.example.com/avatars/test-123.jpg")
  })

  it("updates provider profileImageUrl after upload", async () => {
    const req = createFormDataRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      content: "fake-image-data",
    })

    await POST(req as never)

    expect(prisma.provider.update).toHaveBeenCalledWith({
      where: { id: PROVIDER_ID },
      data: { profileImageUrl: "https://storage.example.com/avatars/test-123.jpg" },
    })
  })

  it("returns 401 without auth", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const req = createFormDataRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      content: "fake-image-data",
    })

    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-provider users", async () => {
    mockGetAuthUser.mockResolvedValue({
      id: USER_ID,
      email: "test@example.com",
      providerId: null,
      customerId: "customer-1",
      stableId: null,
      isAdmin: false,
      authMethod: "supabase",
    })

    const req = createFormDataRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      content: "fake-image-data",
    })

    const res = await POST(req as never)
    expect(res.status).toBe(403)
  })

  it("returns 400 without file", async () => {
    const req = createFormDataRequest()

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid file type", async () => {
    mockValidateFile.mockReturnValue({
      message: "Filtypen stöds inte",
      code: "INVALID_TYPE",
    })

    const req = createFormDataRequest({
      name: "doc.txt",
      type: "text/plain",
      content: "not an image",
    })

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimiters.api.mockResolvedValue(false)

    const req = createFormDataRequest({
      name: "photo.jpg",
      type: "image/jpeg",
      content: "fake-image-data",
    })

    const res = await POST(req as never)
    expect(res.status).toBe(429)
  })
})
