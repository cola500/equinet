import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import * as authServer from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import * as rateLimit from "@/lib/rate-limit"
import { NextResponse } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    availabilityException: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    profileUpdate: vi.fn(),
  },
}))

describe("GET /api/providers/[id]/availability-exceptions", () => {
  const mockProviderId = "provider-123"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return all exceptions for a provider", async () => {
    const mockExceptions = [
      {
        id: "exc-1",
        providerId: mockProviderId,
        date: new Date("2026-01-27"),
        isClosed: true,
        startTime: null,
        endTime: null,
        reason: "Semester",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "exc-2",
        providerId: mockProviderId,
        date: new Date("2026-01-28"),
        isClosed: false,
        startTime: "10:00",
        endTime: "14:00",
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
    } as any)
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue(mockExceptions as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveLength(2)
    expect(data[0].date).toBe("2026-01-27")
    expect(data[0].isClosed).toBe(true)
    expect(data[0].reason).toBe("Semester")
    expect(data[1].date).toBe("2026-01-28")
    expect(data[1].isClosed).toBe(false)
  })

  it("should filter exceptions by from/to dates", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
    } as any)
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions?from=2026-01-20&to=2026-01-31`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    expect(prisma.availabilityException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: mockProviderId,
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    )
  })

  it("should return empty array if no exceptions", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
    } as any)
    vi.mocked(prisma.availabilityException.findMany).mockResolvedValue([])

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual([])
  })

  it("should return 400 for invalid from date format", async () => {
    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions?from=27-01-2026`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltiga frågeparametrar")
  })

  it("should return 400 for invalid to date format", async () => {
    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions?to=2026/01/27`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltiga frågeparametrar")
  })

  it("should return 404 if provider not found", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`
    )
    const response = await GET(request as any, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Leverantör hittades inte")
  })
})

