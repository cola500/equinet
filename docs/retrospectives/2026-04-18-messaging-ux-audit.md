---
title: "S36-2 Messaging UX Audit"
description: "Visuell verifiering och UX-granskning av S35 messaging-flöde"
category: retro
status: active
last_updated: 2026-04-18
sections:
  - Sammanfattning
  - Testmiljö
  - Granskade vyer
  - Findings
  - Inline-fixar
  - Backlog-findings
  - Push-verifiering
  - Flagg-rollout
---

# S36-2 Messaging UX Audit

## Sammanfattning

Audit av alla messaging-vyer implementerade i S35. Genomförd med Playwright MCP i lokal dev-miljö med `FEATURE_MESSAGING=true`. cx-ux-reviewer kördes på nyckelkomponenter. Resulterade i 2 blockers (båda fixade inline), 5 majors (3 fixade inline, 2 i backlog), 7 minors (3 fixade inline, 4 i backlog) och 3 suggestions i backlog.

**Beslut om flag-rollout:** Flaggan är redo att sättas till `default: true` när backlog-majorsen är åtgärdade. Idag: `default: false`, tillgänglig via admin toggle.

## Testmiljö

- Dev-server: `http://localhost:3001` med `FEATURE_MESSAGING=true`
- Testdata: Leverantör `provider@equinet.se` / kund `customer@equinet.se`
- Datum: 2026-04-18
- Verktyg: Playwright MCP + manuell inspektion

## Granskade vyer

| Vy | Fil | Granskad |
|----|-----|---------|
| Leverantörs-inkorg (tom) | `src/app/provider/messages/page.tsx` | ✓ |
| Leverantörs-inkorg (med oläst) | `src/app/provider/messages/page.tsx` | ✓ |
| Leverantörs-tråd | `src/app/provider/messages/[bookingId]/page.tsx` | ✓ |
| Kund-bokningslista (Alla-flik) | `src/app/customer/bookings/page.tsx` | ✓ |
| Kund-MessagingDialog (tom) | `src/components/customer/bookings/MessagingDialog.tsx` | ✓ |
| Kund-MessagingDialog (med meddelanden) | `src/components/customer/bookings/MessagingDialog.tsx` | ✓ |
| BottomTabBar-badge (mobil) | `src/components/layout/ProviderNav.tsx` | ✓ |

## Findings

### BLOCKER-1 (FIXAD) — VoiceTextarea saknad i provider-tråd

**Fil:** `src/app/provider/messages/[bookingId]/page.tsx`
**Problem:** `Textarea` användes istället för `VoiceTextarea` — bryter mot projektregeln att VoiceTextarea ska användas överallt där leverantörer skriver fritext.
**Fix:** Bytte import + `onChange`-signatur.

### BLOCKER-2 (FIXAD) — Saknad loading-indikator

**Fil:** `MessagingDialog.tsx`, `[bookingId]/page.tsx`
**Problem:** `isLoading`-state användes inte — tom tråd visades under initial data-fetch, vilket är missvisande.
**Fix:** Lade till `isLoading`-guard med "Laddar meddelanden..."-text.

### MAJOR-3 (FIXAD) — Röd unread-badge i inkorg

**Fil:** `src/app/provider/messages/page.tsx`
**Problem:** `variant="destructive"` (röd) på badge skapar falsk urgency — röd färg konnoterar fel/varning, inte "oläst".
**Fix:** Bytte till `bg-green-600 text-white` för neutral informationsbadge.

### MAJOR-5 (FIXAD) — Saknad useRef-guard för read-marking i MessagingDialog

**Fil:** `src/components/customer/bookings/MessagingDialog.tsx`
**Problem:** Read-marking kallade PATCH-endpoint vid varje SWR-revalidering (var 10:e sekund), inte bara vid första laddningen. ThreadView hade detta rätt (`readCalledRef`), men MessagingDialog saknade det.
**Fix:** Lade till `readCalledRef`, nollställs vid dialog-stängning.

### MAJOR-1 (BACKLOG) — Suspense `fallback={null}` ger blank flash

**Fil:** `src/app/provider/messages/[bookingId]/page.tsx:197`
**Problem:** `<Suspense fallback={null}>` ger blank vy medan `useSearchParams()` löser upp. Bör ha en skeleton-komponent.
**Förslag:** `<Suspense fallback={<ThreadSkeleton />}>` med en enkel skeleton.

### MAJOR-2 (BACKLOG) — `useSearchParams` query-param injection risk

**Fil:** `src/app/provider/messages/[bookingId]/page.tsx:32`
**Problem:** `customerName` och `serviceName` läses från query-params och renderas direkt. Bör saniteras eller hämtas från API för säkerhet.
**Förslag:** Hämta från `/api/bookings/{bookingId}` istället för query-param för kundnamn och tjänst.

### MINOR-1 (FIXAD) — Saknad aria-live i MessagingDialog

