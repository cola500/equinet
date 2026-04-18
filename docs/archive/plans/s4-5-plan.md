---
title: "S4-5: Demo-data prod"
description: "Verifiera och dokumentera demo-setup mot prod (Vercel + Supabase)"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Uppgifter
  - Risker
---

# S4-5: Demo-data prod

## Bakgrund

Demo körs mot prod-URL (equinet-app.vercel.app). Supabase-databasen har redan data.
Uppgiften är att verifiera att datan räcker för en demo och dokumentera exakt setup.

## Uppgifter

1. **Verifiera prod-data via Supabase MCP** -- kolla att demo-leverantören finns med kunder, bokningar, tjänster
2. **Sätt NEXT_PUBLIC_DEMO_MODE=true på Vercel** (Production env) om det inte redan är satt
3. **Verifiera demo-flödet på equinet-app.vercel.app** -- login, dashboard, bokningar, kunder, tjänster
4. **Uppdatera demo-mode.md** med prod-specifika steg och korrekt inloggningsinfo
5. **Uppdatera sprint-4.md** med demo-checklista för prod

## Filer som ändras

- `docs/demo-mode.md` -- lägg till prod-sektion
- `docs/sprints/status.md` -- uppdatera story-status
- `docs/sprints/sprint-4.md` -- uppdatera demo-checklista

## Risker

- Prod-datan kan vara otillräcklig (inga completed-bokningar, inga kunder) -- i så fall behöver vi seeda
- Demo-seed-scriptet är designat för lokal DB -- att köra mot Supabase kräver att vi byter DATABASE_URL tillfälligt, vilket är riskabelt
