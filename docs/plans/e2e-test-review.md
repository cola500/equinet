---
title: "E2E Test Genomgang & Tackningsanalys"
description: "Kor E2E-tester i batchar, fixa failures, kartlagg tackningsgap"
category: plan
status: active
last_updated: 2026-03-13
sections:
  - Kontext
  - Nulage
  - Batchar
  - Tackningsgap
  - Prioriterade nya specs
  - Verifiering
---

# Plan: E2E Test Genomgang & Tackningsanalys

## Kontext

34 E2E spec-filer, 464 tester (inkl. chromium + mobile), ~76 sidor, ~143 API routes.
Playwright-version uppgraderad -- browsers ominstallerade.
Mal: kartlagga vad som fungerar, fixa det som ar trasigt, identifiera tackningsgap.

## Nulage

### Testinfrastruktur
- **Playwright config**: 2 projects (chromium desktop + Pixel 7 mobile), serial (workers: 1)
- **Setup**: seed-e2e.setup.ts kor fore alla tester
- **Feature flags**: `FEATURE_SELF_RESCHEDULE=true`, `FEATURE_CUSTOMER_INSIGHTS=true`, `FEATURE_OFFLINE_MODE=true`, `FEATURE_FOLLOW_PROVIDER=true`, `FEATURE_DUE_FOR_SERVICE=true` i .env + playwright.config.ts
- **Rate limit reset**: i beforeEach per spec

### Tackningsmetrik
- **34 spec-filer**, **227+ individuella testfall**
- **~76% tackning** av kritiska anvandarfloden
- **100% mobil-tackning** (alla specs kor pa Pixel 7)

## Batchar

### Batch 1: Infrastruktur (KLAR -- 92 pass, 26 skip, 0 fail)

| Spec | Tester | Status | Fixar |
|------|--------|--------|-------|
| admin.spec.ts | 12 | PASS | -- |
| auth.spec.ts | 7 | PASS | `toHaveURL('/')` -> regex (hanterar LAN-IP) |
| security-headers.spec.ts | ~10 | PASS | -- |
| feature-flag-toggle.spec.ts | ~30 | PASS | Se nedan |

**Fixar i feature-flag-toggle.spec.ts:**
1. Nav-selektorer: `openProviderMoreDropdown()` helper -- sekundara items ar i "Mer"-dropdown
2. `PROVIDER_ALWAYS_NAV` -> `PROVIDER_PRIMARY_NAV` + `PROVIDER_SECONDARY_ALWAYS_NAV`
3. `due_for_service` borttagen fran TOGGLE_FLAGS (har env-override, kan inte toggles)
4. `CUSTOMER_ALWAYS_NAV`: "Vanliga fragor" -> "Hjalp"
5. `networkidle` -> `domcontentloaded` + timeout
6. `Failed to fetch` tillagd i error-filter
7. Recurring bookings: hittar "Test Stall AB" specifikt istallet for `.first()`

### Batch 2: Bokningar (KLAR -- 41 pass, 19 skip, 0 fail)

| Spec | Tester | Status | Fixar |
|------|--------|--------|-------|
| booking.spec.ts | 6 | PASS | Se nedan |
| calendar.spec.ts | 9 | PASS | Legend-text uppdaterad |
| manual-booking.spec.ts | 2 | PASS | `networkidle` -> `domcontentloaded` |
| flexible-booking.spec.ts | ~8 | PASS | -- |
| group-bookings.spec.ts | ~16 | PASS | Feature flag + selektorer |

**APP-BUGG FIXAD: CalendarHeader.tsx** -- Alla 7 knappar saknade `type="button"`. Nar CalendarHeader anvands inuti ett `<form>` (t.ex. DesktopBookingDialog) defaultade knapparna till `type="submit"` (HTML-spec), vilket triggade formularets submit-handler och hoppade direkt till sammanfattningsvyn. Fix: lade till `type="button"` pa alla Button-element.

