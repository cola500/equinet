---
title: "S53-0: Demo Walkthrough Findings 2026-04-23"
description: "Smoke-test av leverantörsflödet med demo_mode=true"
category: testing
status: active
last_updated: 2026-04-23
sections:
  - Sammanfattning
  - Fixade i S53-0
  - Backlog (S53-2 data)
  - Accepterade (ej pinsamma)
---

# Demo Walkthrough Findings — 2026-04-23

**Leverantör:** provider@example.com / ProviderPass123!
**Demo mode:** NEXT_PUBLIC_DEMO_MODE=true
**Miljö:** Lokal dev (localhost:3000) + Supabase CLI

---

## Sammanfattning

Alla 7 steg i demo-flödet genomgångna. 3 kategorier av fynd:
1. **Fixade nu** (kodbuggar): 1 fix
2. **Backlog** (seed-data, löses av S53-2): 7 fynd
3. **Accepterade** (dev-only eller förväntade): 2 fynd

---

## Fixade i S53-0

### F1: Dashboard — onboarding-widget visas tre gånger (FIX)

**Symtom:** Dashboard visar OnboardingWelcome + PriorityActionCard ("Slutför din profil") + OnboardingChecklist ("Kom igång") simultant. Tre separata onboarding-widgets på samma vy.

**Rotorsak:** `OnboardingChecklist` var alltid renderad (rad 229) oavsett om `OnboardingWelcome` redan visades. `PriorityActionCard` visade "Slutför din profil" även när Welcome-kortet var synligt.

**Fix:** 
- `OnboardingChecklist` döljs när `OnboardingWelcome` är synlig (`!onboardingComplete && !!onboardingStatus`)
- `PriorityActionCard` behandlar onboarding som "komplett" när Welcome-kortet visas
- Fil: `src/app/provider/dashboard/page.tsx`
- Tester: 6/6 gröna

---

## Backlog (löses av S53-2 demo-seed)

Alla dessa fynd är data-problem, inte kodproblem. Löses av `scripts/seed-demo-provider.ts`.

### B1: Leverantör heter "Leverantör Testsson"

Visas i: header, profilsida, kalender-detaljvy
Kräver: S53-2 seedar realistiskt namn ("Erik Järnfot" eller liknande)

### B2: Kund heter "Test Testsson" / "test@example.com"

Visas i: bokningslistan, kundlistan, kalender-detaljvy
Kräver: S53-2 seedar realistiska kundnamn

### B3: Häst "ulf" (ej kapitaliserat) och "Bulle (bold)"

Visas i: kalender-detaljvy, kunddetaljvy
Kräver: S53-2 seedar realistiska hästnamn

### B4: "Kundkommentarer: Test-bokning för E2E-tester"

Visas i: bokningslistan, genomförd bokning
PINSAMT: direkt synlig testtext i demo-vyn
Kräver: S53-2 rensar/seedar realistiska kommentarer

### B5: "Test Stall AB" som företagsnamn

Visas i: profil-sidan, Företagsinformation
Kräver: S53-2 seedar realistiskt stallnamn

### B6: Profil saknar adress, postnummer, serviceområde ("Ej angiven")

Visas i: profil-sidan
Kräver: S53-2 seedar komplett profil-data

### B7: Noll kommande bokningar i statistiken

Dashboard visar: Aktiva tjänster 2, Kommande bokningar 0, Nya förfrågningar 0
Kräver: S53-2 seedar 15-20 bokningar (mix past/future)

---

## Accepterade (ej pinsamma)

### A1: CSP-blockning av Vercel analytics i dev-mode

```
Loading the script 'https://va.vercel-scripts.com/v1/script.debug.js' violates CSP
```

**Status:** Accepterat — händer bara i lokalt dev-läge. Försvinner i produktion (Vercel-deployment lägger till rätt CSP-huvuden).

### A2: 401 på /api/auth/session vid sidladdning

Sker innan sessionen initierats på klienten. Löser sig automatiskt. Ej synligt för användaren.

**Status:** Accepterat — förväntad transient error.

---

## Screenshots

| Sida | Fil |
|------|-----|
| Dashboard (före fix) | 01-dashboard.png |
| Dashboard (efter fix) | 01b-dashboard-fixed.png |
| Kalender | 02-calendar.png |
| Kalender — bokningsdetail | 03-calendar-booking-detail.png |
| Bokningar | 04-bookings.png |
| Kunder | 05-customers.png |
| Kund — detaljvy | 05b-customer-detail.png |
| Tjänster | 06-services.png |
| Tjänst — edit-dialog | 06b-service-edit.png |
| Profil | 07-profile.png |
