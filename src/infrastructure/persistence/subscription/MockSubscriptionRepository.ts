/**
 * MockSubscriptionRepository - In-memory implementation for testing
 */
import { randomUUID } from "crypto"
import type {
  ISubscriptionRepository,
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from "./ISubscriptionRepository"

export class MockSubscriptionRepository implements ISubscriptionRepository {
  private subscriptions: Map<string, Subscription> = new Map()

  async findByProviderId(providerId: string): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.providerId === providerId) return sub
    }
    return null
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.stripeCustomerId === stripeCustomerId) return sub
    }
    return null
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.stripeSubscriptionId === stripeSubscriptionId) return sub
    }
    return null
  }

  async create(data: CreateSubscriptionData): Promise<Subscription> {
    const now = new Date()
    const subscription: Subscription = {
      id: randomUUID(),
      providerId: data.providerId,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      planId: data.planId ?? "basic",
      priceAmountCents: data.priceAmountCents ?? 0,
      currency: data.currency ?? "SEK",
      status: data.status ?? "trialing",
      currentPeriodStart: data.currentPeriodStart ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      trialEndsAt: data.trialEndsAt ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.subscriptions.set(subscription.id, subscription)
    return subscription
  }

  async update(id: string, data: UpdateSubscriptionData): Promise<Subscription> {
    const existing = this.subscriptions.get(id)
    if (!existing) throw new Error("Subscription not found")

    const updated: Subscription = {
      ...existing,
      ...(data.stripeCustomerId !== undefined && { stripeCustomerId: data.stripeCustomerId }),
      ...(data.stripeSubscriptionId !== undefined && { stripeSubscriptionId: data.stripeSubscriptionId }),
      ...(data.planId !== undefined && { planId: data.planId }),
      ...(data.priceAmountCents !== undefined && { priceAmountCents: data.priceAmountCents }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.currentPeriodStart !== undefined && { currentPeriodStart: data.currentPeriodStart }),
      ...(data.currentPeriodEnd !== undefined && { currentPeriodEnd: data.currentPeriodEnd }),
      ...(data.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: data.cancelAtPeriodEnd }),
      ...(data.trialEndsAt !== undefined && { trialEndsAt: data.trialEndsAt }),
      updatedAt: new Date(),
    }
    this.subscriptions.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.subscriptions.delete(id)
  }
}
