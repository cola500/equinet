import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeOrder: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { prisma } from "@/lib/prisma"

const mockedFindUnique = vi.mocked(prisma.routeOrder.findUnique)

describe("GET /api/route-orders/[id]", () => {
  const params = Promise.resolve({ id: "a0000000-0000-4000-a000-000000000001" })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 404 when route order not found", async () => {
    mockedFindUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/route-orders/abc")
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it("uses select on routeStops to prevent data leakage", async () => {
    mockedFindUnique.mockResolvedValue({ id: "test" } as never)
    const req = new NextRequest("http://localhost:3000/api/route-orders/abc")
    await GET(req, { params })

    const call = mockedFindUnique.mock.calls[0][0]
    // routeStops must use select (not return all fields including full addresses)
    const include = (call as never).include
    expect(include.routeStops).toHaveProperty("select")
    // Should NOT include problemNote or actualArrival/actualDeparture
    const routeStopSelect = include.routeStops.select
    expect(routeStopSelect.problemNote).toBeFalsy()
    expect(routeStopSelect.actualArrival).toBeFalsy()
    expect(routeStopSelect.actualDeparture).toBeFalsy()
  })
})
