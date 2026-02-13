import { prisma } from "@/lib/prisma"

/**
 * Check that the provider has a relationship with the customer
 * (completed booking OR manually added via ProviderCustomer).
 */
export async function hasCustomerRelationship(
  providerId: string,
  customerId: string
): Promise<boolean> {
  const bookingCount = await prisma.booking.count({
    where: { providerId, customerId, status: "completed" },
  })
  if (bookingCount > 0) return true

  const manualCount = await prisma.providerCustomer.count({
    where: { providerId, customerId },
  })
  return manualCount > 0
}
