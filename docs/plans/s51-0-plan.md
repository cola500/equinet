---
title: "S51-0 Plan: MFA admin — komplettering"
description: "Kärnan finns sedan S27-4. Saknar rate limiting på verify-failures, AdminAuditLog, admin-recovery.md, dashboard-länk, integration-tester."
category: plan
status: active
last_updated: 2026-04-22
sections:
  - Aktualitetskontroll
  - Saknade delar
  - Implementation
  - Risker
---

# S51-0 Plan: MFA admin — komplettering

## Aktualitet verifierad

**Kommandon körda:** `grep -r "enrollFactor\|verifyFactor" src/`, `git log -- src/app/admin/mfa/`
**Resultat:** Kärnan finns sedan S27-4 (commit f97f928f). Acceptanskriterier ej uppfyllda: rate limiting, AdminAuditLog, admin-recovery.md, dashboard-länk, integration-tester.
**Beslut:** Fortsätt — komplettera saknade delar.

## Aktualitetskontroll

Grep `enrollFactor`/`verifyFactor` → Inga träffar (Supabase klient-API).
Grep `enroll`/`challenge`/`verify` → finns i `/admin/mfa/setup/page.tsx` + `/admin/mfa/verify/page.tsx`.

**Slutsats**: S27-4 (commit f97f928f) implementerade kärnan:
- `/admin/mfa/setup` — enrollment-UI
- `/admin/mfa/verify` — challenge-UI  
- `/api/admin/mfa/status` — status-API
- `middleware-auth.ts` — AAL2-enforcement (redirect + 403)

## Saknade delar (AC-gap)

1. **Rate limiting på MFA-verify-failures** — verify-sidan har ingen backend-rate-limiting. 3 fel → 15 min block.
2. **AdminAuditLog för MFA-events** — `enrollment`, `mfa_success`, `mfa_failure` loggas inte.
3. **`docs/operations/admin-recovery.md`** — dokumentation för admin som tappar authenticator.
4. **Länk från admin-dashboard** — `/admin` saknar MFA setup-länk.
5. **Integration-tester** — enrollment/challenge-flödet har inga tester (bara status + middleware).

## Implementation

### Filer som ändras/skapas

| Fil | Åtgärd |
|-----|--------|
| `src/app/api/admin/mfa/verify/route.ts` | NY: Server-side verify med rate limiting + AdminAuditLog |
| `src/app/api/admin/mfa/verify/route.test.ts` | NY: Tester |
| `src/app/admin/mfa/verify/page.tsx` | ÄNDRA: Anropa ny server-route istf direkt Supabase |
| `src/app/admin/page.tsx` | ÄNDRA: Lägg till MFA-status-sektion |
| `docs/operations/admin-recovery.md` | NY: Återställningsdokumentation |

### Approach

**Step 1 — Server-side verify endpoint** (RED → GREEN):
- `POST /api/admin/mfa/verify` med `{ factorId, challengeId, code }` 
- Rate limiter `rateLimiters.mfa` (3 fail → 15 min) FÖRE Supabase-anrop
- Om lyckad: `AdminAuditLog.create({ action: "mfa_verify_success" })`
- Om misslyckad: `AdminAuditLog.create({ action: "mfa_verify_failure" })` + räkna fel

**Step 2 — Uppdatera verify-sidan** att anropa server-route istf klient-Supabase direkt.

**Step 3 — Admin-dashboard** — visa MFA-status (enrolled/not enrolled, länk till setup).

**Step 4 — admin-recovery.md** — skapa dokument.

## Risker

- Rate limiter-nyckeln behöver vara per-user, inte per-IP (admin kan byta IP)
- AdminAuditLog `userId` och `userEmail` måste hämtas från session i server-route
- Kllient-sidan anropar idag direkt Supabase — anrop till ny server-route istf
