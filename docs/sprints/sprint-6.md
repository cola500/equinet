---
title: "Sprint 6: Kvalitet + demo-feedback"
description: "BDD-audit, Stripe E2E fix, Swish-aktivering. Demo-feedback stories läggs till efter demo."
category: sprint
status: active
last_updated: 2026-04-01
tags: [sprint, quality, testing, bdd, demo-feedback]
sections:
  - Sprint Overview
  - Stories
  - Alternativa stories
  - Sprint Retro Template
---

# Sprint 6: Kvalitet + demo-feedback (UTKAST)

**Status:** UTKAST -- justeras efter leverantörsdemo
**Sprint Duration:** 1 vecka
**Sprint Goal:** Täppa till testkvalitetsgap, agera på demo-feedback, aktivera Swish.

---

## Sprint Overview

Sprint 5 levererade Stripe-betalning men avvek från BDD dual-loop -- integrationstester
saknades för payment routes. Sprint 6 börjar med att åtgärda det och audita resten
av kodbasen. Resterande stories baseras på demo-feedback.

---

## Stories

### S6-1: BDD integrationstest-audit -- READY

**Prioritet:** Högst
**Typ:** Kvalitet
**Beskrivning:** Audita alla API routes och domain services. Identifiera vilka som saknar
integrationstester (har bara unit-tester med fullmockade beroenden). Skapa integrationstester
för de viktigaste.

**Uppgifter:**

1. **Inventera** alla route.test.ts-filer:
   - Klassificera: har integrationstester (kör route -> service -> repo) eller bara unit (allt mockat)?
   - Prioritera: kärndomäner (booking, payment, review, customer) först
2. **Skriv integrationstester** för de 5-10 viktigaste routes som saknar dem:
   - Payment routes (S5-2, S5-3 -- identifierad lucka)
   - Booking CRUD routes
   - Auth-relaterade routes
3. **Dokumentera** mönster för integrationstester vs unit-tester i `.claude/rules/testing.md`

**Acceptanskriterier:**
- [ ] Inventering klar med klassificering per route
- [ ] Minst 5 nya integrationstester för kärndomäner
- [ ] Testing.md uppdaterad med tydlig BDD dual-loop-guide
- [ ] `npm run check:all` passerar

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S6-2: Stripe E2E-test fungerar lokalt -- READY

**Prioritet:** Hög
**Typ:** Buggfix/test
**Beskrivning:** Stripe E2E auto-skippas pga `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` inte injiceras i Turbopack dev-server via playwright webServer.env. Fix: lägg pk_test-nyckeln i `.env` (publik test-nyckel, inte hemlig). Verifiera att E2E passerar 3 gånger i rad.

**Uppgifter:**
1. Lägg till `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` i `.env`
2. Kör `npx playwright test e2e/stripe-payment.spec.ts` -- verifiera att den inte skippas
3. Hantera Stripe iframe-interaktion (frameLocator) om det kräver finjustering
4. Verifiera att befintliga mock-tester fortfarande passerar
5. Passerar 3 gånger i rad

**Acceptanskriterier:**
- [ ] Stripe E2E kör (inte skippad) med test-nycklar
- [ ] Betalning med test-kort 4242 4242 4242 4242 genomförs
- [ ] Befintliga payment mock-tester oförändrade
- [ ] `npm run check:all` passerar

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S6-3: Aktivera Swish i Stripe -- PENDING (kräver företagsverifiering)

**Prioritet:** Hög
**Typ:** Config
**Beskrivning:** När Stripe-kontot har företagsverifiering klar, aktivera Swish som payment method.

**Uppgifter:**
1. Verifiera företag i Stripe Dashboard
2. Aktivera Swish under Payment Methods
3. Uppdatera `StripePaymentGateway`: `payment_method_types: ['card', 'swish']`
4. Testa i test-mode
5. PaymentDialog: uppdatera beskrivning "Välj betalmetod" (kort eller Swish)

**Acceptanskriterier:**
- [ ] Swish synlig i Payment Element
- [ ] Tester uppdaterade
- [ ] E2E-test med Swish (om möjligt i test-mode)

**Blocker:** Stripe företagsverifiering

---

### S6-3 -- S6-N: Demo-feedback stories -- TBD

> Fylls i efter leverantörsdemon. Se sprint-5.md alternativ-tabell:
>
> | Feedback | Story | Effort |
> |----------|-------|--------|
> | "Jag vill se kundernas upplevelse" | Kundflöde-polish | 1 vecka |
> | "Jag behöver se rutten för dagen" | Ruttplanering (Mapbox) | 2 veckor |
> | "Kan jag koppla till Fortnox?" | Fortnox-integration | 2-3 veckor |
> | "Jag vill testa med mina riktiga kunder" | Onboarding utan demo-seed | 1 vecka |
> | "Appen känns seg" | Prestandaoptimering | 1 vecka |

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Demo-feedback som påverkade sprinten?
