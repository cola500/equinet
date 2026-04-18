---
title: "S26-2: accept-invite affarslogik till AuthService"
description: "Flytta affarslogik fran accept-invite route till AuthService med BDD dual-loop"
category: plan
status: active
last_updated: 2026-04-13
sections:
  - Analys
  - Approach
  - Filer
  - Risker
---

# S26-2: accept-invite affarslogik till AuthService

## Analys (fran research-agent)

`src/app/api/auth/accept-invite/route.ts` har 4 logikblock som hor hemma i AuthService:
1. Token-uppslag med user-join (rad 54-70)
2. Token-validering: not found / used / expired (rad 72-91)
3. Supabase update-or-create med email_confirm:true (rad 94-120)
4. Atomisk DB-transaktion: user upgrade + token markerad (rad 123-136)

AuthService har redan identiskt monster for `verifyEmail` och `resetPassword`.

## Approach

### Steg 1: Repository-utvidgning
- Lagg till `CustomerInviteTokenWithUser` typ i IAuthRepository
- Lagg till `findCustomerInviteToken(token)` och `acceptInvite(userId, tokenId)` metoder
- Implementera i PrismaAuthRepository och MockAuthRepository

### Steg 2: AuthService.acceptInvite
- Ny metod: `acceptInvite(token, password): Result<AcceptInviteResult, AuthError>`
- Ny error-typ: `ACCOUNT_ACTIVATION_FAILED`
- Utvidga `SupabaseAdminAuth.updateUserById` att stodja `email_confirm`

### Steg 3: Route delegation
- Route behaller: feature flag, rate limiting, JSON-parsing, Zod-validering
- Route delegerar till `createAuthService().acceptInvite(token, password)`
- Anvand `mapAuthErrorToStatus()` for error-mapping

## Filer

| Fil | Andring |
|-----|---------|
| `src/infrastructure/persistence/auth/IAuthRepository.ts` | Ny typ + 2 metoder |
| `src/infrastructure/persistence/auth/PrismaAuthRepository.ts` | Implementera |
| `src/infrastructure/persistence/auth/MockAuthRepository.ts` | Implementera |
| `src/domain/auth/AuthService.ts` | Ny metod + utvidga SupabaseAdminAuth |
| `src/domain/auth/AuthService.test.ts` | Unit-tester for acceptInvite |
| `src/domain/auth/mapAuthErrorToStatus.ts` | Ny error-typ |
| `src/app/api/auth/accept-invite/route.ts` | Delegera till service |

## Risker

- SupabaseAdminAuth.updateUserById maste utvidgas med `email_confirm` -- bryter ej befintliga anrop (optional field).
- Befintliga tester i route.test.ts mockar Prisma direkt. Vi byter INTE testfil, bara lagger till nya service-tester.
