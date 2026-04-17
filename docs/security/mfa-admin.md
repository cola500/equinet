---
title: "MFA för admin-konton"
description: "TOTP-baserad multi-factor authentication för admin -- enrollment, verifiering, återställning, policy"
category: security
status: active
last_updated: 2026-04-17
tags: [security, mfa, totp, admin, auth]
sections:
  - Översikt
  - Enrollment
  - Verifiering
  - Återställning vid förlorad telefon
  - Policy
  - Teknisk implementation
  - Felsökning
---

# MFA för admin-konton

## Översikt

Alla admin-konton måste aktivera TOTP-baserad MFA (Time-based One-Time Password) via Google Authenticator, Authy eller motsvarande app. Admin-sidor (`/admin/*`) kräver `aal2`-sessions (authenticated + MFA-verifierad).

Implementerat i **S27-4** (2026-04-16).

**Varför:** Admin-konton har tillgång till användardata, bokningar, betalningar och systemkonfiguration. Om ett admin-lösenord läcker räcker det inte med lösenordet ensamt för att komma åt dessa funktioner.

## Enrollment

Första gången en admin loggar in efter att MFA är aktiverad:

1. Användaren redirectas till `/admin/mfa/setup`
2. En QR-kod visas (genererad från Supabase TOTP secret)
3. Scanna QR-koden med Google Authenticator, Authy eller liknande
4. Ange första 6-siffriga koden för att verifiera
5. Sessionen uppgraderas till `aal2` och redirect till admin-dashboard

**URL:** `/admin/mfa/setup`

**Tekniskt:** Använder Supabase `auth.mfa.enroll({ factorType: 'totp' })` och sedan `auth.mfa.challenge()` + `auth.mfa.verify()`.

## Verifiering

Vid varje ny admin-session:

1. Användaren loggar in med email + lösenord (aal1)
2. Middleware detekterar admin-rollen och kräver aal2
3. Redirect till `/admin/mfa/verify`
4. Användaren anger aktuell 6-siffrig kod från authenticator
5. Session uppgraderas till aal2 och redirect till önskad admin-sida

**URL:** `/admin/mfa/verify`

**Session-timeout:** 15 minuter (via JWT `iat`-check). Efter det kräver admin-operation ny MFA-verifiering.

## Återställning vid förlorad telefon

**Viktigt:** Supabase TOTP stödjer INTE backup-koder. Återställning kräver manuell åtgärd.

### Rekommenderad policy: flera faktorer

Admin bör enrolla TOTP på **minst två enheter** (t.ex. telefon + iPad, eller telefon + 1Password). Supabase stödjer flera factors per användare.

### Om admin tappat alla faktorer

Detta är en **privilege escalation-risk** och måste hanteras manuellt:

1. Annan admin (eller Johan som ägare) loggar in i Supabase Dashboard
2. Gå till Authentication → Users → hitta den låsta användaren
3. Ta bort MFA-factorn (Admin API: `admin.mfa.deleteFactor({ userId, factorId })`)
4. Användaren loggar in med lösenord (aal1)
5. Redirectas till `/admin/mfa/setup` för ny enrollment
6. **Logga incidenten** i admin audit log

**Risk:** Om någon får access till Supabase Dashboard via komprometterat utvecklarkonto kan de kringgå MFA. Håll Supabase-access begränsat.

### Om INGEN admin har access

Kontakta Supabase Support via console -- de kan återställa via deras admin-flöde. Detta kräver verifiering av ägarskap.

## Policy

| Roll | MFA-krav | Status |
|------|----------|--------|
| Admin (`isAdmin: true`) | Obligatoriskt | Live S27-4 |
| Leverantör (`userType: 'provider'`) | Ej implementerat | Backlog NFR-14 |
| Kund (`userType: 'customer'`) | Ej planerat | - |

**Framtida utbyggnad:** MFA för leverantörer planeras som frivilligt vid launch, obligatoriskt efter X månader (se NFR-14).

## Teknisk implementation

**Filer:**
- `src/app/admin/mfa/setup/page.tsx` -- enrollment-flöde
- `src/app/admin/mfa/verify/page.tsx` -- verifiering vid login
- `src/lib/supabase/mfa.ts` -- Supabase MFA-wrapper
- `src/middleware.ts` -- aal2-check för `/admin/*`

**Tester:**
- MFA-enrollment status
- Verifiering med korrekt/felaktig kod
- Saknad MFA redirect till setup
- Non-admin blockeras från /admin/mfa/*

**Säkerhetsfynd fixade under S27-4:**
- **Blocker:** QR-kod renderades med `dangerouslySetInnerHTML` (XSS-risk). Fixad till `<img>` med data URI.
- **Major:** Saknad test för non-admin blockering av MFA-sidor. Fixad.

## Felsökning

### "Invalid TOTP code" trots att koden är rätt

- Tidssynkronisering: TOTP-koder är tidsberoende. Kontrollera att server och klient har korrekt tid (NTP).
- Kod har förbrukats: varje kod är giltig ~30s. Vänta på nästa kod.
- Fel factor: om admin enrollat flera factors, verifiera att rätt factor används.

### Admin fastnar i redirect-loop

- JWT innehåller inte `aal2` trots verifiering -- kontrollera att middleware läser rätt claim
- Session-cookie inte uppdaterad -- logga ut och in

### MFA aktiverat men prompt:as inte

- Kolla middleware matcher i `src/middleware.ts` -- `/admin/*` måste matcha
- Kontrollera att `requireMfaForAdmin` env-variabel är `true`

## Relaterade dokument

- `NFR.md` NFR-14 -- MFA-krav för admin och leverantör
- `docs/operations/incident-runbook.md` -- procedur vid MFA-lockout
- `docs/done/s27-4-done.md` -- implementationsdetaljer