**Fil:** `src/components/customer/bookings/MessagingDialog.tsx`
**Fix:** Lade till `aria-live="polite"` och `aria-label="Meddelandetråd"` på meddelandelistan.

### MINOR-6 (FIXAD) — Saknad autoFocus i MessagingDialog

**Fil:** `src/components/customer/bookings/MessagingDialog.tsx`
**Fix:** Lade till `autoFocus` på Textarea.

### MINOR-X (FIXAD) — Char-räknare alltid synlig i MessagingDialog

**Fil:** `src/components/customer/bookings/MessagingDialog.tsx`
**Problem:** `{content.length}/2000` visades alltid, vilket skapar visuell störning vid tom textarea.
**Fix:** Döljer räknaren tills 1800 tecken (samma pattern som ThreadView).

### MINOR-2 (BACKLOG) — Tooltip saknas på ProviderNav messaging-badge

**Fil:** `src/components/layout/ProviderNav.tsx`
**Problem:** Badge-siffran saknar `title`/`aria-label` — skärmläsare förstår inte vad "3" betyder.

### MINOR-3 (BACKLOG) — Ingen optimistisk uppdatering vid skicka

**Problem:** Meddelandet visas inte omedelbart vid "Skicka" — 200ms fördröjning (mutatens nätverksrop). Ökar upplevd latens.

### MINOR-4 (BACKLOG) — MessagingSection-knapp saknar pending-state

**Fil:** `src/components/customer/bookings/MessagingSection.tsx`
**Problem:** Knappen saknar visuell feedback vid klick innan dialogen öppnas.

### SUGGESTION-1 (BACKLOG) — Pagination för långa trådar

Trådar utan cursor-paginering kan bli tunga. Implementera lazy-loading när tråd > 50 meddelanden.

### SUGGESTION-2 (BACKLOG) — Leverantörs-läskvitto

Kunden ser inte om leverantören har läst meddelandet. Enkla read-receipts ("Läst kl. 14:23") ger förtroende.

### SUGGESTION-3 (BACKLOG) — Typing indicator

Real-time "skriver..." via polling eller SSE. Post-MVP.

## Push-verifiering

**Trigger verifierad:** `POST /api/bookings/{id}/messages 201` + `INSERT INTO Notification` observerades i dev-loggar när kund skickade meddelande.

**Push-delivery i dev:** Ej möjlig att testa — ingen registrerad device-token i dev-miljö. `PushDeliveryService` körde men hittade inga tokens (förväntat beteende).

**Deep-link:** `deepLink`-parameter skickas korrekt till `PushDeliveryService` med URL `/provider/messages/{bookingId}`.

**Gap:** Push-delivery kan inte e2e-verifieras utan registrerad device. Täcks av befintliga unit-tester för `MessageNotifier`.

## Inline-fixar (committade i S36-2)

| Fix | Fil |
|-----|-----|
| VoiceTextarea i provider thread | `src/app/provider/messages/[bookingId]/page.tsx` |
| Loading-indikator i provider thread | `src/app/provider/messages/[bookingId]/page.tsx` |
| Loading-indikator i MessagingDialog | `src/components/customer/bookings/MessagingDialog.tsx` |
| Grön badge (ej röd) i inkorg | `src/app/provider/messages/page.tsx` |
| useRef-guard för read-marking i MessagingDialog | `src/components/customer/bookings/MessagingDialog.tsx` |
| aria-live + aria-label på meddelandelistan | `src/components/customer/bookings/MessagingDialog.tsx` |
| autoFocus på Textarea i MessagingDialog | `src/components/customer/bookings/MessagingDialog.tsx` |
| Dölj char-räknare under 1800 tecken | `src/components/customer/bookings/MessagingDialog.tsx` |

## Backlog-findings

Lägg till i nästa sprint-backlog:

- MAJOR-1: Suspense skeleton i ThreadView
- MAJOR-2: Hämta kundnamn/tjänst från API istället för query-params
- MINOR-2: aria-label på ProviderNav messaging-badge
- MINOR-3: Optimistisk uppdatering vid meddelande-sändning
- MINOR-4: Pending-state på MessagingSection-knapp
- SUGGESTION-1: Pagination för långa trådar
- SUGGESTION-2: Läskvitton
- SUGGESTION-3: Typing indicator

## Flagg-rollout

**Nuläge:** `messaging: false` (default off)

**Klar för rollout när:**
- [ ] MAJOR-1 (Suspense skeleton) åtgärdad
- [ ] MAJOR-2 (query-param injection) åtgärdad

**Kan slås på utan att vänta:** Alla inline-fixar är klara. Nätverkslagret, auth och RLS är verifierat (S35). Återstående majors är UX-förbättringar, inte funktionsfel.

**Rekommendation:** Åtgärda MAJOR-1 + MAJOR-2 i nästa sprint → sätt `default: true`.