describe("POST /api/providers/[id]/availability-exceptions", () => {
  const mockProviderId = "provider-123"
  const mockUserId = "user-123"

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limiting allows request
    vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(true)
  })

  it("should create a new exception (closed all day)", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: "Semester",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
          reason: "Semester",
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.date).toBe("2026-01-27")
    expect(data.isClosed).toBe(true)
    expect(data.reason).toBe("Semester")
  })

  it("should create exception with alternative hours", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: false,
      startTime: "10:00",
      endTime: "14:00",
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: false,
          startTime: "10:00",
          endTime: "14:00",
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.isClosed).toBe(false)
    expect(data.startTime).toBe("10:00")
    expect(data.endTime).toBe("14:00")
  })

  it("should return 400 if not closed but missing times", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: false,
          // Missing startTime and endTime
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("startTime och endTime krävs")
  })

  it("should return 400 for invalid date format", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "27-01-2026", // Wrong format
          isClosed: true,
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for invalid time format", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: false,
          startTime: "9:00", // Wrong format (should be 09:00)
          endTime: "14:00",
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
  })

  it("should return 400 for invalid JSON", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: "not valid json",
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authServer.auth).mockRejectedValue(
      NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    )

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(401)
  })

  it("should return 403 if not a provider", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "customer" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(403)
  })

  it("should return 403 if not owner of provider profile", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: "different-user-id", // Different owner
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(false) // Rate limited

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain("För många förfrågningar")
  })

  it("should trim whitespace from reason field", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: "Semester",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
          reason: "  Semester  ", // Leading/trailing whitespace
        }),
      }
    )

    await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          reason: "Semester", // Should be trimmed
        }),
        create: expect.objectContaining({
          reason: "Semester", // Should be trimmed
        }),
      })
    )
  })

  it("should convert whitespace-only reason to null", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
          reason: "   ", // Whitespace only
        }),
      }
    )

    await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          reason: null, // Should become null
        }),
        create: expect.objectContaining({
          reason: null, // Should become null
        }),
      })
    )
  })

  it("should upsert existing exception", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: "Sjuk",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-01-27",
          isClosed: true,
          reason: "Sjuk",
        }),
      }
    )

    const response = await POST(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(201)
    expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerId_date: {
            providerId: mockProviderId,
            date: expect.any(Date),
          },
        },
        update: expect.objectContaining({
          isClosed: true,
          reason: "Sjuk",
        }),
        create: expect.objectContaining({
          providerId: mockProviderId,
          isClosed: true,
          reason: "Sjuk",
        }),
      })
    )
  })

  describe("Location fields (US-2)", () => {
    it("should create exception with location data", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const mockException = {
        id: "exc-1",
        providerId: mockProviderId,
        date: new Date("2026-02-15"),
        isClosed: false,
        startTime: "09:00",
        endTime: "15:00",
        reason: "Besöker Sollebrunn",
        location: "Sollebrunn",
        latitude: 58.13,
        longitude: 12.47,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-15",
            isClosed: false,
            startTime: "09:00",
            endTime: "15:00",
            reason: "Besöker Sollebrunn",
            location: "Sollebrunn",
            latitude: 58.13,
            longitude: 12.47,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.location).toBe("Sollebrunn")
      expect(data.latitude).toBe(58.13)
      expect(data.longitude).toBe(12.47)

      expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            location: "Sollebrunn",
            latitude: 58.13,
            longitude: 12.47,
          }),
          update: expect.objectContaining({
            location: "Sollebrunn",
            latitude: 58.13,
            longitude: 12.47,
          }),
        })
      )
    })

    it("should accept exception without location (backward compatibility)", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const mockException = {
        id: "exc-1",
        providerId: mockProviderId,
        date: new Date("2026-02-20"),
        isClosed: true,
        startTime: null,
        endTime: null,
        reason: "Semester",
        location: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-20",
            isClosed: true,
            reason: "Semester",
            // NO location fields
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.location).toBeNull()
      expect(data.latitude).toBeNull()
      expect(data.longitude).toBeNull()
    })

    it("should validate latitude range (-90 to 90)", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-25",
            isClosed: true,
            latitude: 91, // Invalid - outside range
            longitude: 12.0,
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Valideringsfel")
    })

    it("should validate longitude range (-180 to 180)", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-26",
            isClosed: true,
            latitude: 58.0,
            longitude: 181, // Invalid - outside range
          }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Valideringsfel")
    })

    it("should trim whitespace from location field", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const mockException = {
        id: "exc-1",
        providerId: mockProviderId,
        date: new Date("2026-02-27"),
        isClosed: true,
        startTime: null,
        endTime: null,
        reason: null,
        location: "Alingsås",
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-27",
            isClosed: true,
            location: "  Alingsås  ", // Leading/trailing whitespace
          }),
        }
      )

      await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            location: "Alingsås", // Should be trimmed
          }),
          create: expect.objectContaining({
            location: "Alingsås", // Should be trimmed
          }),
        })
      )
    })

    it("should convert whitespace-only location to null", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)

      const mockException = {
        id: "exc-1",
        providerId: mockProviderId,
        date: new Date("2026-02-28"),
        isClosed: true,
        startTime: null,
        endTime: null,
        reason: null,
        location: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(prisma.availabilityException.upsert).mockResolvedValue(mockException as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({
            date: "2026-02-28",
            isClosed: true,
            location: "   ", // Whitespace only
          }),
        }
      )

      await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(prisma.availabilityException.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            location: null, // Should become null
          }),
          create: expect.objectContaining({
            location: null, // Should become null
          }),
        })
      )
    })
  })

  describe("Error responses should be JSON", () => {
    it("should return JSON 403 when user is not a provider", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "customer" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(true)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({ date: "2026-02-15", isClosed: true }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it("should return JSON 403 when provider does not own the profile", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(true)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: "different-user-id",
      } as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({ date: "2026-02-15", isClosed: true }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it("should return JSON 500 on unexpected error", async () => {
      const mockSession = {
        user: { id: mockUserId, userType: "provider" },
      }
      vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
      vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(true)
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
        userId: mockUserId,
      } as any)
      vi.mocked(prisma.availabilityException.upsert).mockRejectedValue(
        new Error("DB connection lost")
      )

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions`,
        {
          method: "POST",
          body: JSON.stringify({ date: "2026-02-15", isClosed: true }),
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe("GET returns location fields", () => {
    it("should include location in response when set", async () => {
      vi.mocked(prisma.provider.findUnique).mockResolvedValue({
        id: mockProviderId,
      } as any)

      const mockExceptions = [
        {
          id: "exc-loc-1",
          providerId: mockProviderId,
          date: new Date("2026-03-01"),
          isClosed: false,
          startTime: "09:00",
          endTime: "15:00",
          reason: null,
          location: "Sollebrunn",
          latitude: 58.13,
          longitude: 12.47,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      vi.mocked(prisma.availabilityException.findMany).mockResolvedValue(mockExceptions as any)

      const request = new Request(
        `http://localhost/api/providers/${mockProviderId}/availability-exceptions?from=2026-03-01&to=2026-03-07`,
        { method: "GET" }
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveLength(1)
      expect(data[0].location).toBe("Sollebrunn")
      expect(data[0].latitude).toBe(58.13)
      expect(data[0].longitude).toBe(12.47)
    })
  })
})
