---
title: "Handlingsplan: Forhindra migration drift"
description: "Rotorsaksanalys och atgarder for att Prisma-migrationer aldrig hamnar ur synk med Supabase prod"
category: plan
status: wip
last_updated: 2026-04-05
sections:
  - Rotorsaksanalys
  - Vad som hande
  - Atgarder
  - Verifieringsrutin
---

# Handlingsplan: Forhindra migration drift

## Rotorsaksanalys (5 Whys)

**Symptom:** 5 Prisma-migrationer fanns lokalt men var inte registrerade pa Supabase prod.

1. **Varfor var de inte registrerade?** Migrationerna applicerades manuellt via SQL Editor/`supabase db query` men registrerades aldrig i `_prisma_migrations`.
2. **Varfor registrerades de inte?** Det finns inget steg i workflowen som TVINGAR registrering efter manuell SQL-applicering.
3. **Varfor applicerades de manuellt?** Prisma-migrationer med ren SQL (RLS-policies, pg_cron) kan inte koras via `prisma migrate deploy` mot Supabase pooler -- de maste pipas via `supabase db query`.
4. **Varfor finns inget verifieringssteg?** `npm run migrate:status` existerar men kor namnbaserad jamforelse -- den kollar inte att ALLA lokala migrationer finns pa remote.
5. **Varfor kor vi inte migrate:status automatiskt?** Det ar inte en del av deploy-flowet eller pre-push-hooken.

**Rotorsak:** Inga automatiserade guardrails som fangar drift mellan lokalt och remote.

## Vad som hande (2026-04-05)

| Migration | Vad som saknades | Konsekvens |
|-----------|-----------------|------------|
| `rls_read_policies` | Redan applicerad manuellt i S14, ej registrerad | Ingen -- schemat stammer |
| `rls_write_policies` | Redan applicerad manuellt i S14, ej registrerad | Ingen -- schemat stammer |
| `auth_hook_rls_policies` | Aldrig applicerad | Auth hook kunde inte lasa User/Provider via RLS |
| `user_read_policies` | Aldrig applicerad | Supabase-klient kunde inte JOINa User-data |
| `admin_audit_log` | Aldrig applicerad | AdminAuditLog-tabell saknades i prod |
| `sync_trigger_auth_users` (failed) | Misslyckad post kvar | Oreda i _prisma_migrations |

**Alla fixade:** 3 migrationer applicerade, 5 registrerade, 1 failed-post borttagen.

## Åtgärder

### 1. OBLIGATORISK: Ny done-fil-checklista (omedelbart)

Lagg till i `.claude/rules/autonomous-sprint.md` och done-fil-mallen:

```
- [ ] Migration applicerad pa Supabase prod (`supabase db query --linked`)
- [ ] Registrerad i _prisma_migrations (INSERT eller `prisma migrate resolve`)
- [ ] `npm run migrate:status` visar inga pending
```

### 2. OBLIGATORISK: migrate:status i sprint-avslut (omedelbart)

`npm run migrate:status` kor redan namnbaserad jamforelse. Lagg till som BLOCKERANDE gate i sprint-avslut (`.claude/rules/autonomous-sprint.md` Sprint-gates).

### 3. BOR: Forbattra migrate:status-skriptet (nasta sprint)

Nuvarande `migrate:status` jamfor namn men verifierar inte att ALLA lokala migrationer finns pa remote. Forbattra:

```bash
# Hamta lokala migrationsnamn
local=$(ls prisma/migrations/ | grep -v migration_lock.toml | sort)

# Hamta remote migrationsnamn
remote=$(echo "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;" | npx supabase db query --linked | jq -r '.rows[].migration_name' | sort)

# Diff
diff <(echo "$local") <(echo "$remote")
```

Om diff ger output -> VARNING med lista over saknade.

### 4. BOR: Pre-deploy guardrail (nasta sprint)

Utoka `npm run deploy` att:
1. Kora `migrate:status` (forbattrad version)
2. BLOCKERA deploy om pending migrationer finns
3. Visa tydligt: "Applicera forst: <lista>"

### 5. OVERVÄG: Byt till Supabase-migrationer (langsiktigt)

Prisma-migrationer i `prisma/migrations/` och Supabase-migrationer i `supabase/migrations/` ar tva separata system. Ren SQL (RLS, pg_cron, triggers) passar battre i `supabase/migrations/` som kan koras via `supabase db push`. Schema-ändringar (modeller) forblir i Prisma.

**Risk:** Tva migrationssystem okar komplexitet. Beslut kravs fran lead.

## Verifieringsrutin

**Efter varje migration-applicering:**
```bash
npm run migrate:status    # Visa lokalt vs remote
```

**Vid sprint-avslut:**
```bash
echo 'SELECT count(*) as total, count(finished_at) as ok, count(*) - count(finished_at) as failed FROM "_prisma_migrations";' | npx supabase db query --linked
```

**Forvantad output:** `total` = antal lokala migrationsmappar, `failed` = 0.
