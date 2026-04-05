---
title: "S16-3: Onboarding leverantör #2"
description: "Verifiera och fixa onboarding-flödet för nya leverantörer"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Syfte
  - Nuläge
  - Verifieringsplan
  - Identifierade risker
  - E2E-test
  - Avgränsning
---

# S16-3: Onboarding leverantör #2

## Syfte

Verifiera att en helt ny leverantör kan gå från registrering till att ta emot sin
första bokning. Fixa eventuella gap. Skriv E2E-test som skyddar flödet.

## Nuläge

Följande finns redan:
- Registreringssida med leverantörsval (`src/app/(auth)/register/page.tsx`)
- AuthService som skapar Supabase Auth + Provider (`src/domain/auth/AuthService.ts`)
- Sync-trigger `handle_new_user` som skapar public.User
- Custom Access Token Hook som sätter `providerId`, `userType`, `isAdmin` i JWT
- Onboarding-checklista med 4 steg (`src/components/provider/OnboardingChecklist.tsx`)
- Onboarding-status API (`src/app/api/provider/onboarding-status/route.ts`)
- Tomma tillstånd på alla leverantörssidor (S9-10)

## Verifieringsplan

### Fas 1: Manuell end-to-end verifiering

Skapa testanvändare via Supabase admin API (`email_confirm: true`), logga in, verifiera:

1. Dashboard visar onboarding-checklista (0/4 klara)
2. Profil: fyll i alla fält (businessName, description, address, city, postalCode) -> 1/4
3. Tjänster: tomt tillstånd visas, skapa en tjänst -> 2/4
4. Tillgänglighet: ställ in schema -> 3/4
5. Serviceområde: adress med lat/lng -> 4/4, checklista försvinner
6. Leverantören syns i sökresultat, kund kan boka

### Fas 2: Fixa gap

TDD för varje gap som hittas:
- RED: test som visar problemet
- GREEN: minimal fix
- REFACTOR: städa

### Fas 3: E2E-test

Playwright-spec: `e2e/provider-onboarding.spec.ts`

Setup: Skapa leverantör via admin API med `email_confirm: true`.
Steg: Login -> dashboard (checklista) -> profil -> tjänst -> tillgänglighet -> serviceområde -> checklista klar.

## Identifierade risker

1. **JWT claims timing**: Sync-trigger skapar User med `userType='customer'`,
   AuthService uppdaterar till `'provider'`. Om första login sker precis efter
   registrering kan JWT ha `userType='customer'` och sakna `providerId`.
   Custom Access Token Hook läser vid varje token-utfärdande, så refresh bör lösa det.

2. **Geocoding-beroende**: Serviceområde-steget kräver fungerande geocoding.
   I E2E kan vi sätta lat/lng direkt via API istället.

## Avgränsning

- **I scope**: Verifiera flödet, fixa buggar, E2E-test
- **Inte i scope**: Ändra registreringsformulär, email-verifiering, ny UI
