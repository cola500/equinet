---
title: "S27-5: GDPR data retention policy + cron"
description: "Policy-dokument + cron-job for automatisk radering av inaktiva konton"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Approach
  - Filer som skapas
  - Filer som andras
  - Risker
---

# S27-5: GDPR data retention policy + cron

## Approach

### Inaktivitetsdetektion

User-modellen saknar `lastLoginAt`. Istallet anvander vi Supabase Auth admin API:
`supabase.auth.admin.listUsers()` returnerar `last_sign_in_at` per anvandare.

Vi matchar auth.users mot public.User via email for att hitta inaktiva konton.

### Flode

1. Cron-job kor manatligen (GET /api/cron/data-retention)
2. Feature flag `data_retention` (default off) gatar
3. Hamtar alla auth-anvandare med `last_sign_in_at` > 2 ar sedan
4. For varje: kolla om redan notifierad (ny `DataRetentionNotice`-tabell)
5. Om inte notifierad: skicka varning, spara notice med 30d grace period
6. Om notifierad och grace period passerad: radera via AccountDeletionService

### Varfor INTE schema-andring

- `lastLoginAt` pa User kraver migration + synkronisering med Supabase Auth
- Supabase Auth redan har `last_sign_in_at` -- single source of truth
- Cron-job kor en gang/manad -- performance ar inte en faktor

### DataRetentionNotice

Ny Prisma-modell for att tracka notifieringar:

```prisma
model DataRetentionNotice {
  id        String   @id @default(uuid())
  userId    String
  email     String
  notifiedAt DateTime @default(now())
  gracePeriodEndsAt DateTime
  status    String   @default("notified") // notified | deleted | cancelled

  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId])
}
```

**Beslut: skippa schema-andring.** DataRetentionNotice kraver en Prisma-migration som ar overscope for denna story (schema-andringar ar sekventiella, blockerar andra sessions). Istallet anvander vi en **in-memory approach** for MVP:

- Cron-job loggar vilka anvandare som notifierats
- Forsta korningen: notifiera alla inaktiva
- Andra korningen (30+ dagar senare): radera de som fortfarande ar inaktiva
- Tracking via Supabase `app_metadata` pa auth-anvandaren: `{ data_retention_notified_at: ISO-date }`

### Domain service

`DataRetentionService` i `src/domain/data-retention/`:
- `findInactiveUsers(thresholdDate)` -- via Supabase admin API
- `notifyInactiveUser(user)` -- skicka varningsmail
- `deleteInactiveUser(userId)` -- delegera till AccountDeletionService (without password verification)

### TDD-ordning

1. RED: DataRetentionService.findInactiveUsers
2. RED: DataRetentionService.notifyInactiveUser
3. RED: DataRetentionService.processRetention (orchestrator)
4. RED: Cron route (integration)
5. GREEN: Implementera allt
6. Policy-dokument (docs only)

## Filer som skapas

- `src/domain/data-retention/DataRetentionService.ts`
- `src/domain/data-retention/DataRetentionService.test.ts`
- `src/app/api/cron/data-retention/route.ts`
- `src/app/api/cron/data-retention/route.test.ts`
- `docs/security/data-retention-policy.md`

## Filer som andras

- `src/lib/feature-flag-definitions.ts` (ny flagga `data_retention`)
- `vercel.json` (nytt cron-schema)
- `docs/sprints/session-27-webb.md` (status-uppdatering)

## Risker

- **Supabase admin API rate limits**: listUsers kan ha pagineringsbegransningar. Hanteras med pagination.
- **Oavsiktlig radering**: Feature flag default OFF + grace period 30d + loggning.
- **AccountDeletionService kraver losenord**: Behovs en variant utan password verification for cron. Lagger till `deleteAccountBySystem()` metod.
