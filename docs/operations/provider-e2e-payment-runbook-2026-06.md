---
title: Provider E2E Value Flow — Playwright Runbook (Slice 3)
description: Playwright-first runbook för att köra hela leverantörs-värdeflödet på staging (Lisa bokar → Erik accepterar → genomför → Lisa betalar med mock → kvitto/status). Automatiserad körning som primär metod, manuell checklista som fallback.
category: operations
status: draft
last_updated: 2026-06-06
tags: [e2e, playwright, payment, staging, demo, runbook]
depends_on:
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
  - docs/operations/deployment-verification-guide.md
related:
  - docs/operations/provider-e2e-payment-readiness-2026-06.md
sections:
  - 1. Syfte
  - 2. Förutsättningar
  - 3. Personor
  - 4. Playwright automation mode
  - 5. Automatiserad flow (steg-för-steg)
  - 6. Stabilitet och selektorer
  - 7. Vad som ska observeras
  - 8. Acceptanskriterier
  - 9. Abort-kriterier
  - 10. Output och resultatmapp
  - 11. Manuell fallback-checklista
  - 12. Resultatmall
---

# Provider E2E Value Flow — Playwright Runbook (Slice 3)

> **Status:** Förberedd, **ej körd**. Detta dokument beskriver HUR Slice 3 körs — det utför inget.
> **Primär metod:** Playwright (automatiserad, av Claude). **Fallback:** manuell checklista (sektion 11).
> **Föregångare:** [provider-e2e-payment-readiness-2026-06.md](provider-e2e-payment-readiness-2026-06.md) (Slice 1+2 klara: staging i mock-läge, `stripe_payments=true`).

---

## 1. Syfte

Bevisa hela leverantörs-värdeflödet end-to-end på staging:

```
Lisa (kund) bokar → Erik (leverantör) accepterar → Erik genomför
→ Lisa betalar (mock-gateway) → kvitto/invoiceNumber → status korrekt hos BÅDA
```

Inga riktiga betalningar. Mock-gateway ger instant `succeeded` utan Stripe-anrop.

---

## 2. Förutsättningar

Verifiera ALLA innan körning (gate — kör inte om någon fallerar):

| # | Förutsättning | Hur det verifieras | Förväntat |
|---|---------------|--------------------|-----------|
| F1 | Rätt miljö (staging, ej prod) | `location.host` | `equinet-staging.johanlindengard.com` |
| F2 | Mock-gateway aktiv | readiness-doc 2b + `PAYMENT_PROVIDER=mock` | mock (inget webhook, ingen riktig betalning) |
| F3 | `stripe_payments=true` | `GET /api/feature-flags` | `"stripe_payments":true` |
| F4 | `demo_mode=true` | `GET /api/feature-flags` | `"demo_mode":true` |
| F5 | Staging deploy READY | `vercel ls` (senaste Production) | `● Ready` |
| F6 | Lisa loginbar | demo-knapp på `/login`, eller seed kört med `--customer-login` | login lyckas |
| F7 | Erik loginbar | demo-knapp på `/login` | login lyckas |
| F8 | Inga riktiga betalningar möjliga | F2 säkerställer detta | — |

> **Not (staging-specifikt):** `DISABLE_EMAILS=true` och `DISABLE_CRONS=true` på staging. Riktiga mejl skickas INTE — verifiera notiser via in-app-notiser + server-loggar, inte inkorg. Detta är förväntat, inte ett fel.

---

## 3. Personor

Publika demo-credentials (avsiktligt hårdkodade, **inte secrets**). Källa: `src/components/landing/demo-personas.ts` — samma konton som demo-knapparna på `/login` och landningssidan.

| Persona | Roll | E-post | Lösenord | Start efter login |
|---------|------|--------|----------|-------------------|
| **Lisa Andersson** | kund (hästägare) | `lisa.andersson@gmail.com` | `DemoOwner123!` | `/dashboard` → `/hem` |
| **Erik Järnfot** | leverantör (hovslagare) | `erik.jarnfot@demo.equinet.se` | `DemoProvider123!` | `/dashboard` → kalender |

