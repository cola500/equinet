---
title: Payment/checkout-domänen -- genomlysning
description: Analys av betalnings- och prenumerationslogik -- ansvar, styrkor, svagheter, risker
category: architecture
status: active
last_updated: 2026-06-07
related:
  - docs/architecture/stripe-webhook-architecture.md
  - docs/architecture/webhook-idempotency-pattern.md
sections:
  - Översikt
  - Centrala filer
  - Ansvarsfördelning
  - Use cases
  - Styrkor
  - Svagheter
  - Stabila delar
  - Hotspots
---

# Payment/checkout-domänen -- genomlysning

> Genomförd 2026-03-28. Baserad på faktisk kod.
> **Webhook-delen uppdaterad 2026-06-07** efter webhook-refaktorn (2026-06-06). Arkitektur-beslutet i [stripe-webhook-architecture.md](architecture/stripe-webhook-architecture.md). Payment-route-fynden (PaymentService oanvänd, kvitto-HTML, invoice-kollision) är från 2026-03-28 och ej omverifierade i denna runda.

---

## Översikt

Equinet har **två separata betalningsdomäner** som inte är kopplade till varandra:

1. **Betalning per bokning** (`src/domain/payment/`) -- kund betalar för enskild bokning
2. **Leverantörsprenumeration** (`src/domain/subscription/`) -- leverantör prenumererar på plattformen via Stripe

| Domän | Service | Gateway | Route-filer | Prisma-modell |
|-------|---------|---------|-------------|---------------|
| Payment | PaymentService + PaymentWebhookService | Mock + StripePaymentGateway | `bookings/[id]/payment`, `bookings/[id]/receipt`, `webhooks/stripe` | Payment |
| Subscription | SubscriptionService (183 LOC) | Mock + StripeSubscriptionGateway | `provider/subscription/*`, `webhooks/stripe` | ProviderSubscription |

> **Webhook delas av båda domänerna:** `POST /api/webhooks/stripe` routar `payment_intent.*` → `PaymentWebhookService` och prenumerations-events → `SubscriptionService`. Signaturverifiering är **provider-oberoende** (se [stripe-webhook-architecture.md](architecture/stripe-webhook-architecture.md)).

---

## Centrala filer

### Payment-domänen

| Fil | LOC | Roll |
|-----|-----|------|
| `domain/payment/PaymentService.ts` | 200 | processPayment, getPaymentStatus |
| `domain/payment/createPaymentService.ts` | 79 | Factory med Prisma-beroenden |
| `domain/payment/PaymentGateway.ts` | 64 | IPaymentGateway + MockPaymentGateway |
| `domain/payment/StripePaymentGateway.ts` | -- | Riktig Stripe PaymentIntent-implementation (real betalning) |
| `domain/payment/StripeWebhookVerifier.ts` | 37 | `verifyStripeWebhook()` -- provider-oberoende signaturverifiering, normaliserar `data.object` |
| `domain/payment/PaymentWebhookService.ts` | -- | Hanterar `payment_intent.succeeded/failed` -- slår upp Payment via `providerPaymentId`, atomisk statusuppdatering med terminal-state-guard |
| `domain/payment/createPaymentWebhookService.ts` | -- | Factory för PaymentWebhookService |
| `infrastructure/persistence/stripe/stripeWebhookEventRepository.ts` | -- | Dedup: `tryRecordEvent` (atomisk insert-or-ignore) + `deleteEvent` (vid processfel → retry) |
| `domain/payment/InvoiceNumberGenerator.ts` | 10 | EQ-YYYYMM-XXXXXX format |
| `domain/payment/mapPaymentErrorToStatus.ts` | 36 | 4 feltyper -> HTTP-status |
| `app/api/bookings/[id]/payment/route.ts` | ~280 | POST (betala) + GET (status) |
| `app/api/bookings/[id]/receipt/route.ts` | ~358 | GET (HTML-kvitto) |

### Subscription-domänen

| Fil | LOC | Roll |
|-----|-----|------|
| `domain/subscription/SubscriptionService.ts` | 183 | checkout, status, portal, webhooks |
| `domain/subscription/SubscriptionGateway.ts` | 173 | Interface + MockSubscriptionGateway |
| `domain/subscription/StripeSubscriptionGateway.ts` | 157 | Riktig Stripe-implementation |
| `domain/subscription/SubscriptionServiceFactory.ts` | 15 | Factory |
| `app/api/provider/subscription/checkout/route.ts` | ~42 | POST (initiera checkout) |
| `app/api/provider/subscription/portal/route.ts` | ~39 | POST (Stripe billing portal) |
| `app/api/provider/subscription/status/route.ts` | ~21 | GET (prenumerationsstatus) |
| `app/api/webhooks/stripe/route.ts` | ~76 | POST (Stripe webhook) -- verifiering + dedup + dual-routing (payment + subscription) |

