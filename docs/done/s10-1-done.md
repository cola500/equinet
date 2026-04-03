---
title: "S10-1 Done: RLS Slice -- Booking READ"
description: "Resultat av RLS research spike med Prisma + set_config"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S10-1 Done: RLS Slice -- Booking READ

## Acceptanskriterier

- [x] RLS-policy aktiv pa Booking i rls_test
- [x] Prisma + set_config i transaktion testad (Test 1)
- [x] Negativ-test: utan set_config returnerar 0 rader (Test 2)
- [ ] PgBouncer testad -- **AVVIKELSE**: Supabase-pooler blockerar SET ROLE (se nedan)
- [x] Raw query testad (Test 4)
- [x] Prestanda matt (Test 5: 1.1ms overhead)
- [x] Research-dokument med Go/No-go (docs/research/rls-prisma-spike.md)

### Tillagda tester (utover plan)

- [x] Test 6: Session-lackage -- ingen lackage mellan transaktioner
- [x] Test 7: Concurrent access -- parallella transaktioner isolerade
- [x] Test 8: Ingen-policy-fallback -- tabell utan policy = 0 rader (deny-by-default)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (isolerat rls_test-schema, ingen prod-data berord)
- [x] Tester skrivna och grona (8/8)
- [x] Docs uppdaterade (rls-prisma-spike.md)

## Avvikelser

### PgBouncer-test (acceptanskriterium 4)

PgBouncer-testet kunde inte genomforas som planerat. Supabase-poolern (Supavisor)
blockerar `SET ROLE` med `permission denied`. Custom roller kan inte heller ansluta
direkt via poolern. Ersattes med Test 3 (separat Prisma-klient) som verifierar
att monster fungerar pa fräscha connections.

### Slot machine vs lokal Docker

Spike:n planerades for slot machine (separat Supabase-projekt). Begransningarna
i Supabase-poolern (BYPASSRLS pa postgres, SET ROLE blockerat) gjorde att vi
korde alla tester mot lokal Docker istallet. Resultatet ar giltigt --
PostgreSQL-beteendet ar identiskt -- men Supabase-specifika begransningar
ar dokumenterade som blockerare i resultatdokumentet.

## Lardomar

### 1. Supabase postgres = BYPASSRLS, inte superuser

I Supabase ar `postgres` inte superuser men har `BYPASSRLS = true`.
Det gor att RLS-policies ALDRIG appliceras for postgres-rollen, aven med
`FORCE ROW LEVEL SECURITY`. FORCE paverkar bara table owner, inte BYPASSRLS-roller.

**Gotcha for framtiden:** Test RLS mot icke-BYPASSRLS-roll fran start.

### 2. SET ROLE blockeras av Supavisor

Supabase-poolern (Supavisor) tillater inte `SET ROLE` for `postgres`-rollen.
Custom roller kan inte ansluta alls via poolern. Det gor att det lokalt
fungerande monster (`SET ROLE` + `set_config` i transaktion) inte fungerar
mot Supabase utan anpassning.

**Gotcha for framtiden:** Testa alltid mot faktisk Supabase-miljo tidigt i spiket.

### 3. Deny-by-default ar kritiskt

Test 8 bekraftade att `ENABLE + FORCE ROW LEVEL SECURITY` utan policy = 0 rader.
Det ar bra for sakerhet (en glomd policy exponerar INTE data) men katastrofalt
om FORCE aktiveras utan wrapper (alla queries returnerar 0 = applikationskrasch).

**Rekommendation:** FORCE far ALDRIG aktiveras utan att wrapper ar pa plats och verifierad.

### 4. 1.1ms overhead ar acceptabelt

SET ROLE + set_config i transaktion adderar ~1.1ms per query lokalt.
I produktion (50ms natverkslatens) ar det forsumbart.
