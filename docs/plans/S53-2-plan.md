---
title: "Plan: S53-2 Demo-seed för en leverantör"
description: "Script som skapar en realistisk demo-leverantör med kunder, hästar, bokningar och recensioner"
category: plan
status: active
last_updated: 2026-04-23
sections:
  - Approach
  - Filer som ändras
  - Datastrategi
  - Idempotens
  - Steg
---

# Plan: S53-2 Demo-seed för en leverantör

## Approach

Nytt standalone-script `scripts/seed-demo-provider.ts` som skapar en realistisk demo-leverantör
från grunden via Supabase Auth (samma mönster som `prisma/seed.ts`). Separerat från det
befintliga `prisma/seed-demo.ts` som modifierar `provider@example.com`.

Ny docs-fil `docs/operations/demo-setup.md` med inloggning och reset-instruktioner.

## Filer som ändras/skapas

- `scripts/seed-demo-provider.ts` (ny) — seed-script
- `docs/operations/demo-setup.md` (ny) — demo-dokumentation
- `package.json` — lägga till `db:seed:demo-provider` och `db:seed:demo-provider:reset`

## Datastrategi

**Provider:**
- Email: `erik.jarnfot@demo.equinet.se`
- Namn: "Erik Järnfot"
- Företag: "Järnfots Hovslageri"
- Ort: Örebro med ~50 km serviceradie
- `isVerified: true`, `acceptingNewCustomers: true`

**Tjänster (5):**
1. Omskoning — 1 400 kr, 75 min, 8v interval
2. Verkning (barfota) — 750 kr, 45 min, 6v interval
3. Akutbesök — 2 500 kr, 60 min (inget interval)
4. Ungdomsverkning — 600 kr, 40 min, 6v interval
5. Hovslagarbedömning — 800 kr, 30 min (inget interval)

**Kunder (9) med hästar (~15 totalt):**
- 5 kunder med 2 hästar var = 10 hästar
- 4 kunder med 1 häst var = 4 hästar
- Totalt: 9 kunder, 14 hästar

**Bokningar (18 st):**
- 5 kommande + bekräftade
- 2 kommande + pending
- 8 genomförda (utspridda 4-70 dagar bakåt)
- 2 avbokade
- 1 manuell bokning (provider-skapad)

**Recensioner (7 st):** Kopplade till genomförda bokningar, betyg 3-5.

**Anteckningar:**
- 4 `ProviderCustomerNote` (leverantörens kundanteckningar)
- 3 `providerNotes` direkt på bokningar

## Idempotens

- Provider: `findFirst` by email + skip create if exists
- Kunder: `upsert` by email
- Hästar: `findFirst` by ownerId + name + skip if exists
- Tjänster: `findFirst` by providerId + name + skip if exists
- Bokningar: skippa hela sektionen om `demoCustomerBookingCount > 0` (kan overridas med `--reset`)
- Recensioner: `findUnique` by bookingId + skip if exists
- Kundanteckningar: `findFirst` by providerId + customerId + content + skip if exists

**Märkning:** Alla kunder har email-suffix `@demo-provider.equinet.se`.
Alla hästar har `specialNeeds: "E2E-spec:demo-provider"`.

**Reset:** `--reset`-flaggan rensar och återskapar all demo-data (utom providern).

## Tillgänglighetsschema

Mån-Fre 07:00-16:00, Lör-Sön stängt.

## Steg

1. Skriv `scripts/seed-demo-provider.ts`
2. Lägg till script-kommandon i `package.json`
3. Skriv `docs/operations/demo-setup.md`
4. Kör scriptet mot lokal DB (`npm run db:seed:demo-provider`)
5. Kör om (idempotens-test)
6. Kör `npm run check:all`
7. Kör code-reviewer
8. Skriva done-fil + PR
