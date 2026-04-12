---
title: "S6-4: RLS Spike -- Plan"
description: "Research-spike for Row Level Security i Supabase med Prisma"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Fragor att besvara
  - Approach
  - Leverans
  - Risker
---

# S6-4: RLS Spike -- Plan

## Bakgrund

Vi använder Prisma med direkt PostgreSQL-anslutning till Supabase. All
auktorisering sker i applikationslagret (session-check + ownership-check i
API routes). RLS kan ge defense-in-depth -- om en route missar en ownership-check
skyddar databasen anda.

## Fragor att besvara

1. Kan vi använde RLS med Prisma direkt-anslutning? (SET LOCAL per request?)
2. Eller kraver det Supabase-klient istallet for Prisma?
3. Kan vi ha RLS pa EN tabell (Booking) som proof-of-concept utan att migrera allt?
4. Vad ar prestanda-paverkan?
5. Hur fungerar det med serverless (connection pooling, korta sessions)?

## Approach

1. **Research** (30 min): Lasa Supabase RLS-docs, Prisma + RLS-erfarenheter,
   serverless-begransningar med PgBouncer transaction mode
2. **Analys** (30 min): Kartlagg hur Booking-tabellen anvands -- vilka queries,
   vilka roller (provider, customer, admin). Identifiera vilka policies behovs.
3. **Experiment** (valfritt, om tid finns): Testa RLS pa lokal Docker-databas
   med `SET LOCAL` i Prisma `$queryRaw`
4. **Dokumentera**: Sammanfatta fynd, rekommendation, effort-uppskattning

### Viktig teknisk fraga: PgBouncer + SET LOCAL

Supabase default ar PgBouncer i **transaction mode**. `SET LOCAL` galler bara
inom en transaction. Prisma `$transaction` + `$queryRaw('SET LOCAL ...')` borde
fungera, men detta maste verifieras.

## Leverans

- `docs/research/rls-spike.md` med fynd och rekommendation
- Ingen koddandring i main

## Risker

- PgBouncer transaction mode kanske inte stodjer `SET LOCAL` pa ratt satt
- Prisma client extensions kanske inte kan intercepta varje query med `SET LOCAL`
- RLS kan vara inkompatibelt med var Prisma-migrationssetup
