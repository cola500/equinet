---
title: "S27-4 Done: MFA for admin"
description: "Supabase TOTP MFA enrollment och verifiering for admin-konton"
category: retro
status: active
last_updated: 2026-04-16
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S27-4 Done: MFA for admin

## Acceptanskriterier

- [x] Admin kan enrolla TOTP (QR-kod i /admin/mfa/setup)
- [x] Admin-sidor kräver MFA (aal2) via middleware enforcement
- [x] Backup-koder: EJ implementerat (Supabase hanterar inte backup-koder for TOTP -- de rekommenderar att enrolla flera faktorer istallet)
- [x] Befintliga admin-sessioner promptas att enrolla (redirect till /admin/mfa/verify om factor finns men aal1)
- [x] Tester: MFA-enrollment status, verifiering, saknad MFA -> redirect, non-admin blockeras

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker: QR renderas som img data URI (ej dangerouslySetInnerHTML), middleware enforcement server-side
- [x] Tester: 12 nya tester (5 API status + 7 middleware), 4057 totalt
- [x] Feature branch, check:all grön (4/4)

## Reviews

Kördes: code-reviewer.

Findings och resolution:
- **Blocker: dangerouslySetInnerHTML** -- fixad, anvander img med data URI istallet
- **Major: non-admin test for /admin/mfa** -- fixad, 2 nya tester tillagda
- **Major: MfaService.ts saknas** -- medveten avvikelse (se nedan)
- **Major: verify-sida infinite loading** -- fixad, fallback till "Aktivera MFA"-knapp
- **Minor: dead test stub** -- fixad, borttagen
- **Minor: window.location.href** -- behalls for full page reload efter auth state change (MFA verify ändrar session JWT)
- **Minor: supabase client per render** -- acceptabelt for admin-sida med lag trafik

## Avvikelser

- **MfaService.ts** skapades inte. Motivering: Supabase MFA-anrop sker via browser-klient (mfa.enroll/challenge/verify) som MASTE koras client-side. En domain service skulle bara wrappa Supabase-anrop utan att tillföra värde. API-routen (status) ar tillrackligt enkel for att inte motivera ett service-lager.
- **Backup-koder** stods inte av Supabase TOTP MFA. Rekommendationen ar att enrolla flera faktorer (t.ex. TOTP + phone).

## Lärdomar

- Supabase MFA `getAuthenticatorAssuranceLevel()` returnerar `nextLevel: 'aal2'` BARA om en verified faktor finns. Perfekt for att skilja "har MFA" fran "har inte MFA".
- QR-koden fran Supabase ar en rå SVG-sträng. `dangerouslySetInnerHTML` ar frestande men en XSS-risk -- anvand data URI istallet.
- Middleware MFA-check maste ha undantag for MFA-sidorna sjalva, annars fas admin i en redirect-loop.
