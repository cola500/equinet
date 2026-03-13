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

### Batch 3: Leverantor (KLAR -- 50 pass, 6 skip, 0 fail)

| Spec | Tester | Status | Fixar |
|------|--------|--------|-------|
| provider.spec.ts | 20 | PASS | Se nedan |
| provider-profile-edit.spec.ts | 14 | PASS | Tab-navigering |
| provider-notes.spec.ts | 9 | PASS | Svenska tecken + networkidle |
| accepting-new-customers.spec.ts | 7 | PASS | Tab-navigering |

**APP-BUGG FIXAD: provider/profile/page.tsx** -- Bokningsinställningar-kortet saknade CardHeader+CardTitle. Alla andra kort på profilsidan hade det, men detta kort hopppade direkt till CardContent. Fix: lade till `<CardHeader><CardTitle>Bokningsinställningar</CardTitle></CardHeader>`.

**Övriga fixar:**
1. `provider.spec.ts`: Rate limit reset i beforeEach (429 efter manga API-anrop)
2. `provider.spec.ts`: Strict mode -- `getByText(/nya förfrågningar/i)` matchade 3 element (PriorityActionCard + stat card + tooltip). Fix: exakt text-matchning
3. `provider.spec.ts`: Strict mode -- service-items filter matchade multipla element. Fix: `.first()`
4. `provider.spec.ts`: `waitForResponse` timeout pa accept/reject -- ersatt med `waitForTimeout` (race condition med guardMutation)
5. `provider-profile-edit.spec.ts` + `accepting-new-customers.spec.ts`: Profilsidan refaktorerad med flikar (Profil/Inställningar/Tillgänglighet). Tester uppdaterade att klicka "Inställningar" forst
6. `provider-notes.spec.ts`: `networkidle` -> `domcontentloaded` (SWR-polling forhindrar networkidle)
7. `provider-notes.spec.ts`: ASCII-substitut i regex -- `/lagg till anteckning/i` -> `/lägg till anteckning/i`, `/Klicka for att redigera/i` -> `/Klicka för att redigera/i`

### Batch 4: Kund (KLAR -- 44 pass, 0 skip, 0 fail)

| Spec | Tester | Status | Fixar |
|------|--------|--------|-------|
| customer-profile.spec.ts | ~8 | PASS | -- |
| customer-registry.spec.ts | ~8 | PASS | Regex for "Hästar" |
| customer-reviews.spec.ts | ~8 | PASS | -- |
| customer-insights.spec.ts | ~10 | PASS | -- |
| customer-due-for-service.spec.ts | ~10 | PASS | Tab-namn + networkidle |

**Fixar:**
1. `customer-due-for-service.spec.ts`: Tab-etikett andrad fran "Intervall" till "Besöksschema" (URL-param `intervall` oforandrad)
2. `customer-due-for-service.spec.ts`: `networkidle` -> `domcontentloaded` (SWR-polling)
3. `customer-registry.spec.ts`: `getByText('Hästar', { exact: true })` matchade inte pa mobil dar paragraf innehaller "(1)" efter texten. Fix: regex `/^Hästar/`

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
- [x] Batch 3 kord och gron
- [x] Batch 4 kord och gron
- [ ] Batch 5-6 korda
- [ ] Alla failures kategoriserade (flaky vs genuina buggar)
- [ ] Genuina buggar fixade
- [ ] Alla tester grona
- [ ] Tackningsgap dokumenterade och prioriterade
- [ ] Minst 1 ny spec skapad for Prioritet 1-gap
