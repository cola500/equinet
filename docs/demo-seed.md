---
title: Demo Seed
description: Beskrivning av demo-data, hur den skapas, och hur man aterstaller
category: operations
status: active
last_updated: 2026-03-26
sections:
  - Oversikt
  - Data som skapas
  - Kommandon
  - Tekniska detaljer
---

# Demo Seed

## Översikt

`prisma/seed-demo.ts` skapar realistisk data for demolaget. Den:

1. Uppdaterar befintlig provider (provider@example.com) med realistiskt namn och foretagsinfo
2. Tar bort E2E-testtjanster och deras bokningar
3. Skapar 4 tjänster, 4 kunder, 3 hästar och 7 bokningar

**Forutsattning:** `seed-test-users.ts` maste ha korts forst (skapar provider@example.com).

## Data som skapas

### Provider (uppdaterad)

| Falt | Varde |
|------|-------|
| Namn | Maria Lindgren |
| Email | provider@example.com |
| Lösenord | ProviderPass123! |
| Företag | Lindgrens Hovslageri & Ridskola |
| Stad | Taby |
| Adress | Stallvagen 8, 183 47 |

### Tjänster (4 st)

| Tjänst | Pris | Tid | Aterbesok |
|--------|------|-----|-----------|
| Hovslagning | 1 200 kr | 60 min | 8 veckor |
| Hovvard utan beslag | 700 kr | 45 min | 6 veckor |
| Ridlektion | 550 kr | 45 min | -- |
| Halsokontroll | 900 kr | 30 min | -- |

### Kunder (4 st)

| Namn | Email | Stad |
|------|-------|------|
| Anna Johansson | anna.johansson@demo.equinet.se | Taby |
| Erik Svensson | erik.svensson@demo.equinet.se | Danderyd |
| Sofia Berg | sofia.berg@demo.equinet.se | Vallentuna |
| Johan Pettersson | johan.pettersson@demo.equinet.se | Osteraker |

### Hästar (3 st)

| Namn | Ras | Agare |
|------|-----|-------|
| Storm | Svenskt varmblod | Anna Johansson |
| Saga | Islandsponny | Erik Svensson |
| Bella | Gotlandsruss | Sofia Berg |

### Bokningar (7 st)

| Tjänst | Kund | Status | Tidpunkt |
|--------|------|--------|----------|
| Hovslagning | Anna Johansson | Bekraftad | +2 dagar 09:00 |
| Hovvard utan beslag | Erik Svensson | Bekraftad | +2 dagar 11:00 |
| Ridlektion | Sofia Berg | Vantar | +4 dagar 14:00 |
| Hovslagning | Anna Johansson | Genomförd | -7 dagar |
| Halsokontroll | Johan Pettersson | Genomförd | -14 dagar |
| Hovslagning | Erik Svensson | Genomförd | -21 dagar |
| Ridlektion | Sofia Berg | Avbokad | -3 dagar |

## Kommandon

```bash
# Skapa demo-data (idempotent for tjanster/kunder/hastar, skapar nya bokningar)
npm run db:seed:demo

# Aterstall: ta bort all demo-data, sedan skapa om
npm run db:seed:demo:reset
```

## Tekniska detaljer

### Identifiering av demo-data

- **Bokningar**: `providerNotes` innehaller `DEMO-SEED`
- **Hästar**: `specialNeeds` innehaller `DEMO-SEED`
- **Kunder**: email slutar pa `@demo.equinet.se`
- **Tjänster**: identifieras via namn-matchning mot serviceData-listan

### Idempotens

- Tjänster, kunder och hästar använder upsert/findFirst -- saker att kora flera ganger
- Bokningar skapas bara om inga `DEMO-SEED`-markerats bokningar finns
- `--reset` flaggan tar bort all demo-data fore omskapande

### Beroenden

Seed-filen använder samma Prisma-klient och bcrypt som ovriga seed-filer.
Inga extra beroenden behovs.