**Ovriga fixar:**
1. `manual-booking.spec.ts`: `networkidle` -> `domcontentloaded` + wait for heading (SWR-polling forhindrar networkidle)
2. `calendar.spec.ts`: "Stangt (veckoschema)" -> "Stangt" (legend refaktorerades i Sprint 1)
3. `booking.spec.ts`: Uppdaterat till nuvarande bokningsflode -- HorseSelector (combobox) istallet for textfalt, "Granska bokning" steg fore "Skicka"
4. `group-bookings.spec.ts`: `FEATURE_GROUP_BOOKINGS=true` tillagd i playwright.config.ts webServer.env
5. `group-bookings.spec.ts`: `.first()` pa alla `getByText` for card-namn (text finns i bade titel och beskrivning)
6. `group-bookings.spec.ts`: `button 'x'` -> `getByRole('button', { name: /ta bort platsfilter/i })`

### Batch 3: Leverantor (VANTANDE)
- provider.spec.ts
- provider-profile-edit.spec.ts
- provider-notes.spec.ts
- accepting-new-customers.spec.ts

### Batch 4: Kund (VANTANDE)
- customer-profile.spec.ts
- customer-registry.spec.ts
- customer-reviews.spec.ts
- customer-insights.spec.ts
- customer-due-for-service.spec.ts

### Batch 5: Rutter & socialt (VANTANDE)
- route-planning.spec.ts
- announcements.spec.ts
- route-announcement-notification.spec.ts
- municipality-watch.spec.ts
- follow-provider.spec.ts

### Batch 6: Ovrigt (VANTANDE)
- recurring-bookings.spec.ts
- reschedule.spec.ts
- no-show.spec.ts
- payment.spec.ts
- horses.spec.ts
- due-for-service.spec.ts
- business-insights.spec.ts
- offline-pwa.spec.ts
- offline-mutations.spec.ts
- exploratory-baseline.spec.ts
- unsubscribe.spec.ts

## Tackningsgap

### Prioritet 1 -- Hog paverkan (ingen E2E-tackning)

| Feature | Sidor | API routes | Kommentar |
|---------|-------|------------|-----------|
| **Stallagare** | /stable/dashboard, /stable/profile, /stable/invites, /stable/spots | /api/stable/* | Ny feature, 0% tackning |
| **Stripe subscriptions** | /provider/subscription | /api/subscriptions/* | Betalningskritiskt |
| **Voice logging UI** | /provider/voice-log | /api/voice-log/* | Feature-flaggad |
| **Fortnox-integration** | /provider/settings/integrations | /api/integrations/* | Revenue-feature |

### Prioritet 2 -- Medium paverkan

| Feature | Sidor | Kommentar |
|---------|-------|-----------|
| Hjalpsystem | /customer/help, /provider/help, /admin/help | Struktur testad, innehall ej |
| Hasttidslinje | /provider/horse-timeline/[horseId] | Ny vy, otestad |
| Export | /customer/export, /provider/export | Data-export |
| Admin verifieringar | /admin/verifications | Onboarding-compliance |
| Gruppbokningar (kund) | /customer/group-bookings/* | Provider-sida testad, kund ej |

### Prioritet 3 -- Lag paverkan

| Feature | Kommentar |
|---------|-----------|
| Widget-endpoints | /api/widget/* |
| Karta/tile-interaktion | Svart att E2E-testa |
| Filuppladdning | Kravs mock |
| Landningssida (/) | Statisk |

## Prioriterade nya specs

1. **stables.spec.ts** -- Stallagare-flode (dashboard, profil, platser, inbjudningar)
2. **integrations.spec.ts** -- Fortnox OAuth + sync (med mock)
3. **voice-logging.spec.ts** -- Rostloggning UI-flode
4. Utoka group-bookings.spec.ts med kundperspektiv
5. provider-verification.spec.ts -- Onboarding

## Verifiering

- [x] Batch 1 kord och gron
- [x] Batch 2 kord och gron
- [ ] Batch 3-6 korda
- [ ] Alla failures kategoriserade (flaky vs genuina buggar)
- [ ] Genuina buggar fixade
- [ ] Alla tester grona
- [ ] Tackningsgap dokumenterade och prioriterade
- [ ] Minst 1 ny spec skapad for Prioritet 1-gap
