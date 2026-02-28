/**
 * SubscriptionServiceFactory - Creates SubscriptionService with production dependencies
 */
import { SubscriptionService } from "./SubscriptionService"
import { subscriptionRepository } from "@/infrastructure/persistence/subscription"
import { getSubscriptionGateway } from "./SubscriptionGateway"
import { isFeatureEnabled } from "@/lib/feature-flags"

export function createSubscriptionService(): SubscriptionService {
  return new SubscriptionService(
    subscriptionRepository,
    getSubscriptionGateway(),
    () => isFeatureEnabled("provider_subscription")
  )
}
