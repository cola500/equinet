---
title: Provider E2E Value Flow — Readiness Audit (2026-06)
description: Read-only-audit av om vi kan köra ett end-to-end leverantörsflöde (kund bokar → leverantör accepterar → genomför → betalning/status/kvitto) på staging. Kartlägger flöde, betalnings-readiness, staging/prod-drift, blockers och rekommenderad första slice.
category: operations
status: draft
last_updated: 2026-06-06
tags: [e2e, payment, stripe, staging, demo, readiness]
depends_on:
  - docs/operations/staging-environment-setup.md
  - docs/operations/deployment-verification-guide.md
  - docs/architecture/booking-flow.md
related:
  - docs/payment-domain-review.md
  - docs/api/subscriptions.md
sections:
  - Sammanfattning
  - 1. Current flow map
  - 2. Payment readiness
  - 3. Staging vs prod drift
  - 4. Blockers
  - 5. Rekommenderad första slice
  - 6. Verifieringsplan
  - Bilaga - Täckning och gap
---

# Provider E2E Value Flow — Readiness Audit (2026-06)

> **Typ:** Read-only-analys. Ingen kod ändrad, ingen commit/push/deploy, ingen riktig betalning.
> **Datum:** 2026-06-06
> **Fråga:** Kan vi köra en E2E-slice för leverantör — kund bokar → leverantör accepterar → genomför → betalning/status/kvitto → båda ser rätt läge?

## Sammanfattning

**Kortsvar:** Boknings- och statuskedjan (boka → acceptera → genomför → status syns för båda) är **fullt byggd och fungerar redan i demo-mode utan blockers**. Den delen kan demonstreras E2E på staging idag.

**Betalningssteget är villkorligt:** Stripe-integrationen finns i koden (gateway, webhook, Payment-modell, kvittoroute), men:

1. Betalnings-API:t returnerar **404 om feature-flaggan `stripe_payments` är av** — och den är **default av** (`feature-flag-definitions.ts:117`).
2. **Det är ej verifierat** (kräver Vercel-åtkomst, ingår inte i denna read-only-audit) om staging har Stripe **test-nycklar** satta eller kör mock-gateway. Detta är blocker B1 nedan — måste kontrolleras innan slutsats om "betalning på staging".
3. Betalning är **kund-initierad manuellt** efter att bokning är `confirmed`/`completed`. Den triggas **inte automatiskt** när leverantören markerar genomförd.

> **Viktig nyansering:** En av utforskningsagenterna kallade plattformen "production-ready för Stripe". Det är en bedömning av att *koden* finns — inte ett bevis på att *staging-miljön är konfigurerad*. Skilj på kod-readiness (hög) och miljö-readiness (overifierad).

**Rekommenderad första slice:** **Alternativ B först, sedan A** — verifiera/konfigurera Stripe **test-mode** på staging (liten, isolerad), kör därefter den fullständiga E2E-slicen. Se sektion 5.

> **Uppdatering 2026-06-06 (Slice 1 utförd):** Staging-env är nu verifierad. Se sektion 2a. **Beslut: första E2E-rundan körs med mock-gateway; Stripe test-mode skjuts till separat senare slice.** Ingen config-ändring gjord ännu.

---

## 1. Current flow map

Hela kedjan kund ↔ leverantör, steg för steg med fil-referenser.

### Steg 1 — Kund skapar bokning

- **API:** `POST /api/bookings` (`src/app/api/bookings/route.ts:123`)
- Auth via `getAuthUser()` (401 om ej inloggad), Zod-validerad body, delegerar till `BookingService.createBooking()`.
- **Initial status:** `pending` (`BookingService.ts`, satt av domänen).
- **Event:** `BookingCreatedEvent` → e-post till kund + in-app-notis + push till leverantör (`BookingEventHandlers.ts`).

### Steg 2 — Leverantör accepterar

