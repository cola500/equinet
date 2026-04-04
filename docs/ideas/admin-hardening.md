---
title: "Admin-härdning -- MFA, sessioner, audit log"
description: "Stärk admin-rollen med MFA, tidbegränsade sessioner och audit log inför skalning"
category: idea
status: active
last_updated: 2026-04-04
tags: [security, admin, mfa, audit, scaling]
sections:
  - Bakgrund
  - Åtgärder
  - Prioritering
---

# Admin-härdning

## Bakgrund

Idag är admin en enkel `isAdmin`-boolean. Det fungerar med en leverantör men
skalar inte säkert. Service role-nyckeln kringgår RLS helt -- en komprometterad
admin-session ger full databasaccess.

Branschstandard (Stripe, AWS, GitHub) kräver minst MFA + audit log för
privilegierade roller.

## Åtgärder

### 1. MFA obligatoriskt för admin

Supabase stödjer TOTP (Google Authenticator etc.) redan. Kräver:
- Enrolla MFA vid första admin-login
- Verifiera MFA-faktor vid varje session
- Blockera admin-operationer utan verifierad MFA

**Effort:** 1 dag (Supabase har SDK-stöd, mest UI-arbete)

### 2. Tidbegränsade admin-sessioner

Admin-sessions löper ut efter 15 minuter (istället för standard 1h).
Re-auth krävs för destruktiva operationer (radera användare, ändra RLS).

**Effort:** 0.5 dag (session-config i Supabase + frontend-guard)

### 3. Audit log på admin-operationer

Logga varje admin-operation: vem, vad, när, från vilken IP.
Enkel implementation: en `AdminAuditLog`-tabell i Prisma.

**Effort:** 1 dag (modell + middleware + admin-sida för att läsa loggen)

### 4. (Framtida) Granulära admin-roller

Dela upp admin i separata behörigheter: "kan se användare", "kan radera",
"kan ändra feature flags". Inte nödvändigt förrän 10+ leverantörer.

**Effort:** 2-3 dagar

## Prioritering

| Åtgärd | När | Trigger |
|--------|-----|---------|
| MFA för admin | Inför leverantör #2 | Fler personer med admin-access |
| Tidbegränsade sessioner | Samtidigt som MFA | Naturlig koppling |
| Audit log | Inför Stripe live-mode | Compliance, spårbarhet |
| Granulära roller | Vid 10+ leverantörer | Hanterbarhet |
