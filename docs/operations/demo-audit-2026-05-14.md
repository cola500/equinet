---
title: Demo Capability Audit — Leverantörsvyn i Staging
description: Read-only audit av demo-mode för leverantörsvyn (Erik Järnfot) i staging-miljön. Kartlägger synliga/dolda funktioner, risker vid bredare exponering, och föreslagna åtgärder.
category: operations
status: active
last_updated: 2026-05-14
tags:
  - demo
  - staging
  - audit
  - risk
related:
  - demo-setup.md
  - demo-parity-local-staging.md
  - demo-readiness-next-steps.md
  - preview-demo-verification.md
sections:
  - Sammanfattning (TL;DR)
  - Feature-inventory + status
  - Demo-overrides
  - Risk-matris
  - Quick wins (kan exponeras tryggt)
  - Demo confidence matrix
  - Rekommendationer
  - Vad jag inte verifierade
---

# Demo Capability Audit — Leverantörsvyn i Staging

**Miljö:** `equinet-staging.johanlindengard.com`
**Persona:** Erik Järnfot (`erik.jarnfot@demo.equinet.se`)
**Datum:** 2026-05-14
**Metod:** Kod-analys (3 Explore-agenter) + browser-verifiering via Playwright MCP
**Read-only.** Inga ändringar, commits, push, deploy eller env-skrivningar.

## Sammanfattning (TL;DR)

Demo-läget fungerar för **navigation och översikt** — användaren kan tryggt browsa alla synliga vyer utan att krascha. **Men `isDemoMode()` är bara UI-skydd, inte API-skydd.** Tre saker bör åtgärdas innan bredare exponering:

1. **Email/notifier triggas vid actions** (booking-accept, booking-series) — ingen demo-guard. Seedade kunder har riktigt-klingande emails (yahoo/gmail/hotmail).
2. **AI-anrop kostar pengar** (Customer Insights ~0.05 USD, Voice-Log via direkt-URL) — ingen per-user rate-limit.
3. **Flera dolda sidor laddar via direkt-URL** (voice-log, route-planning, announcements, due-for-service, group-bookings) — bara nav-filtrering, ingen redirect-gate.

---

## Feature-inventory + status

### Verifierat i staging (synliga + fungerande)

| Funktion | Route | Status | Anteckning |
|---|---|---|---|
| Översikt | /provider/dashboard | **VERIFIED** | 2 förfrågningar, 5 tjänster, 3 kommande. Onboarding-tutorial visas. |
| Kalender | /provider/calendar | **VERIFIED** | Vecka 20, tillgänglighet visas. Inga errors. |
| Bokningar | /provider/bookings | **VERIFIED** | 18 totalt (2/6/10/0/2 per status). Acceptera/Avvisa/Avboka. |
| Kunder | /provider/customers | **VERIFIED** | 8 kunder, hästar, anteckningar. |
| AI-kundinsikter | (inline, kunder) | **VERIFIED** | POST 200, genererat Claude-innehåll om Lisa Andersson. |
| Tjänster | /provider/services | **VERIFIED** | 5 aktiva tjänster. |
| Meddelanden | /provider/messages | **VERIFIED** | 1 konversation (Anders Bergman). |
| Insikter | /provider/insights | **VERIFIED** | 11 300 kr intäkt, charts, retention, tidvärme. |
| Profil | /provider/profile | **VERIFIED** | 3 tabs, 90% komplett. |
| Inställningar | (profil-tab) | **VERIFIED** | Ta emot nya kunder + återkommande bokningar. |
| Hjälp | /provider/help | **VERIFIED** | 31 artiklar inkl. "Demo-guide — Erik Järnfot". |
| Tillgänglighet | (profil-tab) | WORKS BUT UNTESTED | Kalender visar rätt tider, så data finns. |

### Dolda från nav men sidan laddar via direkt-URL

| Funktion | Route | Status | Risk |
|---|---|---|---|
| Logga arbete (Voice-Log) | /provider/voice-log | **HIGH RISK** | Sidan laddar. AI-tolkning kan triggas. |
| Rutt-annonser | /provider/announcements | **HIGH RISK** | Sidan laddar. POST = broadcast till followers. |
| Ruttplanering | /provider/route-planning | MEDIUM | Sidan laddar. Tom data. |
| Besöksplanering | /provider/due-for-service | **LOW** | Sidan laddar. 8 hästar med försenade besök. Read-only. |
| Gruppbokningar | /provider/group-bookings | LOW | Sidan laddar. Tom lista. |

### Skyddade med redirect (korrekt)

| Funktion | Route | Beteende |
|---|---|---|
| Recensioner | /provider/reviews | Redirect → profil ✅ |
| Export data | /provider/export | Redirect → profil ✅ |
| Integrationer (Fortnox) | /provider/settings/integrations | Redirect → profil ✅ |

### Inte testat (skulle utlöst side-effects)

Acceptera/Avvisa pending booking, Avboka, Markera genomförd, Lägg till anteckning, skapa-bokning-flödet, edit-tjänst, edit-kund, delete-kund, skicka meddelande.

---

## Demo-overrides

### Aktiva mekanismer

- UI-strippning i `ProviderNav.tsx`/`Header.tsx` (9 tabs istället för 19, döljer NotificationBell, Admin, Stallprofil)
- Redirect-skydd i sidornas page.tsx via `isDemoModeWithFlags()` (reviews, export, integrations, verification, routes, debug)
- Subscription-kort (Stripe), Self-reschedule och Delete-account dolda i profil
- Seed-data via `scripts/seed-demo-provider.ts` (idempotent)

