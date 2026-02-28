/**
 * SubscriptionRepository - Prisma implementation
 */
import { prisma } from "@/lib/prisma"
import type {
  ISubscriptionRepository,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from "./ISubscriptionRepository"

const subscriptionSelect = {
  id: true,
  providerId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  planId: true,
  priceAmountCents: true,
  currency: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  trialEndsAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export class SubscriptionRepository implements ISubscriptionRepository {
  async findByProviderId(providerId: string): Promise<Subscription | null> {
    return prisma.providerSubscription.findUnique({
      where: { providerId },
      select: subscriptionSelect,
    })
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    return prisma.providerSubscription.findUnique({
      where: { stripeCustomerId },
      select: subscriptionSelect,
    })
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return prisma.providerSubscription.findUnique({
      where: { stripeSubscriptionId },
      select: subscriptionSelect,
    })
  }

  async create(data: CreateSubscriptionData): Promise<Subscription> {
    return prisma.providerSubscription.create({
      data: {
        providerId: data.providerId,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        planId: data.planId ?? "basic",
        priceAmountCents: data.priceAmountCents ?? 0,
        currency: data.currency ?? "SEK",
        status: data.status ?? "trialing",
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        trialEndsAt: data.trialEndsAt,
      },
      select: subscriptionSelect,
    })
  }

  async update(id: string, data: UpdateSubscriptionData): Promise<Subscription> {
    return prisma.providerSubscription.update({
      where: { id },
      data,
      select: subscriptionSelect,
    })
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.providerSubscription.delete({ where: { id } })
      return true
    } catch (error) {
      // P2025 = record not found
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return false
      }
      throw error
    }
  }
}

// Singleton
export const subscriptionRepository = new SubscriptionRepository()
