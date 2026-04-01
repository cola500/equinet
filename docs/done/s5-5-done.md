---
title: "S5-5: E2E betalning -- Done"
description: "Integrationstester + Stripe E2E for betalningsflödet"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S5-5: E2E betalning -- Done

## Acceptanskriterier

- [x] Integrationstester: route -> service -> gateway (BDD yttre loop)
- [x] E2E: Stripe Payment Element spec (auto-skip utan nycklar)
- [ ] E2E passerar 3 ganger i rad (kan inte verifieras utan Stripe-nycklar lokalt)

## Definition of Done

- [x] Alla 3794 tester grona (10 nya integrationstester)
- [x] Typecheck: 0 fel
- [x] Lint: 0 fel

## Vad som gjordes

1. **Integrationstester -- payment route** (5 tester):
   - Route -> PaymentService -> MockPaymentGateway (riktig kedja)
   - Bara Prisma + auth mockade
   - Testar: success, provider-lagring, 404, 400 (already paid), 400 (pending)

2. **Integrationstester -- webhook route** (5 tester):
   - Route -> PaymentWebhookService -> Prisma (mockad)
   - Testar: succeeded-uppdatering, idempotens, saknad payment, failed, terminal-state-skydd

3. **Stripe E2E spec** (`e2e/stripe-payment.spec.ts`):
   - Auto-skippar om `STRIPE_SECRET_KEY` saknas
   - Testar: klicka betala -> PaymentDialog -> fylla i kort (4242) -> bekraftelse
   - Anvander `frameLocator` for Stripe iframe-interaktion

4. **Playwright config**:
   - `FEATURE_STRIPE_PAYMENTS: 'true'` -- betalningsknapp synlig i E2E
   - `PAYMENT_PROVIDER: 'mock'` -- skyddar befintliga mock-tester

## Avvikelser

- Stripe E2E kan inte verifieras lokalt utan Stripe test-nycklar
- BDD-avvikelse atgardad: integrationstester tillagda som yttre loop

## Lardomar

- **vi.mock() maste inkludera ALLA exports**: `NotificationType` enum fran NotificationService anvandes av BookingEventHandlers. Mock utan den ger "No export defined". Losning: `importOriginal` + spread.
- **BDD dual-loop-gap**: Unit-tester av routen (mockad service) fangade inte integrationsproblem. Integrationstester med riktig service + mockad Prisma ar den yttre loopen som saknade.
- **PAYMENT_PROVIDER override i Playwright config**: Skyddar befintliga mock-tester fran att brytas av `.env.local` som satter `stripe`.