---

## Ansvarsfördelning

### Subscription: bra separation

```
Route (withApiHandler) -> SubscriptionService -> SubscriptionGateway (Mock/Stripe)
                                              -> SubscriptionRepository (Prisma)
```

Routes delegerar till service. Service hanterar affärslogik (feature flag, dubblettcheck, webhook-routing). Gateway abstraherar Stripe. Repository abstraherar persistence. **Rent implementerat.**

### Payment: blandat

```
Route (direkt) -> PaymentGateway (Mock) + Prisma direkt
PaymentService (finns men ANVÄNDS INTE av routen)
```

**Nyckelinsikt**: `PaymentService` existerar med fullständig logik (`processPayment`, `getPaymentStatus`), men `bookings/[id]/payment/route.ts` anropar **inte** `createPaymentService()`. Istället duplicerar routen samma logik: gateway-anrop, Prisma upsert, invoice-generering, event dispatch -- allt inline.

### Event-koppling: payment -> booking

Betalningsflödet emitterar `BookingPaymentReceivedEvent` som hanteras av BookingEventHandlers:
- Email: `sendPaymentConfirmationNotification`
- Notis: `NotificationType.PAYMENT_RECEIVED`
- Push: PushDeliveryService

Betalstatus påverkar **INTE** bokningsstatus. En bokning kan vara "confirmed" utan betalning, och betalning ändrar inte bokningens status. De är oberoende.

---

## Use cases

### 1. Kund betalar för bokning (POST /api/bookings/[id]/payment)

```
Kund -> auth + rate limit -> hämta bokning (Prisma direkt)
  -> validera: finns, ej betald, status confirmed/completed
  -> gateway.initiatePayment() (MockPaymentGateway -> instant success)
  -> prisma.payment.upsert() (invoice-nummer + receipt URL)
  -> dispatch BookingPaymentReceivedEvent (email + notis + push)
  -> returnera 200 { success, payment }
```

**All logik i routen.** PaymentService finns men används inte.

### 2. Kund/leverantör kollar betalstatus (GET /api/bookings/[id]/payment)

```
Auth -> hämta bokning+payment (Prisma direkt, OR: customer/provider)
  -> returnera { status: "unpaid", amount } eller { fullPaymentObject }
```

### 3. Kund hämtar kvitto (GET /api/bookings/[id]/receipt)

```
Auth -> hämta bokning+payment (Prisma direkt)
  -> validera payment.status === "succeeded"
  -> generera HTML inline (200+ rader template strings)
  -> returnera HTML-response
```

### 4. Leverantör initierar prenumeration (POST /api/provider/subscription/checkout)

```
withApiHandler(provider + feature flag) -> SubscriptionService.initiateCheckout()
  -> feature flag check -> dubblettcheck -> gateway.createCheckoutSession()
  -> returnera { checkoutUrl } (Stripe-hosted)
```

### 5. Stripe webhook (POST /api/webhooks/stripe)

Uppdaterad 2026-06-06. Se [stripe-webhook-architecture.md](architecture/stripe-webhook-architecture.md).

```
Raw body + signature -> verifyStripeWebhook()          (provider-oberoende: alltid Stripe SDK + STRIPE_WEBHOOK_SECRET)
  -> stripeWebhookEventRepository.tryRecordEvent()      (atomisk dedup; dubblett -> { received: true })
  -> route per event-typ:
       payment_intent.*  -> PaymentWebhookService.handlePaymentIntentSucceeded/Failed()
       övriga            -> SubscriptionService.handleWebhookEvent()
  -> vid processfel: deleteEvent() (släpp dedup-raden) + throw -> Stripe retryar
```

---

## Styrkor

### 1. Subscription-domänen är välstrukturerad

SubscriptionService med ren DI, gateway-abstraktion (Mock + Stripe), repository-pattern, feature flag-injection, Result<T, E>. Webhook-hantering med signaturverifiering. Routes använder withApiHandler. **Bästa betalningskoden i projektet.**

### 2. Payment-domänen har korrekt arkitektur -- den används bara inte

