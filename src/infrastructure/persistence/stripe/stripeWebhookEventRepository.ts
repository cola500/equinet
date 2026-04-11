import { prisma } from "@/lib/prisma"

/**
 * Repository for Stripe webhook event deduplication.
 * Uses createMany + skipDuplicates for atomic insert-or-ignore.
 */
export const stripeWebhookEventRepository = {
  /**
   * Try to record a new event. Returns true if the event was new,
   * false if it was already processed (duplicate).
   */
  async tryRecordEvent(eventId: string, eventType: string): Promise<boolean> {
    const result = await prisma.stripeWebhookEvent.createMany({
      data: [{ eventId, eventType }],
      skipDuplicates: true,
    })
    return result.count > 0
  },

  /**
   * Delete a recorded event (used when processing fails, so Stripe can retry).
   */
  async deleteEvent(eventId: string): Promise<void> {
    await prisma.stripeWebhookEvent.deleteMany({
      where: { eventId },
    })
  },
}
