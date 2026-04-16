---
title: "S27-4: MFA for admin"
description: "Supabase TOTP MFA enrollment + verifiering for admin-konton"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Bakgrund
  - Approach
  - Filer
  - API
  - Risker
---

# S27-4: MFA for admin

## Bakgrund

Admin-konton hanterar anvandardata, bokningar och systemkonfiguration. MFA kravs infor leverantor #2. Supabase Auth stodjer TOTP MFA (enrollment + verifiering) via `supabase.auth.mfa.*` API.

## Approach

### 1. MFA Enrollment (admin-profil)

- Ny sida: `/admin/mfa/setup` med QR-kod och verifieringsfalt
- Flode: `mfa.enroll({factorType: 'totp'})` -> visa QR -> `mfa.challenge()` + `mfa.verify()` -> faktor aktiv
- Lank fran admin-dashboard eller admin-profil

### 2. MFA Verification Guard (middleware)

- I `middleware.ts`: efter admin-check, kolla `mfa.getAuthenticatorAssuranceLevel()`
- Om admin har enrollad MFA men `currentLevel !== 'aal2'` -> redirect till `/admin/mfa/verify`
- Ny sida: `/admin/mfa/verify` -- skriv in TOTP-kod, `mfa.challenge()` + `mfa.verify()`
- Undantag: `/admin/mfa/*` routes ska vara atkomliga utan aal2

### 3. MFA Verification Page

- Sida: `/admin/mfa/verify` -- enkel form med 6-siffrig kodinmatning
- Anropar `mfa.challenge()` + `mfa.verify()` med aktuell faktor
- Vid success: redirect till ursprunglig admin-sida

### 4. API Route for MFA status

- `GET /api/admin/mfa/status` -- returnerar om admin har MFA enrollad och current AAL
- Anvands av admin-dashboard for att visa "Aktivera MFA"-knapp eller "MFA aktiv"-badge

## Filer

### Nya filer
- `src/app/admin/mfa/setup/page.tsx` -- MFA enrollment med QR-kod
- `src/app/admin/mfa/verify/page.tsx` -- MFA verifiering vid inloggning
- `src/app/api/admin/mfa/status/route.ts` -- MFA status API
- `src/domain/admin/MfaService.ts` -- MFA domain service
- `src/__tests__/api/admin/mfa-status.integration.test.ts` -- tester

### Andrade filer
- `middleware.ts` -- lagg till AAL-check for admin-routes
- `src/lib/middleware-auth.ts` -- utoka MiddlewareUser med aal

## API

### GET /api/admin/mfa/status
```json
{
  "enrolled": true,
  "currentLevel": "aal1",
  "nextLevel": "aal2",
  "factors": [{ "id": "...", "type": "totp", "status": "verified" }]
}
```

## Risker

- **Medium risk**: Middleware-andring paverkar alla admin-routes
- **Mitigation**: AAL-check BARA for admin-routes, med undantag for `/admin/mfa/*`
- **Supabase MFA ar gratis** och aktiverat per default pa alla projekt
- **Fallback**: Om MFA inte enrollad, tvingas inte -- bara om faktor finns men inte verifierad
- **VIKTIGT**: MFA-check sker i middleware (server-side), inte bara klient -- defense in depth