### Brister

| Brist | Konsekvens |
|---|---|
| Sidor utan `isDemoModeWithFlags()` laddar via direkt-URL | voice-log, announcements, route-planning, due-for-service, group-bookings exponeras |
| API-routes är aldrig demo-gatade | Alla side-effects (email, AI, delete, broadcast) kan triggas |
| Hjälpartiklar filtreras inte | Användaren ser instruktioner för dolda funktioner — förvirrande |
| Riktigt-klingande emails i seed | Om mail triggas går de till verkliga MX-records |
| Onboarding-tutorial visas | Stör demo-känslan |
| Konsolfel: 401 från legacy `/api/auth/session` | Påverkar inte funktion men ska bort |

---

## Risk-matris

| Action | Risk | Hotvektor |
|---|---|---|
| Accept pending booking | **HIGH** | `sendBookingConfirmationNotification()` → mail till sara.magnusson@icloud.com m.fl. |
| Avboka booking | **HIGH** | Mail till kund. |
| Skapa rutt-annons | **HIGH** | `RouteAnnouncementNotifier` broadcastar till followers. |
| Delete kund | **HIGH** | Hard-delete av providerCustomer + ev. user-record. |
| Voice-log POST | **HIGH** | LLM-anrop, kostnad + AI-skrivning till booking. |
| AI Customer Insights | MEDIUM | LLM ~0.05 USD/klick. Ingen per-user rate-limit. |
| Stripe checkout direktlänk | MEDIUM-HIGH | Subscription-UI dolt men route kvar. Inte verifierat. |
| Skapa BookingSeries | MEDIUM | 2-52 bokningar i DB + mail. |
| Upload avatar/horse-img | LOW | Ownership-validerad. |

---

## Quick wins (kan exponeras tryggt)

1. **Besöksplanering** (`/provider/due-for-service`) — read-only, 8 hästar med försenade besök = konkret problem som löses. Lägg till i Mer-menyn.
2. **Demo-guide-artikel** finns redan i hjälp — framhäv på dashboard som "Börja här".
3. Edit-tjänst och Lägg-till-kund-formulär bör fungera bra (inte verifierat men inga obvious risker).

---

## Demo confidence matrix

| Funktion | Synlig | Testad | Risk | Demo-ready |
|---|---|---|---|---|
| Dashboard, Kalender (browse), Bokningslista, Kunder, Tjänster, Meddelanden, Insikter, Profil, Inställningar, Hjälp | ✅ | ✅ | Låg | **JA** |
| AI-kundinsikter | ✅ | ✅ | Medium ($) | **JA** + budget-cap |
| Accept/Avboka booking | ✅ | ❌ | **HIGH** mail | **NEJ** tills mail-guard |
| Delete kund | ✅ (i redigera) | ❌ | **HIGH** | **NEJ** tills demo-guard |
| Voice-log (direkt) | ❌ dold | ✅ laddar | **HIGH** $$ | **NEJ** — gate sidan |
| Rutt-annons (direkt) | ❌ dold | ✅ laddar | **HIGH** broadcast | **NEJ** — gate sidan |
| Besöksplanering, Gruppbokning (direkt) | ❌ dold | ✅ laddar | Låg | **Kan exponeras** |
| Reviews/Export/Integrations | ❌ dold | ✅ redirect | — | Korrekt skydd |

---

## Rekommendationer

### Tryggt att låta användaren testa nu

- Browsa alla 9 synliga vyer (allt fungerar)
- AI-kundinsikter på kund-kort
- Insikter-vyn (bra "wow"-värde med riktiga siffror)
- Hjälp-artiklarna

### Bör undvika att nämna eller låta klickas

- Acceptera/Avvisa pending booking (mail-risk)
- Voice-log direktlänk
- Delete kund (i redigera-modal)
- Skapa rutt-annons direktlänk

### Föreslagna slices innan bredare demo (prioritet)

1. **`demo_email_blocker`** — i `notifications.ts`, om `isDemoMode()` → no-op + log istället för att skicka. (~30 min, HIGH-värde)
2. **Redirect-gate på voice-log/announcements/route-planning** — `isDemoModeWithFlags()` + redirect i deras `page.tsx`. (~15 min)
3. **`demo_delete_blocker`** — DELETE `/api/native/customers/[id]` returnerar 403 i demo. (~20 min)
4. **AI-budget-cap** — Redis-counter per Erik Järnfot för insights+voice-log. (~1 tim)
5. **Filtrera hjälpartiklar i demo** — ta bort rutt-planering, rutt-annonser, röstloggning, recensioner, fortnox, kompetenser från `HelpCenter.tsx`. (~20 min)
6. **Dölj onboarding-tutorial i demo** — `dismissed: true` i seed. (~10 min)

### Mest demo-värde med minst risk

- **Exponera Besöksplanering** i Mer-menyn (LOW risk, konkret value-prop)
- **Lägg en "demo-tour"-knapp** på dashboard som länkar till de 4 starkaste vyerna: Kalender → AI-insikter → Insikter → Hjälp

---

## Vad jag inte verifierade

- Faktiskt mail-utskick (avstod för att inte spamma adresser)
- Stripe checkout direktlänk
- iOS-app i demo-läge (utanför scope)
- Offline-läge / Service Worker
- Vad som händer med seed-data efter att demo-user ändrat den

---

**Slut på audit. Inga kodändringar gjorda. Inga commits, push, deploy eller env-skrivningar.**