> Dessa är publika demo-konton och får stå i klartext här (samma som redan visas i UI:t). Skriv ALDRIG ut riktiga användar-secrets, tokens eller `STRIPE_*`-värden i output.

---

## 4. Playwright automation mode

- **Verktyg:** Playwright MCP (`mcp__plugin_playwright_playwright__*`).
- **Bas-URL:** `https://equinet-staging.johanlindengard.com` (ALDRIG prod-domänen `equinet.johanlindengard.com`).
- **Inga secrets i output:** logga aldrig lösenord (utöver de publika demo-creds ovan), tokens eller env-värden. Maska allt oväntat.
- **Sessionshantering:**
  - Återanvänd befintlig inloggad browser-kontext om en redan finns för rätt persona (spar tid).
  - Annars: logga in via **demo-knapparna** på `/login` (`getByRole('button', { name: 'Demo som hästägare' })` / `'Demo som leverantör'`) — de auto-loggar in och routar via `/dashboard`.
  - **Personabyte:** logga ut via header-menyn; fallback: rensa cookies + `localStorage` och gå till `/login`. Verifiera att rätt persona är aktiv via `/hem` (kund) vs kalender (leverantör) innan nästa steg.
- **Cookie-consent:** avfärda ev. cookie-notis först (`localStorage['equinet-cookie-notice-dismissed']='true'` via init-script, jfr E2E-fixtures).

---

## 5. Automatiserad flow (steg-för-steg)

Varje steg har: handling, selektor-hint, verifiering, screenshot. Spara `bookingId` så snart den finns.

| Steg | Handling | Selektor / API | Verifiering | Screenshot |
|------|----------|----------------|-------------|------------|
| S0 | Öppna staging, kör F1–F5-gate | `location.host`, `GET /api/feature-flags`, `vercel ls` | alla F-krav gröna | `00-readiness` |
| S1 | Logga in som **Lisa** | demo-knapp `Demo som hästägare` | landar på `/hem`, ingen auth-loop | `01-lisa-hem` |
| S2 | Hitta Erik & öppna bokning | navigera `/providers` → välj "Erik Järnfot" (eller `/providers/<id>`) | provider-profil för Erik visas | `02-erik-profil` |
| S3 | Skapa ny bokning | öppna boknings-dialog ("Boka {tjänst}"), välj tjänst + häst + tid (`data-testid="select-fixed-time"`), submit | success-toast/redirect, ingen 4xx/5xx | `03-bokning-skapad` |
| S4 | Fånga `bookingId` | `GET /api/bookings` (som Lisa) → nyaste mot Erik | status `pending`; spara id | `04-pending-kund` |
| S5 | Verifiera pending (kund) | `/customer/bookings`, `data-testid="booking-item"` | badge "Väntar på bekräftelse" | (ingår i S4) |
| S6 | Byt session → **Erik** | logga ut, demo-knapp `Demo som leverantör` | landar på kalender | `06-erik-kalender` |
| S7 | Öppna väntande bokningar | `/provider/bookings`, flik "Väntar"/pending | bokningen syns som `booking-item` | `07-erik-pending` |
| S8 | **Acceptera** | `getByRole('button', { name: 'Acceptera' })` på rätt `booking-item` | status → `confirmed` | `08-accepterad` |
| S9 | Verifiera confirmed (leverantör) | flik "Bekräftade" | bokningen listad, badge "Bekräftad" | `09-confirmed-provider` |
| S10 | **Markera genomförd** | `getByRole('button', { name: 'Markera som genomförd' })` | status → `completed` | `10-genomford` |
| S11 | Byt session → **Lisa** | logga ut, demo-knapp `Demo som hästägare` | `/hem` | — |
| S12 | Verifiera confirmed→completed (kund) | `/customer/bookings`, `booking-item` | badge "Genomförd" + recensionsprompt | `12-completed-kund` |
| S13 | **Initiera betalning** | `getByRole('button', { name: /Betala/ })` → `PaymentDialog` | dialog öppnas; **observera mock-beteende** (se risk nedan) | `13-betala-dialog` |
| S14 | Verifiera mock `succeeded` | slutför betalning i dialog; `GET /api/bookings/<id>` | `payment.status === "succeeded"`, ingen Stripe-redirect | `14-betald` |
| S15 | Öppna **kvitto** | kund-UI "Kvitto: {invoiceNumber}" / `invoiceUrl`, eller `GET /api/bookings/<id>/receipt` | HTML med "KVITTO" + `invoiceNumber` (ej "N/A") | `15-kvitto` |
| S16 | Slutverifiering båda håll | kund: "Genomförd"+betald; leverantör `/provider/bookings`: "Genomförd" | status matchar hos båda, svenska termer | `16-slut` |

