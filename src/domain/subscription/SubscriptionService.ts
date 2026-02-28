/**
 * SubscriptionService - Domain service for provider subscription management
 *
 * Handles checkout initiation, status queries, portal access, and webhook processing.
 * Uses constructor DI for testability.
 */
import type { ISubscriptionRepository } from "@/infrastructure/persistence/subscription/ISubscriptionRepository"
import type {
  ISubscriptionGateway,
  WebhookEvent,
  CheckoutSessionResult,
  CustomerPortalResult,
} from "./SubscriptionGateway"

type SubscriptionError =
  | "FEATURE_DISABLED"
  | "ALREADY_SUBSCRIBED"
  | "NO_SUBSCRIPTION"

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export interface SubscriptionStatus {
  status: string
  planId: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

export class SubscriptionService {
  constructor(
    private readonly repo: ISubscriptionRepository,
    private readonly gateway: ISubscriptionGateway,
    private readonly checkFeature: () => Promise<boolean>
  ) {}

  async initiateCheckout(
    providerId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Result<CheckoutSessionResult, SubscriptionError>> {
    if (!(await this.checkFeature())) {
      return { ok: false, error: "FEATURE_DISABLED" }
    }

    // Check for existing active subscription
    const existing = await this.repo.findByProviderId(providerId)
    if (existing && existing.status !== "canceled") {
      return { ok: false, error: "ALREADY_SUBSCRIBED" }
    }

    const result = await this.gateway.createCheckoutSession({
      providerId,
      planId,
      successUrl,
      cancelUrl,
    })

    return { ok: true, value: result }
  }

  async getStatus(
    providerId: string
  ): Promise<Result<SubscriptionStatus | null, SubscriptionError>> {
    if (!(await this.checkFeature())) {
      return { ok: false, error: "FEATURE_DISABLED" }
    }

    const sub = await this.repo.findByProviderId(providerId)
    if (!sub) {
      return { ok: true, value: null }
    }

    return {
      ok: true,
      value: {
        status: sub.status,
        planId: sub.planId,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    }
  }

  async getPortalUrl(
    providerId: string,
    returnUrl: string
  ): Promise<Result<CustomerPortalResult, SubscriptionError>> {
    if (!(await this.checkFeature())) {
      return { ok: false, error: "FEATURE_DISABLED" }
    }

    const sub = await this.repo.findByProviderId(providerId)
    if (!sub || !sub.stripeCustomerId) {
      return { ok: false, error: "NO_SUBSCRIPTION" }
    }

    const result = await this.gateway.createCustomerPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl,
    })

    return { ok: true, value: result }
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data)
        break
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data)
        break
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data)
        break
      case "invoice.paid":
        await this.handleInvoicePaid(event.data)
        break
    }
  }

  private async handleCheckoutCompleted(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data.subscription as string
    const stripeCustomerId = data.customer as string
    const metadata = data.metadata as { providerId: string }

    const existing = await this.repo.findByProviderId(metadata.providerId)

    if (existing) {
      await this.repo.update(existing.id, {
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
      })
    } else {
      await this.repo.create({
        providerId: metadata.providerId,
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
      })
    }
  }

  private async handleSubscriptionUpdated(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data.id as string
    const sub = await this.repo.findByStripeSubscriptionId(stripeSubscriptionId)
    if (!sub) return

    const updateData: Parameters<typeof this.repo.update>[1] = {
      status: data.status as string,
      cancelAtPeriodEnd: data.cancel_at_period_end as boolean,
    }
    if (data.current_period_start) {
      updateData.currentPeriodStart = new Date((data.current_period_start as number) * 1000)
    }
    if (data.current_period_end) {
      updateData.currentPeriodEnd = new Date((data.current_period_end as number) * 1000)
    }
    await this.repo.update(sub.id, updateData)
  }

  private async handleSubscriptionDeleted(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data.id as string
    const sub = await this.repo.findByStripeSubscriptionId(stripeSubscriptionId)
    if (!sub) return

    await this.repo.update(sub.id, { status: "canceled" })
  }

  private async handleInvoicePaid(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data.subscription as string
    if (!stripeSubscriptionId) return

    const sub = await this.repo.findByStripeSubscriptionId(stripeSubscriptionId)
    if (!sub) return

    await this.repo.update(sub.id, { status: "active" })
  }
}
