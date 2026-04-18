---
title: "Plan: S31-1 Hjälpartiklar-audit och uppdatering"
description: "Inventering av 51 hjälpartiklar mot feature-set, identifiering av gap och åtgärdande"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Inventering
  - Gap-analys
  - Åtgärder
  - Filer som berörs
---

# Plan: S31-1 Hjälpartiklar-audit och uppdatering

## Inventering

51 artiklar totalt (7 admin, 14 kund, 30 leverantör). Artikel-inventering genomförd 2026-04-18 mot README.md Implementerade Funktioner.

## Gap-analys

### Saknade artiklar (skapar ny)

| Feature | Roll | Artikel att skapa |
|---------|------|-------------------|
| Admin MFA (TOTP) | admin | `admin/tva-faktor-autentisering.md` |
| Affärsinsikter | provider | `provider/affarsinsikter.md` |

### Artiklar som behöver uppdateras

| Artikel | Vad saknas |
|---------|-----------|
| `customer/hantera-bokningar.md` | Self-reschedule (ombokning) -- kund kan boka om sin bokning |
| `provider/installera-equinet.md` | Native iOS-app (inte bara PWA) -- separata installationssteg |

### Artiklar som är OK

- `provider/offline-lage.md` -- komplett och korrekt
- `provider/aterkommande-bokningar.md` -- komplett och korrekt
- `provider/kundinsikter.md` -- komplett och korrekt
- `provider/komma-igang.md` -- tillräcklig
- `customer/aterkommande-bokning.md` -- komplett
- `admin/systeminstellningar.md` -- täcker feature flags inkl. MFA-adjacent

## Åtgärder (i ordning)

1. Skapa `admin/tva-faktor-autentisering.md` -- MFA setup + verifiering
2. Skapa `provider/affarsinsikter.md` -- affärsinsikter-sida
3. Uppdatera `customer/hantera-bokningar.md` -- lägg till self-reschedule-sektion
4. Uppdatera `provider/installera-equinet.md` -- lägg till iOS native-app-sektion

## Filer som berörs

- `src/lib/help/articles/admin/tva-faktor-autentisering.md` (ny)
- `src/lib/help/articles/provider/affarsinsikter.md` (ny)
- `src/lib/help/articles/customer/hantera-bokningar.md` (uppdateras)
- `src/lib/help/articles/provider/installera-equinet.md` (uppdateras)

## Risker

- Inga schema- eller kodändringar. Enbart markdown-content.
- Verifiering: `npm run check:all` + visuell check av hjälpcentral i dev-server.