- **Ser väntande bokningar:** `/provider/bookings` (filterflik "Väntar") och `/provider/calendar` (gul = pending).
- **API:** `PUT /api/bookings/[id]` med `{ status: "confirmed" }` (`src/app/api/bookings/[id]/route.ts:27`).
- **State machine** (`src/domain/booking/BookingStatus.ts:17`):
  ```
  pending   → { confirmed, cancelled }
  confirmed → { completed, cancelled, no_show }
  completed (terminal)  cancelled (terminal)  no_show (terminal)
  ```
- **Ownership:** `updateStatusWithAuth()` med atomisk `WHERE { id, providerId }` (IDOR-skydd, providerId från session aldrig body).
- **Event:** `BookingStatusChangedEvent` → e-post + notis + push till kund.

### Steg 3 — Bokning i kalender/lista

- **Leverantör:** `/provider/calendar` (färgkodad per status) + `/provider/bookings` (grupperad per status).
- **Kund:** `/customer/bookings` (flikar Kommande/Tidigare/Alla, svensk status-badge).

### Steg 4 — Leverantör markerar genomförd

- **UI:** knapp "Markera som genomförd" visas när `status === "confirmed"` (`src/app/provider/bookings/page.tsx`).
- **API:** samma `PUT /api/bookings/[id]` med `{ status: "completed" }`.
- **Event:** `BookingStatusChangedEvent` → kund får "Tjänst slutförd, skriv gärna recension".

### Steg 5 — Betalning / status / kvitto

- **Betalning är ett separat, kund-initierat steg** (ej automatiskt vid completion):
  - **API:** `POST /api/bookings/[id]/payment` (`src/app/api/bookings/[id]/payment/route.ts`).
  - **Flagg-gate (rad 30):** `if (!(await isFeatureEnabled("stripe_payments"))) → 404 "Ej tillgänglig"`.
  - **Krav:** bokning måste vara `confirmed` eller `completed`, ej redan betald, ägs av kunden.
  - **Mock-gateway:** betalning blir `succeeded` direkt → `BookingPaymentReceivedEvent` (e-post + push + notis).
  - **Stripe-gateway:** returnerar `clientSecret`, status `pending`; **webhook** slutför (`src/app/api/webhooks/stripe/route.ts`).
- **Kvitto:** `GET /api/bookings/[id]/receipt` (`src/app/api/bookings/[id]/receipt/route.ts`) — HTML-kvitto, kräver `payment.status === "succeeded"`, ownership-kontroll.
- **Payment-modell** (`prisma/schema.prisma:343`): `bookingId` unik, `amount`, `status`, `provider` (mock|stripe|swish), `invoiceNumber`, `invoiceUrl`, valfri Fortnox-koppling.

### Steg 6 — Status-synk båda håll

- **SWR-polling** (`useSWR("/api/bookings")`) + **push** (iOS) + **in-app-notis**.
- Svenska statustermer enhetligt: `Väntar på svar / Bekräftad / Genomförd / Avbokad / Ej infunnit`.

```
KUND bokar ──pending──▶ LEVERANTÖR ser "Väntar" ──confirmed──▶ båda ser "Bekräftad"
   ──completed──▶ kund ser "Genomförd" + recensionsprompt
   ──(kund-initierad)──▶ POST /payment ──[flagg+gateway]──▶ kvitto
```

---

## 2. Payment readiness

| Komponent | Finns i kod? | Notering |
|-----------|:---:|----------|
| `StripePaymentGateway` | ✅ | `src/domain/payment/StripePaymentGateway.ts` — PaymentIntents, SEK→öre |
| Mock-gateway (default) | ✅ | `PAYMENT_PROVIDER` ej "stripe" → mock, betalning `succeeded` direkt |
| Webhook-route | ✅ | `src/app/api/webhooks/stripe/route.ts` — signaturverifiering + event-dedup |
| `Payment`-modell | ✅ | `prisma/schema.prisma:343` |
| Kvitto-route | ✅ | `src/app/api/bookings/[id]/receipt/route.ts` |
| Feature flag `stripe_payments` | ✅ men **default OFF** | `feature-flag-definitions.ts:113-120`, `defaultEnabled: false` |
| Subscription (leverantör→plattform) | ✅ separat | flagga `provider_subscription`, default off — **utanför denna E2E-slice** |
| **Stripe test-nycklar i staging** | ❓ **OVERIFIERAT** | Kräver Vercel-åtkomst — se blocker B1 |

