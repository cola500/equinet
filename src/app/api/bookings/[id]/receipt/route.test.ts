import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

// Mock auth
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const mockedAuth = vi.mocked(auth)
const mockedFindFirst = vi.mocked(prisma.booking.findFirst)

function createRequest(bookingId: string) {
  return new NextRequest(`http://localhost:3000/api/bookings/${bookingId}/receipt`)
}

const mockBooking = {
  id: "a0000000-0000-4000-a000-000000000001",
  customer: {
    firstName: "Anna",
    lastName: "Andersson",
    email: "anna@example.com",
    address: "Storgatan 1",
  },
  service: {
    name: "Hovvård",
    description: "Verkning och skoning",
  },
  provider: {
    businessName: "Hästservice AB",
    user: {
      firstName: "Erik",
      lastName: "Eriksson",
    },
  },
  payment: {
    status: "succeeded",
    invoiceNumber: "INV-001",
    paidAt: new Date("2026-01-15T10:00:00Z"),
    amount: 1500,
    currency: "SEK",
  },
  bookingDate: new Date("2026-01-15"),
  startTime: "10:00",
  endTime: "11:00",
}

describe("GET /api/bookings/[id]/receipt", () => {
  const params = Promise.resolve({ id: "a0000000-0000-4000-a000-000000000001" })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "anna@example.com", userType: "customer" },
    } as never)
  })

  it("returns receipt HTML for valid booking", async () => {
    mockedFindFirst.mockResolvedValue(mockBooking as never)
    const req = createRequest("a0000000-0000-4000-a000-000000000001")
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    const html = await res.text()
    expect(html).toContain("KVITTO")
    expect(html).toContain("Anna Andersson")
  })

  it("returns 404 when booking not found", async () => {
    mockedFindFirst.mockResolvedValue(null)
    const req = createRequest("a0000000-0000-4000-a000-000000000002")
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it("returns 400 when payment not succeeded", async () => {
    mockedFindFirst.mockResolvedValue({
      ...mockBooking,
      payment: { ...mockBooking.payment, status: "pending" },
    } as never)
    const req = createRequest("a0000000-0000-4000-a000-000000000001")
    const res = await GET(req, { params })
    expect(res.status).toBe(400)
  })

  describe("XSS protection", () => {
    it("escapes HTML in businessName", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        provider: {
          ...mockBooking.provider,
          businessName: '<script>alert("xss")</script>',
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain("<script>")
      expect(html).toContain("&lt;script&gt;")
    })

    it("escapes HTML in customerName", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        customer: {
          ...mockBooking.customer,
          firstName: '<img src=x onerror="alert(1)">',
          lastName: "Doe",
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain('onerror="alert(1)"')
      expect(html).toContain("&lt;img")
    })

    it("escapes HTML in customerEmail", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        customer: {
          ...mockBooking.customer,
          email: '"><script>alert(1)</script>@evil.com',
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain("<script>")
    })

    it("escapes HTML in customerAddress", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        customer: {
          ...mockBooking.customer,
          address: '<div onmouseover="alert(1)">Evil Street</div>',
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain('onmouseover="alert(1)"')
    })

    it("escapes HTML in serviceName", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        service: {
          ...mockBooking.service,
          name: '"><iframe src="evil.com">',
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain("<iframe")
    })

    it("escapes HTML in providerName", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        provider: {
          ...mockBooking.provider,
          user: {
            firstName: "<b>Bold</b>",
            lastName: '<script>evil()</script>',
          },
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain("<script>")
      expect(html).not.toContain("<b>")
    })

    it("escapes HTML in invoiceNumber", async () => {
      mockedFindFirst.mockResolvedValue({
        ...mockBooking,
        payment: {
          ...mockBooking.payment,
          invoiceNumber: '<script>alert("inv")</script>',
        },
      } as never)
      const req = createRequest("a0000000-0000-4000-a000-000000000001")
      const res = await GET(req, { params })
      const html = await res.text()
      expect(html).not.toContain("<script>")
    })
  })
})