> **Risk att observera vid S13–S14 (mock-läge):** `PaymentDialog` är byggd för Stripe Elements. I mock-läge returnerar `POST /api/bookings/[id]/payment` `succeeded` direkt utan `clientSecret`. Kontrollera om dialogen (a) hoppar över kortinmatning och lyckas direkt, eller (b) försöker rendera Stripe-fält och fastnar. Om (b): notera som fynd — kan kräva en liten mock-anpassning i UI:t (egen slice, ingen fix nu). Detta är en av sakerna körningen ska bevisa.

---

## 6. Stabilitet och selektorer

- **Föredra i ordning:** `data-testid` → `getByRole(name)` → exakt synlig text. Undvik CSS-klasser och pixel-/koordinatberoende.
- **Kända testid:** `booking-item` (kund + leverantörslista), `select-fixed-time` / `select-flexible-time`, `booking-type-section`, `priority-normal`/`priority-urgent`.
- **Kända knapptexter:** `Acceptera`, `Avvisa`, `Markera som genomförd`, `Betala {pris} kr`, demo-knappar `Demo som hästägare` / `Demo som leverantör`.
- **Readiness-gate per steg:** vänta tills inga skeletons/spinners syns innan assertion (t.ex. `await expect(skeleton).toHaveCount(0)` eller vänta på `booking-item`). Använd ALDRIG `networkidle` (SWR-polling resolverar aldrig) — vänta på konkret element/text.
- **Fail loud:** vid fel, kasta med tydligt steg-namn (`STEG S8 (Acceptera): knapp ej funnen`), ta felscreenshot, skriv server/console-fel till resultatmappen, och STOPPA. Ingen tyst retry-loop.
- **Strikta matchningar:** `{ exact: true }` vid tvetydig text; scope:a till rätt `booking-item` via häst-/tjänstenamn så rätt rad träffas.

---

## 7. Vad som ska observeras

- **UI-status:** svenska termer hos båda (Väntar på svar / Bekräftad / Genomförd) — matchar status-maskinen.
- **Notiser:** in-app-notisbadge hos mottagaren vid varje statusändring (leverantör vid ny bokning; kund vid confirmed/completed/betald).
- **E-post:** N/A på staging (`DISABLE_EMAILS=true`) — verifiera i stället via server-loggar att notifier-event dispatchades.
- **API/loggar:** statuskoder på `POST /api/bookings`, `PUT /api/bookings/[id]`, `POST /api/bookings/[id]/payment`, `GET /api/bookings/[id]/receipt`.
- **Console/server errors:** fånga `console` (browser) + ev. Vercel-loggar. Inga `console.error`.
- **Kvitto/invoice:** `invoiceNumber` finns och är inte "N/A"; kvitto-HTML renderar.

---

## 8. Acceptanskriterier

- [ ] Inga 404/500 i något steg (särskilt payment + receipt).
- [ ] Inga riktiga Stripe-anrop / ingen redirect till `checkout.stripe.com` / ingen `pk_live`.
- [ ] Betalning `succeeded` via mock-gateway.
- [ ] Receipt-route returnerar giltig kvitto-HTML med `invoiceNumber`.
- [ ] Status syns korrekt och konsekvent hos BÅDA personor i varje fas.
- [ ] Inga `console.error`/server 500.

