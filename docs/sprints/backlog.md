---
title: "Produktbacklog"
description: "Alla kända stories och uppgifter, speglar roadmap.md. Plockas in i sprintar vid behov."
category: sprint
status: active
last_updated: 2026-04-02
tags: [backlog, roadmap, planning]
sections:
  - Blockerare
  - Konfiguration
  - iOS-migrering
  - Kvalitet och säkerhet
  - Betalning
  - Features som kräver arbete
  - Research
---

# Produktbacklog

> Speglar `docs/roadmap.md`. Plockas in i sprintar vid behov.
> Prioritetsordning inom varje kategori.

## Blockerare (väntar på Johan)

| Story | Blockerare | Effort |
|-------|-----------|--------|
| Push live (APNs) | Apple Developer 99 USD | Config, 15 min |
| Stripe live-mode | Stripe företagsverifiering | Config, 15 min |
| Swish aktivering | Stripe företagsverifiering | 1 rad kodändring |

## Konfiguration (snabba vinster)

| Story | Effort | Beroende |
|-------|--------|----------|
| Voice logging polish (S7-5) | 0.5-1 dag | Inget |
| Sonnet 4.5 -> 4.6 uppgradering | 1 rad | Inget |
| Preview-miljö ANTHROPIC_API_KEY | 1 min | Johan |
| Stripe payments flagga på | 1 min | Johan (efter demo) |

## iOS-migrering (6 kvarvarande provider WebView-skärmar)

| Skärm | Bakom flagga | Komplexitet | Beroende |
|-------|-------------|-------------|----------|
| Röstloggning | voice_logging | Hög (Speech + AI) | Inget (fungerar) |
| Annonsering | route_announcements | Medel | Inget |
| Due-for-service | - | - | KLAR (sprint 4) |
| Business insights | business_insights | Medel (Recharts) | Inget |
| Ruttplanering | route_planning | Hög (Mapbox/OSRM) | Mapbox-token |
| Gruppbokningar | group_bookings | Hög | Inget |
| Hjälpcentral | help_center | Låg | Inget |

**Kundskärmar (alla WebView):** Bokningar, hästar, gruppbokningar, profil, FAQ, hjälp, export.

## Kvalitet och säkerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| RLS Fas 2: tunn vertikal slice (Booking + Supabase-klient) | 2-3 dagar | Innan leverantör #2 |
| RLS Fas 3: opportunistisk migrering per domän | Löpande | Vid behov |
| Legacy docs svenska tecken (325 rader) | 0.5 dag | Låg |
| E2E: fixa 77 skippade tester | 1-2 veckor | Låg |
| recurring_bookings E2E-verifiering | 1 dag | Medel |
| group_bookings E2E + UX-review | 2-3 dagar | Medel |
| Confirm-route migrering till withApiHandler | 30 min | Låg (opportunistiskt) |
| withApiHandler resterande routes (131 st) | Löpande | Opportunistiskt |
| console.* i legacy docs | 0.5 dag | Låg |

## Betalning

| Story | Effort | Beroende |
|-------|--------|----------|
| Swish i Payment Element | 1 rad + test | Stripe företagsverifiering |
| Provider subscription (monetarisering) | 1-2 veckor | Prissbeslut |
| Fortnox-integration (fakturering) | 2-3 veckor | Fortnox API-access |

## Features som kräver arbete innan lansering

| Flagga | Problem | Effort |
|--------|---------|--------|
| customer_insights | AI-koppling overifierad (samma mönster som voice logging) | Research 1 dag + ev. integration |
| route_planning | Kräver Mapbox-token | Mapbox-konto + token + verifiering 1-2 dagar |
| route_announcements | Beroende av route_planning | Löses med route_planning |
| business_insights | Behöver realistisk data | Polish + seed-data 1-2 dagar |
| offline_mode | Komplex, inga E2E-tester | E2E + stabilisering 1-2 veckor |
| follow_provider | Värde vid volym | Verifiering vid skalning |
| municipality_watch | Värde vid volym | Verifiering vid skalning |
| stable_profiles | Aldrig testad i prod | Beslut: behålla eller ta bort? |

## Research

| Ämne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) -- rekommendation: fas 1-4 |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) -- fungerar |
| Swish integration | Klar -- Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Customer insights AI-koppling | EJ GJORD -- samma frågor som voice logging |
