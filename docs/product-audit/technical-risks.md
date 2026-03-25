---
title: Technical Risks
description: Tekniska risker som påverkar demo och MVP-readiness
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Sammanfattning
  - Kritiska risker
  - Medelhöga risker
  - Laga risker
  - Åtgärdsmatris
---

# Technical Risks -- Equinet

> Risker som påverkar möjligheten att demonstrera eller lansera Equinet.
> Bedömda per 2026-03-25 baserat på kodinventering. INTE verifierade genom korning.

---

## Sammanfattning

| Kategori | Kritisk | Medel | Låg |
|----------|---------|-------|-----|
| Auth & Session | 1 | 1 | 0 |
| Data & Seed | 2 | 1 | 0 |
| Externa beroenden | 2 | 2 | 0 |
| UI & Tomma states | 1 | 2 | 1 |
| Feature flags & Halvfärdiga features | 0 | 3 | 1 |
| Säkerhet | 0 | 2 | 1 |
| Deploy & Infrastruktur | 1 | 2 | 0 |
| **Totalt** | **7** | **13** | **3** |

---

## Kritiska risker (måste adresseras före demo/MVP)

### R1: Ingen verifierad manuell genomkorning
- **Beskrivning**: Alla 47 features är inventerade från kod men INGEN är verifierad genom att faktiskt kora applikationen. Unit-tester täcker affärslogik men inte UI-flöden end-to-end.
- **Paverkan**: Dolda buggar i UI, trasiga dialoger, felaktig navigering kan dyka upp i demo.
- **Åtgärd**: Manuell genomkorning av de 3 rekommenderade demo-flödena. Budget: 4-6 timmar.
- **Prioritet**: **P0**

### R2: Seed-data saknas eller är otillracklig
- **Beskrivning**: Befintliga seed-skript (`prisma/seed.ts`) skapar generiska test-leverantörer. För en trovärdig demo krävs realistisk data med svenska namn, riktiga tjänster, bokningshistorik, recensioner.
- **Paverkan**: Tomma listor, ingen statistik på dashboard, inga recensioner att visa.
- **Åtgärd**: Skapa `prisma/seed-demo.ts` med realistisk data. Budget: 2-4 timmar.
- **Prioritet**: **P0**