### Env-variabler för Stripe-läge

Krävs endast om `PAYMENT_PROVIDER=stripe` (annars mock):

- `STRIPE_SECRET_KEY` (`sk_test_...` för test-mode)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- (`STRIPE_PRICE_ID_BASIC` — endast för subscription, ej relevant för boknings-E2E)

`scripts/check-prod-env.ts` kräver dessa i **production** men verifierar bara att de *finns*, inte att de har värde (känd lucka).

### Två lägen att välja mellan för E2E

1. **Mock-gateway + flaggan på** — enklast. Ingen Stripe-konfiguration, betalning blir `succeeded` direkt, kvitto genereras. Demonstrerar hela UI-flödet utan riktig betalning. **Rekommenderat för demo.**
2. **Stripe test-mode** — `sk_test_`/`pk_test_`-nycklar + test-kort (`4242...`) + webhook. Närmare produktion men kräver miljökonfiguration och webhook-uppsättning mot staging-URL.

---

## 2a. Slice 1-resultat — verifierat staging-läge (2026-06-06)

Read-only config-check mot Vercel-projektet `equinet-staging-app` (bekräftat staging, inte prod, via `STAGING_PROJECT=true` + `NEXT_PUBLIC_DEMO_MODE=true`). Inga secrets exponerade — endast namn, icke-secret config-strängar och publishable-nyckelns prefix.

| Variabel/flagga | Faktiskt läge på staging | Konsekvens |
|-----------------|--------------------------|------------|
| `PAYMENT_PROVIDER` | `stripe` | Staging kör riktiga StripePaymentGateway, **inte** mock |
| `STRIPE_SECRET_KEY` | Finns (krypterad) | — |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Finns, prefix `pk_test_` | **TEST-MODE** — ingen risk för riktiga debiteringar |
| `STRIPE_WEBHOOK_SECRET` | **Saknas** | Async Stripe-bekräftelse via webhook kan inte slutföras → kvitto (kräver `succeeded`) bryts |
| `stripe_payments` (feature flag) | `false` (verifierat via publikt `/api/feature-flags`) | Betalnings-API:t `POST /api/bookings/[id]/payment` returnerar 404 i nuläget |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Demo-läge aktivt |
| `DISABLE_EMAILS` / `DISABLE_CRONS` | `true` / `true` | Inga mejl/cron på staging |

**Slutsats Slice 1:** Miljön är ~80 % provisionerad för läge B (Stripe test-mode) — test-nycklar finns och `PAYMENT_PROVIDER=stripe`. Men `STRIPE_WEBHOOK_SECRET` saknas, vilket är just det kriterium som krävs för att välja B. Säkerhetsmässigt positivt: nycklarna är test-mode, inga live-nycklar på demo-miljön.

### Vägval (beslutat 2026-06-06)

- **Stripe test-mode är önskat läge på sikt.**
- **Mock-gateway rekommenderas och väljs för första E2E-rundan.**
- **Skäl:** webhook saknas på staging, och mock isolerar produktflödet (boka → acceptera → genomför → kvitto) från extern betal-infrastruktur. Vi bevisar produktvärdet först, kopplar på riktig Stripe-infra senare.
- **Ingen config-ändring gjord i Slice 1** — detta är ren analys/dokumentation. Konfiguration sker i kommande slice efter separat beslut.

### Kommande slice — aktivera Stripe test-mode (ej nu)

