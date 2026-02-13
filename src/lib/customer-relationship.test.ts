import { describe, it, expect, beforeEach, vi } from "vitest"
import { hasCustomerRelationship } from "./customer-relationship"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { count: vi.fn() },
    providerCustomer: { count: vi.fn() },
  },
}))

describe("hasCustomerRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return true when completed booking exists", async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(1)

    const result = await hasCustomerRelationship("provider-1", "customer-1")
    expect(result).toBe(true)

    // Should not check ProviderCustomer if booking found
    expect(prisma.providerCustomer.count).not.toHaveBeenCalled()
  })

  it("should return true when ProviderCustomer link exists (no booking)", async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(1)

    const result = await hasCustomerRelationship("provider-1", "customer-1")
    expect(result).toBe(true)
  })

  it("should return false when neither booking nor ProviderCustomer exists", async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)

    const result = await hasCustomerRelationship("provider-1", "customer-1")
    expect(result).toBe(false)
  })

  it("should only check completed bookings", async () => {
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)

    await hasCustomerRelationship("provider-1", "customer-1")

    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { providerId: "provider-1", customerId: "customer-1", status: "completed" },
    })
  })
})
