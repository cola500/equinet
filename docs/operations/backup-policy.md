---
title: "Backup-policy och Disaster Recovery"
description: "RPO/RTO, backup-strategi och restore-steg for Equinet"
category: operations
status: active
last_updated: 2026-04-02
sections:
  - Oversikt
  - Supabase automatiska backups
  - Manuell backup
  - Restore-process
  - Vad som INTE inkluderas
  - Rekommendationer
---

# Backup-policy och Disaster Recovery

## Översikt

| Mett | Varde | Kommentar |
|------|-------|-----------|
| **RPO** (Recovery Point Objective) | 24h (daglig backup) | 2 min med PITR-addon |
| **RTO** (Recovery Time Objective) | ~10-30 min | Beror pa databasstorlek |
| **Backup-metod** | Automatisk daglig (Supabase) | Manuell via CLI som komplement |
| **Nuvarande plan** | Free tier | Uppgradera till Pro vid produktion |

## Supabase automatiska backups

Supabase kor dagliga backups automatiskt for alla planer:

| Plan | Retention | PITR |
|------|-----------|------|
| **Free** | Ej specificerad | Ej tillgänglig |
| **Pro** | 7 dagar | Tillval (2 min RPO) |
| **Team** | 14 dagar | Tillval (2 min RPO) |
| **Enterprise** | 30 dagar | Tillval (2 min RPO) |

### PITR (Point-in-Time Recovery)

Tillval for Pro+ planer. Ger sekundprecision vid restore.

- RPO: 2 minuter (worst case)
- WAL-filer sparas var 2:a minut, oftare vid hog last
- Retentionsalternativ: 7, 14 eller 28 dagar
- Krav: Minst Small compute-addon

## Manuell backup (CLI)

For komplement till automatiska backups, sarskilt pa free tier:

```bash
# Logisk dump av hela databasen
supabase db dump -f backup-$(date +%Y%m%d).sql

# Prisma-specifik: exportera schema + data
npx prisma db execute --url "$DATABASE_URL" --stdin <<< "..."
```

**Rekommendation:** Kor `supabase db dump` fore varje deploy och vid
schemaandringar. Spara lokalt och/eller i privat git-repo.

## Restore-process

### Fran Supabase Dashboard

1. Ga till **Project Settings > Database > Backups**
2. Valj backup-punkt (datum eller PITR-tidpunkt)
3. Bekrafta i dialogen
4. **Projektet blir otillgangligt under restore** (minuter, beror pa storlek)
5. WAL-filer replays till vald tidpunkt (PITR)
6. Notifikation vid komplett

### Fran CLI-dump

```bash
# Aterskapa fran dump-fil
psql "$DATABASE_URL" < backup-20260402.sql
```

### Viktiga steg efter restore

- [ ] Aterstall custom role-lösenord (sparas INTE i backup)
- [ ] Aterskapa replication slots/subscriptions om de användes
- [ ] Verifiera att appen fungerar (smoke test)
- [ ] Kontrollera att migrationer ar i sync (`npm run migrate:status`)

## Vad som INTE inkluderas i backup

| Vad | Inkluderat? | Åtgärd |
|-----|-------------|--------|
| Databas (tabeller, index) | Ja | Automatiskt |
| Prisma-migrationshistorik | Ja | Automatiskt |
| Storage API-objekt (filer) | **Nej** | Separat backup vid behov |
| Custom role-lösenord | **Nej** | Dokumentera separat |
| Environment variables | **Nej** | Finns i Vercel + `.env` |
| Edge Functions | **Nej** | Finns i git |

## Rekommendationer

### Nu (Free tier)

1. **Kor `supabase db dump` fore varje deploy** -- sparar lokal kopia
2. **Prisma-migrationer i git** -- schemat kan alltid aterskapas fran kod
3. **Seed-script** -- testdata kan aterskapas med `npx tsx prisma/seed.ts`
4. **Slot machine** -- staging-schema i separat Supabase-projekt, noll risk for prod

### Vid skalning (Pro tier)

1. **Uppgradera till Pro** -- 7 dagars retention, dashboardrestore
2. **Aktivera PITR** -- 2 min RPO om verksamheten kraver det
3. **Automatisera CLI-dump** -- cron-jobb eller GitHub Action dagligen
4. **Testa restore kvartalsvis** -- verifiera att processen fungerar