Egen, isolerad slice när vi vill ha realistisk betalning:
1. Lägg till `STRIPE_WEBHOOK_SECRET` (från Stripe test-dashboard) i `equinet-staging-app`-env.
2. Registrera webhook-endpoint `https://equinet-staging.johanlindengard.com/api/webhooks/stripe` i Stripe (test-mode), events `payment_intent.succeeded` + `payment_intent.payment_failed`.
3. Verifiera testkort (`4242 4242 4242 4242`) → webhook → `Payment.status = succeeded` → kvitto genereras.

---

## 3. Staging vs prod drift

`origin/staging` vs `origin/main` per 2026-06-06:

- **Staging ligger 94 commits FÖRE main.** Hela demo-paketet (demo-mode-UX, customer home `/hem`, demo-login-personas, hovslagar-terminologi, kalender-first, mobilnav-trim) finns **bara på staging**.
- **Main ligger 10 commits före staging** — mest dependency-bumps (react, tsx, @types/react), README-uppdateringar, samt `refactor(ai): extract shared extractJsonObject helper` och en testfix (dynamiskt framtidsdatum i booking-series-test).

### Risker med driften

| Risk | Allvar | Kommentar |
|------|:---:|----------|
| 94 commits omergade till prod | **Hög** | Demoupplevelsen existerar inte i prod. Vid framtida `staging→main` blir det en stor merge med bred yta. |
| Demo-specifika ändringar i prod-kod | Medel | Många commits är demo-UX (`feat(demo)`, `style:`). Vissa rör delad kod (`Header.tsx`, nav, login-routing via `/dashboard`). Måste granskas så de inte ändrar prod-beteende oavsiktligt. |
| Main→staging ej synkad | Låg | 10 commits, mest deps. Bör mergas in i staging för att undvika konflikt-divergens (jfr CLAUDE.md plan-commit-ordning). |
| `seed-demo-provider.ts` interaktiv | Medel | Staging-seed kräver manuell `DATABASE_URL` — kan inte köras autonomt. |

**Bedömning:** Staging är rätt miljö för demo-arbetet (där bygger demo-branchen). Men prod-synk bör **inte** göras blint — 94 commits med blandat demo/delad kod kräver en separat readiness-review innan `staging→main`. Det är dock **inte en blocker** för att köra E2E-slicen *på staging nu*.

---

## 4. Blockers

| ID | Blocker | Typ | Allvar | Åtgärd |
|----|---------|------|:---:|--------|
| **B1** | ~~Overifierat betalningsläge på staging~~ **LÖST (Slice 1)** | Miljö | ~~Hög~~ → Klart | Verifierat: `PAYMENT_PROVIDER=stripe`, test-nycklar (`pk_test_`), `stripe_payments=false`, `STRIPE_WEBHOOK_SECRET` saknas. Se sektion 2a. |
| **B2** | `stripe_payments`-flaggan OFF på staging (verifierat `false`) | Konfiguration | Medel | Slå på via `/admin/system` på staging, eller `FEATURE_STRIPE_PAYMENTS=true`. Krävs i båda lägena (mock & stripe). Annars 404 på betalnings-API. |
| **B3** | Betalning triggas inte av "genomförd" — kräver separat kund-åtgärd | Flödesdesign | Låg-Medel | Designbeslut: ska demo visa kund som betalar manuellt? Finns betalnings-UI på kundens bokningsvy (`stripePaymentsEnabled`-gate i `customer/bookings/page.tsx`). |
| **B4** | `STRIPE_WEBHOOK_SECRET` saknas + webhook ej registrerad (bara relevant i test-mode) | Miljö | Medel (endast läge B) | Registrera `https://equinet-staging.johanlindengard.com/api/webhooks/stripe` i Stripe + sätt `STRIPE_WEBHOOK_SECRET`. **Mock-läget (valt för första rundan) behöver detta inte.** |
| **B7** | Staging är satt till `PAYMENT_PROVIDER=stripe` men mock valdes för första rundan | Konfiguration | Låg | Byt `PAYMENT_PROVIDER=mock` (eller ta bort raden) i staging-env inför mock-E2E. Använd REST API DELETE+POST / UI Edit, ej CLI `rm` på delad rad (CLAUDE.md Vercel-fällor). |
| **B5** | Loginbar demo-kund är opt-in i seed | Seed-data | Låg | Kör seed med `--customer-login` så `lisa.andersson@gmail.com` kan logga in (annars "ghostkund"). |
| **B6** | Staging-seed interaktiv (manuell DATABASE_URL) | Process | Låg | Kör seed manuellt mot staging-DB, eller verifiera lokalt med demo-server först. |

