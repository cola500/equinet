---
title: "Prenumerationer (Subscriptions)"
description: "API-dokumentation for Stripe-baserade prenumerationer: checkout, portal, status och webhooks"
category: api
tags: [api, stripe, subscriptions, webhooks, feature-flag]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
sections:
  - POST /api/provider/subscription/checkout
  - POST /api/provider/subscription/portal
  - GET /api/provider/subscription/status
  - POST /api/webhooks/stripe
  - Arkitektur
---

# Prenumerationer (Subscriptions)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

**Feature flag:** `provider_subscription` maste vara aktiverad.

---

## POST /api/provider/subscription/checkout

Skapa en Stripe Checkout-session for att starta prenumeration.

**Auth:** Required (provider)
**Rate limiter:** `subscription` (5/h produktion)

**Request Body:**
```json
{
  "planId": "basic",
  "successUrl": "https://equinet.se/provider/settings?success=true",
  "cancelUrl": "https://equinet.se/provider/settings"
}
```

**Validering:**
- `planId`: Obligatorisk, icke-tom strang
- `successUrl`, `cancelUrl`: Giltiga URL:er

**Response:** `200 OK`
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Felkoder:**
- `400` -- Valideringsfel
- `403` -- Inte provider
- `404` -- Feature flag avaktiverad
- `409` -- `"Du har redan en aktiv prenumeration"`
- `429` -- Rate limit
- `500` -- Internt serverfel

---

## POST /api/provider/subscription/portal

Oppna Stripe Customer Portal for att hantera befintlig prenumeration (uppgradering, avbokning, betalningsmetod).

**Auth:** Required (provider)
**Rate limiter:** `subscription` (5/h produktion)

**Request Body:**
```json
{
  "returnUrl": "https://equinet.se/provider/settings"
}
```

**Response:** `200 OK`
```json
{
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

**Felkoder:**
- `400` -- Valideringsfel
- `403` -- Inte provider
- `404` -- Feature flag avaktiverad eller ingen prenumeration (`"Ingen aktiv prenumeration"`)
- `429` -- Rate limit
- `500` -- Internt serverfel

---

## GET /api/provider/subscription/status

Hamta aktuell prenumerationsstatus.

**Auth:** Required (provider)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "status": "active",
  "planId": "basic",
  "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false
}
```

Om ingen prenumeration finns returneras `null`.

**Mojliga statusvarden:** `active`, `past_due`, `canceled`, `trialing`

**Felkoder:**
- `403` -- Inte provider
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit
- `500` -- Internt serverfel

---

## POST /api/webhooks/stripe

Stripe webhook-endpoint. Hanterar prenumerationshangelser fran Stripe.

**Auth:** Stripe webhook-signatur (inte session-baserad)

**Hanterade event-typer:**
- `checkout.session.completed` -- Skapar/uppdaterar prenumeration
- `customer.subscription.updated` -- Uppdaterar status, perioder, cancelAtPeriodEnd
- `customer.subscription.deleted` -- Satter status till `canceled`
- `invoice.paid` -- Ateraktiverar prenumeration

**Response:** `200 OK`
```json
{
  "received": true
}
```

**Felkoder:**
- `400` -- `"Ogiltig signatur"` (Stripe signaturverifiering misslyckades)
- `500` -- `"Webhook-hanteringsfel"`

> **Konfiguration:** Kraver `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` och `STRIPE_PRICE_ID_BASIC` i miljovariablerna. Under utveckling anvands mock-gateway (`SUBSCRIPTION_PROVIDER="mock"`).

---

## Arkitektur

```
Route -> SubscriptionService -> SubscriptionGateway (Stripe/Mock)
                              -> SubscriptionRepository (Prisma)
```

- **Gateway pattern**: `ISubscriptionGateway` abstraherar Stripe. Mock-gateway for utveckling.
- **Factory DI**: `createSubscriptionService()` injicerar alla beroenden.
- **Result type**: Service returnerar `Result<T, E>` med typsaker felhantering.
- **Dual gating**: Feature flag kontrolleras bade i route och service (defense in depth).

---

*Senast uppdaterad: 2026-02-28*
