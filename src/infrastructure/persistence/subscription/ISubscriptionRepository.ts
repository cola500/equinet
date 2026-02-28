/**
 * ISubscriptionRepository - Repository interface for ProviderSubscription aggregate
 *
 * Defines data access operations for provider subscription management.
 */

export interface Subscription {
  id: string
  providerId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  planId: string
  priceAmountCents: number
  currency: string
  status: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSubscriptionData {
  providerId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  planId?: string
  priceAmountCents?: number
  currency?: string
  status?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  trialEndsAt?: Date
}

export interface UpdateSubscriptionData {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  planId?: string
  priceAmountCents?: number
  currency?: string
  status?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  cancelAtPeriodEnd?: boolean
  trialEndsAt?: Date
}

export interface ISubscriptionRepository {
  findByProviderId(providerId: string): Promise<Subscription | null>
  findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null>
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>
  create(data: CreateSubscriptionData): Promise<Subscription>
  update(id: string, data: UpdateSubscriptionData): Promise<Subscription>
  delete(id: string): Promise<boolean>
}
