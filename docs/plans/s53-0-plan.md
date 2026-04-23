---
title: "S53-0: Demo-flöde smoke-test + pinsam-fixes"
description: "Plan för att klicka igenom hela leverantörsflödet och dokumentera/fixa akuta pinsamma fel"
category: plan
status: active
last_updated: 2026-04-23
sections:
  - Approach
  - Flöde att gå igenom
  - Fix-regel
---

# Plan: S53-0 — Demo-flöde smoke-test + pinsam-fixes

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story)
**Resultat:** N/A
**Beslut:** Fortsätt

## Approach

Audit-first story. Inga kodändringar förrän hela flödet är genomgånget och dokumenterat.

**Setup:**
- Verifiera `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local`
- Starta dev-server: `npm run dev`
- Logga in med `provider@example.com` / `ProviderPass123!`
- Använd Playwright MCP för att navigera och ta screenshots

**Filer som potentiellt ändras:**
- `src/app/provider/dashboard/page.tsx` (om UI-problem hittas)
- `src/app/provider/bookings/page.tsx` (om UI-problem hittas)
- `src/app/provider/calendar/page.tsx` (om UI-problem hittas)
- `src/app/provider/customers/page.tsx` (om UI-problem hittas)
- `src/app/provider/services/page.tsx` (om UI-problem hittas)
- `src/app/provider/profile/page.tsx` (om UI-problem hittas)
- `src/components/layout/ProviderNav.tsx` (om nav-problem hittas)
- Ev. andra komponenter beroende på fynd

**Output-filer:**
- `docs/metrics/demo-walkthrough-2026-04-23/` — screenshots per sida + findings-rapport

## Flöde att gå igenom

1. `/login` → logga in som provider
2. `/provider/dashboard` — alla kort? Stats korrekt?
3. `/provider/calendar` — render? klicka på bokning?
4. `/provider/bookings` — lista + detaljvy + messaging-tråd
5. `/provider/customers` — lista + detaljvy + anteckningar
6. `/provider/services` — lista + skapa/redigera
7. `/provider/profile` — redigera profil

## Fix-regel

- Fynd som kan fixas på <30 min → fixa direkt i denna story
- Fynd som är större → backlog-rad med repro-steg
- Alla fixes är antingen trivial (ingen subagent review) eller följa standard station 4

## Risker

- Saknas testdata (demo-leverantör) → detta förväntas, dokumenteras som "behöver S53-2"
- Hydration-warnings är kända (S53-1 är dedikerad till det)
- Fokus: pinsamma UI-fel, null crashes, tomma states som ser felaktiga ut
