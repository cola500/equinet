// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deviceToken: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { PushDeliveryService } from "./PushDeliveryService"
import type { PushPayload } from "./PushDeliveryService"
import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

describe("PushDeliveryService", () => {
  let service: PushDeliveryService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    // Reach the real delivery path: the environment-safety guard blocks all
    // outbound push unless this is the live production runtime.
    vi.stubEnv("IS_LIVE_PRODUCTION", "true")
    mockIsFeatureEnabled.mockResolvedValue(true)
    // Create service without APNs client (test mode)
    service = new PushDeliveryService()
  })

  const payload: PushPayload = {
    title: "Ny bokning",
    body: "Jane har bokat Hovslagning",
    url: "/provider/bookings",
    category: "BOOKING_REQUEST",
    bookingId: "booking-1",
  }

  describe("sendToUser", () => {
    it("looks up device tokens for the user", async () => {
      vi.mocked(prisma.deviceToken.findMany).mockResolvedValue([])

      await service.sendToUser("user-1", payload)

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: { token: true, platform: true },
      })
    })

    it("does nothing when user has no device tokens", async () => {
      vi.mocked(prisma.deviceToken.findMany).mockResolvedValue([])

      await service.sendToUser("user-1", payload)
      // No error thrown, no APNs call
    })

    it("skips non-iOS tokens", async () => {
      vi.mocked(prisma.deviceToken.findMany).mockResolvedValue([
        { token: "web-token", platform: "web" },
      ] as never)

      // Should not attempt to send (no iOS tokens)
      await service.sendToUser("user-1", payload)
    })

    it("does nothing when feature flag is disabled", async () => {
      mockIsFeatureEnabled.mockResolvedValueOnce(false)

      await service.sendToUser("user-1", payload)

      expect(prisma.deviceToken.findMany).not.toHaveBeenCalled()
    })

    it("never throws (fire-and-forget)", async () => {
      vi.mocked(prisma.deviceToken.findMany).mockRejectedValue(
        new Error("DB connection failed")
      )

      // Should not throw
      await expect(service.sendToUser("user-1", payload)).resolves.toBeUndefined()
    })
  })

  describe("sendToUsers", () => {
    it("sends to multiple users in parallel", async () => {
      vi.mocked(prisma.deviceToken.findMany).mockResolvedValue([])

      await service.sendToUsers(["user-1", "user-2", "user-3"], payload)

      expect(prisma.deviceToken.findMany).toHaveBeenCalledTimes(3)
    })
  })

  describe("environment-safety blocker", () => {
    beforeEach(() => {
      // Clear IS_LIVE_PRODUCTION set by the outer beforeEach → default safe.
      vi.unstubAllEnvs()
    })

    it("blocks delivery when not live production (default safe) and does not query device tokens", async () => {
      // No IS_LIVE_PRODUCTION → safe → blocked.
      await service.sendToUser("user-1", payload)

      expect(prisma.deviceToken.findMany).not.toHaveBeenCalled()
      expect(mockIsFeatureEnabled).not.toHaveBeenCalled()
    })

    it("stays safe on staging's runtime: VERCEL_ENV=production WITHOUT IS_LIVE_PRODUCTION blocks delivery", async () => {
      // Regression for #419: staging reports VERCEL_ENV=production, yet push
      // must still be blocked. RED against the reverted #419 guard.
      vi.stubEnv("VERCEL_ENV", "production")

      await service.sendToUser("user-1", payload)

      expect(prisma.deviceToken.findMany).not.toHaveBeenCalled()
      expect(mockIsFeatureEnabled).not.toHaveBeenCalled()
    })

    it("blocks delivery for every recipient via sendToUsers when not live production", async () => {
      await service.sendToUsers(["a", "b", "c"], payload)

      expect(prisma.deviceToken.findMany).not.toHaveBeenCalled()
    })
  })
})