`PaymentService.ts` (200 LOC) har exakt rätt abstraktion: `processPayment(bookingId, customerId)` som validerar, anropar gateway, upsert:ar payment, genererar event. Problemet är att routen duplicerar detta istället för att anropa servicen.

### 3. Gateway-abstraktion möjliggör byte av betalleverantör

`IPaymentGateway` och `ISubscriptionGateway` med Mock-implementationer. Att byta till Swish/Stripe kräver bara en ny gateway-implementation och en env-variabel.

### 4. Betalstatus och bokningsstatus är frikopplade

Ingen automatisk statuskaskad. En bokning kan vara "confirmed" utan betalning. Enkel modell som undviker komplexa statusmaskiner.

### 5. Stripe-webhook har provider-oberoende signaturverifiering

`verifyStripeWebhook()` (`StripeWebhookVerifier.ts`) validerar att anropet kommer från Stripe — **alltid via Stripe SDK + `STRIPE_WEBHOOK_SECRET`, oberoende av `PAYMENT_PROVIDER`/`SUBSCRIPTION_PROVIDER`**. Plus idempotens via dedup-tabell (se [webhook-idempotency-pattern.md](architecture/webhook-idempotency-pattern.md)).

---

## Svagheter

### 1. PaymentService definierad men oanvänd (HUVUDPROBLEM)

`bookings/[id]/payment/route.ts` (~280 LOC) innehåller all betalningslogik inline:
- Bokning-lookup med Prisma direkt (rad 33-72)
- Statusvalidering (rad 82-95)
- Gateway-anrop (rad 98-104)
- Payment upsert med Prisma direkt (rad 118-138)
- Invoice-generering (rad 128)
- Event dispatch (rad 141-169)

`PaymentService.processPayment()` gör exakt samma saker. Routen borde anropa servicen istället.

**Konsekvens**: Om betalningslogiken behöver ändras finns den på 2 ställen (route + service). Oklart vilken som är "sanningen".

### 2. Kvitto-generering inline i route (358 LOC)

`bookings/[id]/receipt/route.ts` genererar HTML med template strings. Otestat, svårt att underhålla, blandar data-hämtning med presentation.

### 3. ~~Webhook-hantering saknar idempotency-tracking~~ -- LÖST 2026-06-06

Webhooken gör nu atomisk dedup via `stripeWebhookEventRepository.tryRecordEvent()` (insert-or-ignore på event-ID) och släpper dedup-raden vid processfel så Stripe kan retrya. Se [webhook-idempotency-pattern.md](architecture/webhook-idempotency-pattern.md).

### 4. Invoice-nummer har kollisionsrisk

`generateInvoiceNumber()` använder 6 tecken random (36^6 = ~2 miljarder). Schema har `@unique` constraint som fångar kollisioner, men koden hanterar inte constraint-felet -- det blir en obehandlad 500.

### 5. Inkonsekvent persistence-mönster

Subscription använder repository-pattern (`ISubscriptionRepository`). Payment använder Prisma direkt i route och factory. Inkonsekvent med projektets DDD-approach.

---

## Stabila delar

| Del | Varför stabil |
|-----|---------------|
| SubscriptionService | Ren DI, gateway-abstraktion, feature flag, Result-pattern |
| StripeSubscriptionGateway | Verifierad Stripe-integration, signaturkontroll |
| Webhook-routing | Tydlig dispatch per event-typ (payment + subscription) |
| Webhook-verifiering + idempotens | `StripeWebhookVerifier` (provider-oberoende) + dedup-tabell + retry-on-error (2026-06-06) |
| MockPaymentGateway | Deterministisk, inga externa beroenden |
| PaymentService (koden) | Välskriven -- problemet är att den inte används |
| Payment Prisma-schema | Korrekt med @unique constraints och index |

## Hotspots

| Del | Varför hotspot |
|-----|---------------|
| `bookings/[id]/payment/route.ts` | 280 LOC med duplicerad domänlogik |
| `bookings/[id]/receipt/route.ts` | 358 LOC inline HTML |
| PaymentService vs route-logik | Oklart vilken som är "source of truth" |
| Invoice-nummer kollision | Ej hanterat constraint-fel |

---

## Är det tecken på att routes innehåller för mycket domänlogik?

**Ja, i payment-routen.** `bookings/[id]/payment/route.ts` har ~100 rader domänlogik (validering, gateway-anrop, persistence, invoice-generering) som borde vara i `PaymentService`. Subscription-routes delegerar korrekt till service.

**Men**: problemet är **inte strukturellt** -- servicen finns redan. Det är bara en route som inte använder den.