**Det som INTE är blockers (bekräftat):**

- ✅ Demo-mode blockerar **inte** boknings-/statusflödet. Inga `isDemoMode()`-villkor på `/api/bookings*`-routes. Kund kan boka, leverantör kan acceptera/genomföra.
- ✅ Ownership/IDOR är korrekt — atomisk `WHERE { id, providerId|customerId }`, alltid från session.
- ✅ UI-states finns: pending/confirmed/completed-vyer, kvitto-route, recensionsprompt.
- ✅ Seed skapar bokningar i blandade statusar (pending, confirmed, completed, cancelled) — bra startläge för demo.

---

## 5. Rekommenderad första slice

Av de fyra alternativen (A: börja E2E nu, B: fixa Stripe/test-config först, C: staging→prod readiness först, D: skriv runbook först):

### Rekommendation: **B → A** (med D vävt in i A)

> **Status 2026-06-06:** Slice 1 (env-verifiering) är **utförd** — se sektion 2a. Beslut: mock-gateway för första E2E-rundan, Stripe test-mode som senare slice. Nästa kvarvarande steg är konfiguration (mock + flagga) följt av själva E2E-körningen.

**Slice 1 (liten, isolerad): Verifiera och låsa betalningsläge på staging.** ✅ KLART
1. ~~Kontrollera staging Vercel-env~~ → klart, se 2a (`PAYMENT_PROVIDER=stripe`, `pk_test_`, webhook saknas, flagga `false`).
2. ~~Besluta läge~~ → **mock-gateway valt** för första rundan (webhook saknas, isolerar produktflödet).

**Slice 2 (config, ej utförd): Sätt staging i mock-läge.**
1. Byt `PAYMENT_PROVIDER=mock` (eller ta bort raden) i staging-env (B7).
2. Slå på `stripe_payments`-flaggan på staging (B2).
3. Redeploy (ev. tom commit för Lambda-env-cache).

**Slice 3: Kör den fullständiga E2E-slicen** enligt verifieringsplanen nedan, och dokumentera stegen som en lättviktig runbook samtidigt (Alt D — ingen separat förfas behövs).

**Varför inte C (prod-readiness) först:** Prod-synk av 94 commits är ett eget, större arbete som inte blockerar demo på staging. Gör den som separat spår *efter* att E2E-värdet är bevisat på staging — annars riskerar vi att blanda demo-stabilisering med en stor merge-review.

**Varför inte ren A direkt:** Utan B1-svaret vet vi inte om betalningssteget ens svarar (404-risk). 30 minuters miljökoll sparar en misslyckad demo-körning.

---

## 6. Verifieringsplan

Förutsättning: läs `docs/operations/deployment-verification-guide.md`. Demo-UX verifieras **bara** på staging (efter merge) eller lokalt med `NEXT_PUBLIC_DEMO_MODE=true`.

### Förberedelse
- [ ] B1: Bekräfta staging `PAYMENT_PROVIDER` + ev. Stripe test-nycklar (`vercel env pull`).
- [ ] B2: `stripe_payments` på (admin/system på staging).
- [ ] B5: Seed med `--customer-login` så demo-kund kan logga in.
- [ ] Bekräfta demo-personas: kund `lisa.andersson@gmail.com` / `DemoOwner123!`, leverantör `erik.jarnfot@demo.equinet.se` / `DemoProvider123!` (`src/components/landing/demo-personas.ts`).

