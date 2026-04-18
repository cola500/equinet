---
title: "S17-4: pg_cron för databasunderhåll"
description: "Supabase pg_cron-jobb för token-rensning och notifikationsrensning"
category: plan
status: wip
last_updated: 2026-04-05
sections:
  - Bakgrund
  - Analys
  - Jobb
  - Implementation
  - Risker
---

# S17-4: pg_cron för databasunderhåll

## Bakgrund

Supabase Free inkluderar pg_cron. Vi har 6 token-tabeller med `expiresAt`
som aldrig rensas, plus NotificationDelivery som växer obegränsat.

## Analys

Sprint-beskrivningen nämner "rensa rate limit-poster" men rate limiting
körs via Upstash Redis (ephemeral) -- ingen DB-tabell att rensa.

**Tabeller som behöver underhåll:**

| Tabell | Kolumner för rensning | Regel |
|--------|----------------------|-------|
| EmailVerificationToken | expiresAt, usedAt | expiresAt < NOW() - 30 dagar |
| PasswordResetToken | expiresAt, usedAt | expiresAt < NOW() - 30 dagar |
| CustomerInviteToken | expiresAt, usedAt | expiresAt < NOW() - 30 dagar |
| HorseProfileToken | expiresAt | expiresAt < NOW() - 30 dagar |
| StableInviteToken | expiresAt, usedAt | expiresAt < NOW() - 30 dagar |
| MobileToken | expiresAt, revokedAt | (expiresAt < NOW() - 30d) OR (revokedAt IS NOT NULL AND revokedAt < NOW() - 30d) |
| NotificationDelivery | createdAt | createdAt < NOW() - 90 dagar |
| Notification | isRead, createdAt | isRead = true AND createdAt < NOW() - 365 dagar |

## Jobb

### Jobb 1: Rensa utgångna tokens (dagligen, 03:00 UTC)

6 token-tabeller rensas i ett DO-block via cron.schedule().

### Jobb 2: Rensa gamla NotificationDelivery (veckovis, söndag 04:00 UTC)

### Jobb 3: Rensa gamla lästa notifikationer (veckovis, söndag 04:15 UTC)

### ~~Jobb 4: VACUUM ANALYZE~~ (BORTTAGEN)

Supabase kör autovacuum -- manuell VACUUM fungerar inte via pg_cron på managed instances.

## Implementation

1. Skapa Prisma-migration med pg_cron-jobb (raw SQL via cron.schedule)
2. Testa lokalt med `supabase start` (pg_cron ingår)
3. Dokumentera i `docs/operations/deployment.md`
4. Applicera migration på Supabase

### Filer som ändras

- `prisma/migrations/20260405100000_pg_cron_maintenance/migration.sql` (ny)
- `docs/operations/deployment.md` (ny sektion)
- `docs/sprints/status.md` (status-uppdatering)

## Risker

- **Låg:** pg_cron kör som superuser -- DELETE-statements är enkla och säkra
- **Låg:** 30 dagars grace period på tokens ger marginal om något refererar dem
- **Info:** VACUUM ANALYZE borttagen -- Supabase kör autovacuum automatiskt