### R3: Email-leverans ej konfigurerad/verifierad
- **Beskrivning**: Registrering kräver email-verifiering. SMTP-konfiguration (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`) måste finnas. Oklart om email levereras i produktion.
- **Paverkan**: Nya användare kan inte slutföra registrering. Demo av registreringsflöde misslyckas.
- **Åtgärd**: Konfigurera SMTP (t.ex. Resend, SendGrid). ELLER: skippa email-verifiering för demo-konton.
- **Prioritet**: **P0** (för registrerings-demo), **P1** (om bara förberedd data)

### R4: Mapbox-beroende för leverantörssok
- **Beskrivning**: `/providers` (leverantörssök) använder Mapbox för geocoding och avståndsberäkning. Utan `MAPBOX_ACCESS_TOKEN` fungerar inte sökning, kartrendering eller avståndsfiltrering.
- **Paverkan**: Centralt kundflöde (hitta leverantör) är brutet.
- **Åtgärd**: Konfigurera Mapbox-token (gratisplan räcker för demo). ELLER: visa förberedd leverantörslista.
- **Prioritet**: **P0** (om kundflödet ska visas)

### R5: Oklart om produktion-deploy är aktuell
- **Beskrivning**: Equinet är deployat på Vercel (`equinet.vercel.app`) men oklart om senaste koden är deployad. `vercel.json` har `regions: ["fra1"]` och `ignoreBuildErrors: true`.
- **Paverkan**: Demo på prod-URL kan visa gammal/trasig version. Lokalt kan det se annorlunda ut.
- **Åtgärd**: Verifiera senaste deploy. Kor `vercel deploy` efter manuell genomkorning.
- **Prioritet**: **P0**

### R6: Databas-migration måste matcha
- **Beskrivning**: Schema har 35+ modeller. Prisma-migrationer måste vara applicerade på måldatabasen. Historik visar att saknade migrationer ger 500-fel.
- **Paverkan**: API-anrop failar med 500 om schema och databas inte matchar.
- **Åtgärd**: Kor `npm run migrate:status` och `npm run migrate:check` före deploy.
- **Prioritet**: **P0**

### R7: `.env.local` trumfar `.env`
- **Beskrivning**: Vercel CLI skapade `.env.local` med Supabase-credentials. Next.js prioriterar `.env.local` över `.env`. Om `.env.local` pekar på fel databas är allt fel.
- **Paverkan**: Tester kor mot prod-databas eller vice versa. Data försvinner.
- **Åtgärd**: Verifiera vilken databas som är aktiv: `npm run env:status`.
- **Prioritet**: **P0**

---

## Medelhöga risker

### R8: Tomma states i UI
- **Beskrivning**: Många sidor (dashboard, bokningar, kunder, hästar) visar listor. Utan data visas tomma sidor. Oklart om alla sidor har vanliga "tomt"-meddelanden.
- **Paverkan**: Demo ser ofärdigt ut. Användare förstår inte vad de ska gora.
- **Åtgärd**: Granska alla list-sidor för empty state-hantering. Budget: 2-3 timmar.
- **Prioritet**: **P1**

### R9: Halvfärdiga features som är ON
- **Beskrivning**: Flera feature-fläggade features är ON som default men oklart hur val de fungerar:
  - `customer_insights` -- kräver AI-tjänst?
  - `offline_mode` -- komplex, ingen E2E-test
  - `route_planning` -- kräver OSRM + Mapbox
  - `route_announcements` -- beror på route_planning
- **Paverkan**: Användare navigerar till halvfärdiga sidor som kraschar eller visar konstiga saker.
- **Åtgärd**: Stäng av fläggör för features som inte är demo-klara. ELLER: dolj nav-länkar.
- **Prioritet**: **P1**

### R10: Stripe i mock-läge
- **Beskrivning**: Payment.provider defaultar till `'mock'`. Betalningsflöde fungerar tekniskt men visar "mock"-data. Ingen riktig betalning sker.
- **Paverkan**: Betalning är inte trovärdigt i demo. Kvitton kan visa "mock"-information.
- **Åtgärd**: För demo: undvik betalningsflöde. För MVP: konfigurera Stripe.
- **Prioritet**: **P1**

### R11: In-memory state på Vercel
- **Beskrivning**: Flera cacher (provider-cache, customer-insights-cache) är in-memory. På Vercel överlever de inte mellan requests (serverless).
- **Paverkan**: Cache-missar ger långsammare svar men inget kritiskt fel. Feature flag-cache har 30s TTL via Redis.
- **Åtgärd**: För demo: inget. För MVP: migrera kritiska cacher till Redis.
- **Prioritet**: **P1**

### R12: Rate limiter beroende på Redis
- **Beskrivning**: Rate limiting använder Upstash Redis. Fail-closed: om Redis är nere returneras 503.
- **Paverkan**: Om Upstash är nere -> alla API-anrop returnerar 503.
- **Åtgärd**: Verifiera att `UPSTASH_REDIS_REST_URL` och `UPSTASH_REDIS_REST_TOKEN` är konfigurerade.
- **Prioritet**: **P1**

### R13: Responsiv design ej verifierad
- **Beskrivning**: Applikationen har `useIsMobile()`-hook för mobil/desktop. Oklart om alla sidor är responsiva.
- **Paverkan**: Demo på laptop kan visa trasig layout på vissa sidor.
- **Åtgärd**: Testa alla demo-sidor på desktop-upplösning.
- **Prioritet**: **P1**

### R14: Dev-banners och debug-verktyg
- **Beskrivning**: `DevBanner`-komponent, `BugReportFab`, debug-sida (`/provider/debug`). Kan visas i produktion.
- **Paverkan**: Ser oprofessionellt ut i demo.
- **Åtgärd**: Verifiera att DevBanner är villkorad på NODE_ENV. Dolj BugReportFab för demo?
- **Prioritet**: **P2**

### R15: Blob storage för bilder
- **Beskrivning**: Profilbilder, hästfoton använder `/api/upload` som skriver till blob storage. Oklart om Vercel Blob är konfigurerad.
- **Paverkan**: Uppladdning misslyckas, bilder visas inte.
- **Åtgärd**: Verifiera `BLOB_READ_WRITE_TOKEN` eller liknande env-var.
- **Prioritet**: **P1**

### R16: Fortnox/extern-integrations-statusvy
- **Beskrivning**: `src/app/provider/settings/integrations/` visar integrationsstatus. Fortnox-koppling kräver OAuth-flöde.
- **Paverkan**: Sidan visar "ej kopplad" för alla integrationer.
- **Åtgärd**: För demo: undvik sidan. För MVP: konfigurer integrationer.
- **Prioritet**: **P2**

### R17: `ignoreBuildErrors: true` i next.config.ts
- **Beskrivning**: TypeScript-fel blockerar INTE byggen. Medvetet val (dokumenterat i CLAUDE.md) men innebär att trasig kod kan deployas.
- **Paverkan**: Dolda runtime-fel i produktion.
- **Åtgärd**: Kor `npm run typecheck` manuellt före deploy.
- **Prioritet**: **P1**

### R18: Cron-jobb för påminnelser
- **Beskrivning**: `cron/booking-reminders` och `cron/send-reminders` kors via Vercel Cron. Kräver `CRON_SECRET` för verifiering.
- **Paverkan**: Om inte konfigurerat skickas inga bokningspåminnelser.
- **Åtgärd**: Verifiera `vercel.json` cron-konfiguration + CRON_SECRET env-var.
- **Prioritet**: **P2**

### R19: GDPR/dataskydd
- **Beskrivning**: GDPR-export (`/api/export/my-data`) och kontoborttagning (`/api/account` DELETE) finns. Oklart om de täcker all data korrekt.
- **Paverkan**: Legal risk vid lansering. Inte relevant för demo.
- **Åtgärd**: Granska att cascading delete när all data. Testa export.
- **Prioritet**: **P2** (för MVP, ej demo)

### R20: Dual auth-system (session + JWT)
- **Beskrivning**: Webbsidor använder NextAuth session-cookie. iOS native använder Bearer JWT. De är helt oberoende.
- **Paverkan**: Om en auth-mekanism är trasig kan webben fungera men inte appen (eller vice versa).
- **Åtgärd**: För demo: testa både webb och iOS inloggning. För MVP: verifiera token-rotation.
- **Prioritet**: **P1**

---

## Laga risker

### R21: Svenska tecken i felmeddelanden
- **Beskrivning**: Alla felmeddelanden ska vara på svenska (standardiserat session 106). 87 routes uppdaterade.
- **Paverkan**: Låg -- konsistent UI men inget funktionellt problem.
- **Prioritet**: **P3**

### R22: E2E-tester 373 pass / 77 skip
- **Beskrivning**: 77 E2E-tester är skippade. Dessa kan indikera features som inte fungerar korrekt.
- **Paverkan**: Oklart -- skippade tester kan vara medvetna (features under utveckling) eller dolda problem.
- **Åtgärd**: Granska skippade tester för att identifiera ej fungerande features.
- **Prioritet**: **P2**

### R23: iOS-appen och WKWebView
- **Beskrivning**: iOS-appen är hybrid (native + WebView). WebView-sidor beror på att webbapplikationen fungerar korrekt. CSS-injektion döljer webbens nav-element.
- **Paverkan**: Om webb-UI ändras kan iOS-appen visa dubbla headers/navbars.
- **Åtgärd**: För demo: testa iOS-appen separat. För MVP: E2E för iOS-kritiska sidor.
- **Prioritet**: **P2**

---

## Åtgärdsmatris

### Före demo (P0)

| # | Åtgärd | Tid | Risker som adresseras |
|---|--------|-----|----------------------|
| 1 | Kor `npm run env:status` + `npm run migrate:status` | 10 min | R6, R7 |
| 2 | Skapa demo-seed-data | 2-4 h | R2 |
| 3 | Manuell genomkorning av 3 demo-flöden | 3-4 h | R1 |
| 4 | Konfigurera Mapbox-token (om kundflödet) | 30 min | R4 |
| 5 | Verifiera/fixa inloggning | 30 min | R3 |
| 6 | Deploy till Vercel | 30 min | R5 |
| **Summa** | | **7-10 h** | |

### Före MVP (P1)

| # | Åtgärd | Tid | Risker som adresseras |
|---|--------|-----|----------------------|
| 7 | Granska tomma states i alla sidor | 2-3 h | R8 |
| 8 | Stäng av halvfärdiga features | 1 h | R9 |
| 9 | Konfigurera Stripe (testläge) | 2-3 h | R10 |
| 10 | Verifiera Upstash Redis-anslutning | 30 min | R12 |
| 11 | Verifiera responsiv design | 2-3 h | R13 |
| 12 | Konfigurera blob storage | 1 h | R15 |
| 13 | Kor `npm run typecheck` + fixa fel | 1-2 h | R17 |
| **Summa** | | **10-14 h** | |

---

## Stopp-ljus-bedömning

| Omrade | Status | Kommentar |
|--------|--------|----------|
| Auth & Login | GULT | Kod ser robust ut men ej verifierad i prod |
| Leverantörsflöde | GRÖNT | Mest komplett, lägst risk |
| Kundflödet | GULT | Mapbox-beroende, sek-beroende |
| Betalning | RÖTT | Mock-only utan Stripe-config |
| Ruttplanering | RÖTT | Mapbox + OSRM-beroende |
| Stallhantering | RÖTT | Feature OFF, minimal testning |
| Admin | GRÖNT | Enkel CRUD, fungerar troligen |
| iOS-app | GULT | Hybridmodell, WebView-beroende |
| Säkerhet | GRÖNT | Bra patterns: auth, rate limit, Zod, IDOR-skydd |
| Prestanda | GULT | In-memory cache på serverless, ej lasttestad |