### E2E-körning (lokalt först, sedan staging)

Lokalt: `NEXT_PUBLIC_DEMO_MODE=true PORT=3100 npx next dev` mot lokal Supabase med demo-seed, verifiera med Playwright MCP.

1. **Kund bokar** — logga in som kund, boka tjänst hos demo-leverantör → bekräfta status `pending`, leverantör får notis.
2. **Leverantör accepterar** — logga in som leverantör, öppna `/provider/bookings` flik "Väntar", acceptera → status `confirmed`, kund får notis/e-post.
3. **Visning** — bekräfta bokningen syns i `/provider/calendar` (grön) och i kundens "Kommande".
4. **Genomför** — leverantör klickar "Markera som genomförd" → status `completed`, kund ser recensionsprompt.
5. **Betalning** — som kund, initiera betalning på `/customer/bookings`:
   - Mock-läge: betalning `succeeded` direkt.
   - Stripe test-mode: kort `4242 4242 4242 4242`, valfritt framtida utgångsdatum/CVC, webhook slutför.
6. **Kvitto** — `GET /api/bookings/[id]/receipt` returnerar HTML-kvitto med `invoiceNumber`.
7. **Båda ser rätt läge** — kund: "Genomförd" + betald; leverantör: "Genomförd". Statustermer på svenska.

### Acceptanskriterier
- [ ] Inga 404/500 i betalningssteget.
- [ ] Inga `console.error` i klient eller server-logg.
- [ ] Status synkas åt båda håll inom SWR-polling-intervall.
- [ ] Kvitto genereras och ägs-kontrolleras korrekt.
- [ ] Ingen riktig betalning genomförd (mock eller test-mode).

---

## Bilaga — Täckning och gap

### Täckning (konkret granskat)
- Boknings-flöde: `BookingStatus.ts`, `BookingService.ts`, `bookings/route.ts`, `bookings/[id]/route.ts`, `PrismaBookingRepository.updateStatusWithAuth`.
- Betalning: `StripePaymentGateway.ts`, `PaymentService`, `webhooks/stripe/route.ts`, `bookings/[id]/payment/route.ts` (läst rad 1-70), `bookings/[id]/receipt/route.ts`, Payment-modell i schema.
- Feature flags: `feature-flag-definitions.ts` (`stripe_payments` rad 113-120, default off bekräftad), `feature-flags.md`.
- Demo: `demo-mode.ts`, `demo-personas.ts`, `seed-demo-provider.ts`.
- Notiser: `BookingEventHandlers.ts`, `email/notifications.ts`, `NotificationService.ts`, `PushDeliveryService.ts`.
- Drift: `git log origin/main..origin/staging` (94) och omvänt (10).

### Gap (ej verifierat i denna audit)
- **B1 — staging Vercel-env för Stripe** (kräver Vercel-åtkomst; read-only-audit kan inte nå det). Detta är det enda som hindrar ett definitivt "betalning fungerar på staging".
- Faktisk Stripe-webhook-leverans och signaturverifiering i körande miljö.
- Fortnox-faktureringsflöde (refererat i Payment-modell, ej granskat).
- RLS-policies för bokning/betalning (endast Prisma-lagret granskat).
- Reschedule-, manuell-boknings- och gruppboknings-flöden (utanför kärn-E2E-slicen).
- Receipt-PDF-rendering i detalj (route finns, full HTML/PDF-utdata ej körd).

---

**Slutsats:** Boknings-/statuskedjan är E2E-redo på staging idag. Betalningssteget är kodmässigt klart men miljö-overifierat — kör Slice 1 (B1/B2-koll, välj mock-gateway) innan den fullständiga E2E-demon. Prod-synk (94 commits) är ett separat spår, inte en blocker för staging-demo.