---

## 9. Abort-kriterier (automation)

STOPPA omedelbart, ta screenshot, skriv orsak till `result.md`, kör inte vidare om:

- **Fel domän:** `location.host` ≠ `equinet-staging.johanlindengard.com` (särskilt om prod-domänen `equinet.johanlindengard.com` syns).
- **Payment provider inte mock:** `GET /api/feature-flags` saknar förväntat läge, eller betalning beter sig som riktig (clientSecret/hosted checkout).
- **Stripe live/test-UI öppnas:** redirect till `checkout.stripe.com`, `js.stripe.com` med `pk_live`, eller riktigt korformulär som debiterar.
- **404/500 på payment** eller receipt.
- **Okänd auth-loop:** upprepade redirect:ar mellan `/login` och `/dashboard` utan att landa.
- **F-gate fallerar** (sektion 2) innan S1.

---

## 10. Output och resultatmapp

Skapa vid körning (datum/tid i körningens tidszon):

```
docs/operations/e2e-runs/provider-payment-YYYY-MM-DD-HHMM/
├── result.md            # resultatmall (sektion 12) ifylld
├── screenshots/         # 00-readiness ... 16-slut (+ ev. fel-screenshots)
├── console-errors.log   # browser console-fel (tomt = bra)
└── server-errors.log    # ev. Vercel/server-fel (tomt = bra)
```

Spara `bookingId` och `paymentId`/`invoiceNumber` i `result.md`. Mappen skapas i körningen — inte nu.

---

## 11. Manuell fallback-checklista

Använd endast om Playwright-automation inte kan köras. Samma flöde manuellt:

1. Öppna `https://equinet-staging.johanlindengard.com/login`, verifiera F1–F5.
2. Demo-knapp **Demo som hästägare** → landar på `/hem`.
3. Gå till Erik via `/providers` → boka tjänst (tjänst + häst + tid) → bekräfta `pending` i `/customer/bookings`.
4. Logga ut → demo-knapp **Demo som leverantör**.
5. `/provider/bookings` → flik Väntar → **Acceptera** → verifiera Bekräftad.
6. **Markera som genomförd** → verifiera Genomförd.
7. Logga ut → **Demo som hästägare** → `/customer/bookings` → verifiera Genomförd.
8. **Betala {pris} kr** → slutför i dialog → verifiera mock `succeeded`.
9. Öppna **Kvitto** (invoiceNumber) → verifiera.
10. Kontrollera status hos båda + fyll i resultatmallen manuellt.

---

## 12. Resultatmall

Kopiera till `result.md` i körningens mapp:

```markdown
# Provider E2E Payment — Körningsresultat

- **Datum/tid:**
- **Körd av:** (Claude/Playwright | manuell)
- **Miljö:** equinet-staging.johanlindengard.com
- **Payment-läge:** mock (PAYMENT_PROVIDER=mock, stripe_payments=true)
- **bookingId:**
- **paymentId / invoiceNumber:**

## Steg-resultat
| Steg | Pass/Fail | Notering |
|------|-----------|----------|
| S0 readiness | | |
| S1 login Lisa | | |
| S2–S3 skapa bokning | | |
| S4–S5 pending | | |
| S6–S7 login Erik / väntande | | |
| S8–S9 acceptera / confirmed | | |
| S10 genomförd | | |
| S11–S12 login Lisa / completed | | |
| S13–S14 betala / mock succeeded | | |
| S15 kvitto | | |
| S16 status båda håll | | |

## Observationer
- UI-status:
- Notiser:
- PaymentDialog-beteende i mock-läge:
- Console/server errors:

## Acceptanskriterier
- [ ] Inga 404/500
- [ ] Inga riktiga Stripe-anrop
- [ ] Mock succeeded
- [ ] Receipt OK
- [ ] Status korrekt hos båda

## Nästa åtgärd
-
```

---

**Nästa steg:** Kör Slice 3 enligt detta dokument (Playwright primärt). Stoppa vid första abort-kriterium. Ingen körning sker förrän Johan ger klartecken.
