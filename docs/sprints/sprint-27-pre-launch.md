---
title: "Sprint 27: Pre-launch sweep"
description: "Sista svepet innan lansering -- licensfix, CI, email-templates, MFA, GDPR, iOS"
category: sprint
status: active
last_updated: 2026-04-16
tags: [sprint, launch, security, gdpr, mfa]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 27: Pre-launch sweep

## Sprint Overview

**Mål:** Sopa rent innan lansering. Licensrisk, CI-gap, tech debt, MFA och GDPR -- allt som bör vara på plats när riktiga användare kommer.

---

## Sessionstilldelning

### Session 1 (Opus, huvudrepo)
Kör BARA dessa stories:
- **S27-1** Leaflet CSS lazy-load (15 min)
- **S27-2** Migrationstest ren DB i CI (30 min)
- **S27-3** Email templates refactoring (1 dag)
- **S27-4** MFA för admin (1 dag)
- **S27-5** GDPR data retention policy + cron (1 dag)

### Session 2 (Sonnet, worktree eller separat terminal)
Kör BARA dessa stories:
- **S27-6** iOS cleanup (10 min)
- **S27-7** Hjälpcentral native (0.5 dag)
- **S27-8** Testing-guide till markdown (0.5 dag)

**Session 1 SKA INTE röra:** ios/*, docs/admin/testing-guide
**Session 2 SKA INTE röra:** src/lib/email/*, src/lib/auth-*, .github/*, src/middleware.*

---

## Stories

### S27-1: Leaflet CSS lazy-load

**Domän:** webb
**Effort:** 15 min
**Roll:** fullstack

Flytta `import "leaflet/dist/leaflet.css"` från `src/app/layout.tsx` till `src/components/RouteMapVisualization.tsx`. Eliminerar Hippocratic-licenserad kod från alla sidor som inte renderar ruttplanering.

Se `docs/security/license-audit-2026-04-15.md` för bakgrund.

**Acceptanskriterier:**
- [ ] Leaflet CSS importeras BARA i RouteMapVisualization
- [ ] Ruttplanering fungerar fortfarande (visuell verifiering)
- [ ] Ingen leaflet-CSS på andra sidor
- [ ] `npm run check:all` grön

---

### S27-2: Migrationstest på ren DB i CI

**Domän:** infra
**Effort:** 30 min
**Roll:** fullstack

CI kör `prisma migrate deploy` men inte `prisma migrate reset`. Det fångar inte trasiga migrationer som misslyckas från scratch (t.ex. saknad tabell som refereras).

**Implementation:**
- Nytt CI-steg: `prisma migrate reset --force` mot en tillfällig DB
- Kör efter unit tests men före E2E (E2E behöver seedat data)
- Alternativ: separat job som kör `prisma migrate reset` + `prisma migrate deploy`

**Acceptanskriterier:**
- [ ] CI kör migrationer från scratch
- [ ] Trasig migration failar CI
- [ ] Befintliga CI-jobb opåverkade

---

### S27-3: Email templates till separata filer

**Domän:** webb
**Effort:** 1 dag
**Roll:** fullstack

`src/lib/email/templates.ts` är 1012 rader HTML-templates som strängar. Svårt att underhålla, svårt att preview:a.

**Implementation:**
- Skapa `src/lib/email/templates/` med en fil per template
- Antingen: React Email (JSX-baserat) eller separata HTML-filer med variabler
- Behåll samma API (sendEmail-funktionen ska fungera identiskt)
- Flytta varje template-funktion till egen fil

**Acceptanskriterier:**
- [ ] templates.ts borttagen eller krympt till < 100 rader (bara re-exports)
- [ ] Varje email-template i egen fil
- [ ] E-post skickas korrekt (testa med Resend mock)
- [ ] `npm run check:all` grön

---

### S27-4: MFA för admin

**Domän:** webb (auth)
**Effort:** 1 dag
**Roll:** fullstack

Admin-konton hanterar användardata, bokningar och systemkonfiguration. MFA krävs inför leverantör #2.

**Implementation:**
- Supabase Auth stödjer TOTP MFA (enrollment + verifiering)
- Admin-sidor kräver MFA-verifiering (kontrollera `aal2` i JWT)
- Enrollment-flöde: QR-kod + backup-koder
- Middleware/guard: om admin utan MFA -> redirect till enrollment

**Acceptanskriterier:**
- [ ] Admin kan enrolla TOTP (QR-kod i profil-sidan)
- [ ] Admin-sidor kräver MFA (aal2)
- [ ] Backup-koder genereras vid enrollment
- [ ] Befintliga admin-sessioner promptas att enrolla
- [ ] Tester: MFA-enrollment, verifiering, saknad MFA -> redirect

---

### S27-5: GDPR data retention policy + cron

**Domän:** webb + docs
**Effort:** 1 dag
**Roll:** fullstack

Definiera lagringsperioder för personuppgifter och implementera automatisk radering.

**Implementation:**
- Dokumentera policy: `docs/security/data-retention-policy.md`
  - Aktiva konton: behålls
  - Raderade konton: anonymiseras omedelbart (redan implementerat)
  - Loggar: 1 år retention
  - Bokningshistorik: behålls anonymiserat (för leverantörsstatistik)
  - Inaktiva konton (ej inloggat 2+ år): notifiera -> radera efter 30 dagar
- Cron-job: `/api/cron/data-retention` som kör månadsvis
  - Hitta inaktiva konton (lastLoginAt > 2 år)
  - Skicka notifiering (30 dagars varning)
  - Radera efter grace period
- Feature flag: `data_retention` (default off tills policy är granskad)

**Acceptanskriterier:**
- [ ] Policy dokumenterad
- [ ] Cron-job implementerat bakom feature flag
- [ ] Tester: identifiera inaktiva konton, notifiering, radering
- [ ] `npm run check:all` grön

---

### S27-6: iOS cleanup

**Domän:** ios
**Effort:** 10 min
**Roll:** fullstack

Två SwiftUI Pro-fynd från S13-4:

1. `Task.detached` -> `Task` i AuthManager + PushManager
2. Force unwrap -> guard let i `AuthManager.exchangeSessionForWebCookies()`

**Acceptanskriterier:**
- [ ] Inga `Task.detached` kvar
- [ ] Inga force unwraps i AuthManager
- [ ] iOS-tester passerar

---

### S27-7: Hjälpcentral native

**Domän:** ios
**Effort:** 0.5 dag
**Roll:** fullstack

Enklaste kvarvarande WebView-skärmen. Hjälpcentral (`help_center` flagga, default on) som native SwiftUI-vy.

**Implementation:**
- Följ iOS Native Screen Pattern (CLAUDE.md)
- Steg 0: Feature Inventory (läs webb-sidans komponenter)
- Native SwiftUI List med sektioner + sökbar
- Läs artiklar från API (`/api/native/help` eller liknande)
- NavigationLink för artikeldetalj

**Acceptanskriterier:**
- [ ] Feature inventory genomförd
- [ ] Native hjälpcentral med sökbar lista
- [ ] Artikeldetalj i native vy
- [ ] iOS-tester (ViewModel)
- [ ] Visuell verifiering med mobile-mcp

---

### S27-8: Testing-guide till markdown

**Domän:** docs
**Effort:** 0.5 dag
**Roll:** fullstack

`src/app/admin/testing-guide/page.tsx` är 901 rader -- admin-intern, inte kundvänd. Flytta till markdown.

**Implementation:**
- Flytta innehållet till `docs/testing/testing-guide.md`
- Admin-sidan renderar markdown (MDX eller enkel markdown-parser)
- Alternativ: ta bort admin-sidan helt, behåll bara docs-filen

**Acceptanskriterier:**
- [ ] Testing-guide i markdown
- [ ] Admin-sidan krympt eller borttagen
- [ ] `npm run check:all` grön

---

## Exekveringsplan

```
Session 1 (Opus, huvudrepo):
  S27-1 (15m) -> S27-2 (30m) -> S27-3 (1d) -> S27-4 (1d) -> S27-5 (1d)

Session 2 (Sonnet, worktree):
  S27-6 (10m) -> S27-7 (0.5d) -> S27-8 (0.5d)
```

**Total effort:** ~3.5 dagar session 1, ~1 dag session 2. Parallellt: ~3.5 dagar elapsed.

## Definition of Done (sprintnivå)

- [ ] Ingen Hippocratic-licenserad kod laddas per default
- [ ] CI fångar trasiga migrationer från scratch
- [ ] Email templates underhållbara (ej 1012-raders strängfil)
- [ ] Admin-konton kräver MFA
- [ ] GDPR data retention dokumenterad och implementerad
- [ ] iOS hjälpcentral native
- [ ] `npm run check:all` grön
