---
title: "Pattern: Gateway abstraction"
description: "Interface + mock + factory for externa tjanster som kan bytas ut (betalning, bokforing, prenumeration)"
category: architecture
status: active
last_updated: 2026-04-17
tags: [pattern, gateway, di, stripe, fortnox]
related:
  - docs/architecture/patterns.md
  - src/domain/payment/PaymentGateway.ts
  - src/domain/subscription/SubscriptionGateway.ts
  - src/domain/accounting/AccountingGateway.ts
sections:
  - Problemet
  - Losningen
  - Struktur
  - Implementationssteg
  - Factory-funktionen
  - Testning
  - Nar anvanda
  - Nar INTE anvanda
  - Kodreferenser
---

# Pattern: Gateway abstraction

## Problemet

Extern-tjänst-integration (betalning, bokforing, email) tenderar att lacka in i hela kodbasen. Nar teamet vill byta fran en provider till en annan (Stripe -> Swish, Resend -> SendGrid) maste dussintals filer andras.

Dessutom ar det opraktiskt att kora mot riktiga externa tjanster i utveckling och test.

## Losningen

Satt ett **interface** framfor den externa tjansten. Implementera:

1. **MockGateway** -- instant-success, inga externa anrop, anvands i utveckling/test
2. **RealGateway** -- riktig integration (t.ex. StripePaymentGateway)
3. **Factory-funktion** -- vaxlar via env-variabel

```
API Route / Domain Service
    |
    v
IPaymentGateway (interface)
    |
    +-- MockPaymentGateway (dev/test)
    +-- StripePaymentGateway (produktion)
```

Routes och services importerar aldrig Stripe/Fortnox direkt -- de anvander interfacet.

## Struktur

En gateway-fil innehaller:

```typescript
// 1. Request/Response-typer
export interface PaymentRequest { ... }
export interface PaymentResult { ... }

// 2. Interface
export interface IPaymentGateway {
  readonly providerName: string
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>
  checkStatus(id: string): Promise<PaymentResult>
}

// 3. Mock-implementation (i samma fil)
export class MockPaymentGateway implements IPaymentGateway {
  readonly providerName = "mock"
  async initiatePayment(_request: PaymentRequest): Promise<PaymentResult> {
    return { success: true, providerPaymentId: `mock_${Date.now()}`, ... }
  }
}

// 4. Factory (i samma fil)
export function getPaymentGateway(): IPaymentGateway {
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    const { StripePaymentGateway } = require("./StripePaymentGateway")
    return new StripePaymentGateway(process.env.STRIPE_SECRET_KEY!)
  }
  return new MockPaymentGateway()
}
```

Den riktiga implementationen (StripePaymentGateway) ligger i en **separat fil** och lazy-importeras. Sa laddas Stripe SDK:t bara nar det behovs.

## Implementationssteg

### 1. Definiera interfacet

Borja med de operationer doman-tjansten behover. Inkludera INTE provider-specifika detaljer (t.ex. Stripe-sessioner) i interfacet -- abstrahera dem till generiska begrepp.

**Bra:**
```typescript
createCheckoutSession(request: CheckoutRequest): Promise<CheckoutResult>
```

**Daligt:**
```typescript
createStripeSession(priceId: string): Promise<Stripe.Checkout.Session>
```

### 2. Implementera mock forst

Mock-gatewayen ger dig en fungerande applikation omedelbart. Ingen behover Stripe-nycklar for att kora lokalt.

### 3. Implementera riktig gateway i separat fil

Separera sa att SDK-beroendet ar isolerat:
- `PaymentGateway.ts` -- interface + mock + factory (ingen `import stripe`)
- `StripePaymentGateway.ts` -- riktig implementation (har `import Stripe from 'stripe'`)

### 4. Factory med lazy import

```typescript
// Lazy import undviker att ladda Stripe SDK nar PAYMENT_PROVIDER != "stripe"
const { StripePaymentGateway } = require("./StripePaymentGateway")
```

### 5. Env-variabel styr

| Env | Varde | Gateway |
|-----|-------|---------|
| `PAYMENT_PROVIDER` | `stripe` | StripePaymentGateway |
| `PAYMENT_PROVIDER` | odefinierad / `mock` | MockPaymentGateway |
| `SUBSCRIPTION_PROVIDER` | `stripe` | StripeSubscriptionGateway |
| `ACCOUNTING_PROVIDER` | `fortnox` | FortnoxGateway |

## Factory-funktionen

Factory-monstret ar enkelt men kraftfullt:

```typescript
export function getPaymentGateway(): IPaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER

  if (provider === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY kravs")
    const { StripePaymentGateway } = require("./StripePaymentGateway")
    return new StripePaymentGateway(secretKey)
  }

  return new MockPaymentGateway()
}
```

**Varfor `require()` istallet for `import`?**
- Lazy loading: Stripe SDK (1.5 MB) laddas inte i dev/test
- Villkorlig: nar `PAYMENT_PROVIDER` inte ar "stripe" sker inget

## Testning

```typescript
// Unit test -- anvand mock direkt
const gateway = new MockPaymentGateway()
const result = await gateway.initiatePayment({ amount: 500, ... })
expect(result.success).toBe(true)

// Integration test -- testa riktig gateway mot Stripe test-miljo
const gateway = new StripePaymentGateway(process.env.STRIPE_TEST_KEY!)
```

Mock-gatewayen ar INTE bara for tester -- den ar for hela utvecklingsmiljon. Ingen utvecklare ska behova en Stripe-nyckel for att kora appen lokalt.

## Nar anvanda

- **Extern tjanst med mojliga utbyten** (Stripe -> Swish, Resend -> SendGrid)
- **Dyr eller langsam extern tjanst** som du vill undvika i dev/test
- **Tjanst som kraver credentials** som inte alla utvecklare har
- **Kommande integration** (t.ex. Fortnox) -- skapa interfacet nu, implementera sen

## Nar INTE anvanda

- **Intern tjanst som aldrig byts ut** -- overhead motiveras inte
- **Enkel API-anrop utan komplex logik** -- en utility-funktion racker
- **Nar det bara finns en mojlig provider** (t.ex. Supabase Auth) -- abstraktionen doler bara komplexitet

**Tumregel:** Om du kan forestalla dig att byta provider inom 2 ar, anvand gateway. Annars ar det YAGNI.

## Kodreferenser

| Gateway | Interface | Mock | Riktig implementation |
|---------|----------|------|--------------------|
| Payment | `IPaymentGateway` | `MockPaymentGateway` | `StripePaymentGateway` |
| Subscription | `ISubscriptionGateway` | `MockSubscriptionGateway` | `StripeSubscriptionGateway` |
| Accounting | `IAccountingGateway` | `MockAccountingGateway` | `FortnoxGateway` |

| Fil | Beskrivning |
|-----|-------------|
| `src/domain/payment/PaymentGateway.ts` | Interface + mock + factory |
| `src/domain/payment/StripePaymentGateway.ts` | Stripe-implementation |
| `src/domain/subscription/SubscriptionGateway.ts` | Interface + mock + factory |
| `src/domain/subscription/StripeSubscriptionGateway.ts` | Stripe-implementation |
| `src/domain/accounting/AccountingGateway.ts` | Interface + mock + factory |
| `src/domain/accounting/FortnoxGateway.ts` | Fortnox-implementation |
