---
title: "Sprint 5: Betalning (UTKAST -- väntar på demo-feedback)"
description: "Stripe + Swish-integration. Utkast baserat på research, justeras efter leverantörsdemo."
category: sprint
status: draft
last_updated: 2026-04-01
tags: [sprint, payment, stripe, swish, monetization]
sections:
  - Sprint Overview
  - Förutsättningar
  - Stories
  - Alternativa stories (beroende på demo-feedback)
  - Sprint Retro Template
---

# Sprint 5: Betalning (UTKAST)

**Status:** UTKAST -- justeras efter leverantörsdemo
**Sprint Duration:** 1-2 veckor
**Sprint Goal:** Leverantörer kan ta betalt via Swish genom appen.

---

## Sprint Overview

Equinet har redan `IPaymentGateway`-abstraktion med factory-funktion och
`provider: "stripe" | "swish" | "mock"` i Prisma-schemat. En `StripePaymentGateway`
pluggar rakt in. Swish nås via Stripe som lokal betalmetod -- ingen direkt
Swish API-integration (undviker mTLS-certifikat).

**Research-underlag:** `docs/retrospectives/2026-04-01-sprint-3-team-foundation.md`
(Swish-avsnitt) + befintlig kod i `src/domain/payment/`.

---

## Förutsättningar (Johan)

| Vad | Status | Behövs innan sprint |
|-----|--------|-------------------|
| Stripe-konto | Ej skapat | Ja -- krävs för API-nycklar |
| Swish aktiverat i Stripe | Ej gjort | Ja -- Stripe Dashboard -> Payment Methods -> Swish |
| `STRIPE_SECRET_KEY` i Vercel env | Ej satt | Ja |
| `STRIPE_WEBHOOK_SECRET` i Vercel env | Ej satt | Ja (efter webhook-route skapats) |
| Apple Developer (för push) | Ej köpt | Nej -- separat spår |

---

## Stories

### S5-1: Stripe-konto + grundkonfiguration -- READY

**Prioritet:** Högst (blockerar allt annat)
**Typ:** Operations + config
**Beskrivning:** Skapa Stripe-konto, aktivera Swish, sätt env-variabler.

**Uppgifter:**
1. Johan skapar Stripe-konto på stripe.com
2. Aktivera Swish som payment method i Stripe Dashboard
3. Skapa API-nycklar (test-mode först)
4. Sätt `STRIPE_SECRET_KEY` och `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i Vercel env
5. Verifiera att test-mode fungerar lokalt

**Acceptanskriterier:**
- [ ] Stripe Dashboard visar Swish som aktiv payment method
- [ ] Lokalt: `stripe listen` webhook forwarding fungerar
- [ ] Env-variabler satta i Vercel (Production + Preview)

---

### S5-2: StripePaymentGateway implementation -- READY

**Prioritet:** Hög
**Typ:** Backend
**Beskrivning:** Implementera `StripePaymentGateway` som ersätter `MockPaymentGateway`.

**Uppgifter:**
1. Installera `@stripe/stripe-node`
2. Implementera `StripePaymentGateway` (implements `IPaymentGateway`):
   - `initiatePayment()` -> `stripe.paymentIntents.create({ payment_method_types: ['swish'] })`
   - `checkStatus()` -> `stripe.paymentIntents.retrieve()`
3. Uppdatera `getPaymentGateway()` factory att läsa `PAYMENT_PROVIDER` env-var
4. Feature flag `stripe_payments` (default off)
5. Tester: mock Stripe SDK, testa happy path + felhantering

**Acceptanskriterier:**
- [ ] `StripePaymentGateway` implementerar `IPaymentGateway`
- [ ] Factory byter gateway baserat på env-var
- [ ] Unit-tester med mockad Stripe SDK
- [ ] Feature flag-gating på route-nivå

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S5-3: Stripe webhook-route -- READY

**Prioritet:** Hög
**Typ:** Backend
**Beskrivning:** Webhook-route för Stripe-callbacks (payment succeeded/failed).

**Uppgifter:**
1. Skapa `/api/webhooks/stripe/route.ts`
2. Verifiera webhook-signatur med `stripe.webhooks.constructEvent()`
3. Hantera events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Uppdatera bokningsstatus vid lyckad betalning
5. Tester: signaturverifiering, event-hantering, felfall

**Acceptanskriterier:**
- [ ] Webhook verifierar Stripe-signatur
- [ ] Betalningsstatus uppdateras i databasen
- [ ] Felaktiga signaturer returnerar 400
- [ ] Unit-tester för alla event-typer

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S5-4: Betalning i bokningsflödet (UI) -- READY

**Prioritet:** Medel
**Typ:** Frontend
**Beskrivning:** Integrera Stripe Payment Element i bokningsflödet.

**Uppgifter:**
1. Installera `@stripe/react-stripe-js` + `@stripe/stripe-js`
2. Skapa `PaymentStep`-komponent med Stripe Payment Element
3. Integrera i bokningsflödet (efter bekräftelse, före slutförande)
4. Hantera loading, error, success states
5. Swish-specifikt: QR-kod eller redirect till Swish-appen

**Acceptanskriterier:**
- [ ] Kund ser betalningsalternativ (Swish) i bokningsflödet
- [ ] Betalning genomförs via Swish test-mode
- [ ] Felhantering vid avbruten/misslyckad betalning
- [ ] Visuell verifiering med Playwright MCP

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S5-5: E2E-test betalningsflöde -- BACKLOG

**Prioritet:** Låg
**Typ:** Test
**Beskrivning:** E2E-test för hela boknings+betalningsflödet med Stripe test-mode.

**Acceptanskriterier:**
- [ ] E2E: boka -> betala med test-kort -> bekräftelse
- [ ] Passerar 3 gånger i rad

---

## Alternativa stories (beroende på demo-feedback)

Dessa ersätter eller kompletterar ovan beroende på vad leverantören säger:

| Feedback | Story | Effort |
|----------|-------|--------|
| "Jag vill se kundernas upplevelse" | Kundflöde-polish (WebView UX) | 1 vecka |
| "Jag behöver se rutten för dagen" | Ruttplanering (kräver Mapbox-token) | 2 veckor |
| "Kan jag koppla till Fortnox?" | Fortnox API-integration | 2-3 veckor |
| "Jag vill testa med mina riktiga kunder" | Onboarding utan demo-seed | 1 vecka |
| "Appen känns seg" | Prestandaoptimering | 1 vecka |

---

## Prioritetsordning

1. **S5-1** (Stripe-konto) -- blockerar allt
2. **S5-2** (StripePaymentGateway) -- backend först
3. **S5-3** (webhook) -- callback-hantering
4. **S5-4** (UI) -- kundsynlig
5. **S5-5** (E2E) -- kvalitetssäkring

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Demo-feedback som påverkade sprinten?
