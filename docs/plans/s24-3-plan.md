---
title: "S24-3: Snabba sakerhetsfixar"
description: "Haiku alias, cron x-vercel-signature, CSP report-to"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Fix 1 Haiku alias
  - Fix 2 Cron signature
  - Fix 3 CSP report-to
---

# S24-3: Snabba sakerhetsfixar

## Fix 1: Haiku daterat modell-ID

Byt `claude-haiku-4-5-20251001` till `claude-haiku-4-5` i VoiceInterpretationService.ts rad 271.
Uppdatera testet (rad 551).

## Fix 2: Cron x-vercel-signature

Vercel skickar `x-vercel-signature` header med HMAC-SHA256 av request body signerad med CRON_SECRET.
Lar till verifiering som komplement till Authorization-headern i bada cron-routes.

Filer: `src/app/api/cron/send-reminders/route.ts`, `src/app/api/cron/booking-reminders/route.ts`.

Approach: Skapa shared helper `verifyCronAuth` i `src/lib/cron-auth.ts`.

## Fix 3: CSP report-to

Lagg till `report-uri` och `report-to` directives i CSP-headern.
Sentry DSN-baserad report-URI. Lagg aven till `Report-To` header (Reporting API).

Filer: `next.config.ts`.
