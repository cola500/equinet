---
title: "S4-5: Demo-data prod -- Done"
description: "Verifierat och dokumenterat demo-setup mot produktion"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S4-5: Demo-data prod -- Done

## Acceptanskriterier

- [x] Demo-miljo beslutad och dokumenterad -- prod (equinet-app.vercel.app)
- [x] Seed-data verifierad i vald miljo

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (validering, error handling, ingen XSS/SQL injection) -- ingen kodandring
- [x] Docs uppdaterade (demo-mode.md)

## Vad som gjordes

1. **Verifierade prod-data** -- Supabase hade 6 providers men 0 bokningar/tjanster/kunder
2. **Korde seed-demo.ts mot Supabase** -- skapade realistisk demo-data:
   - 4 kunder (Anna, Erik, Sofia, Johan)
   - 3 hästar (Storm, Saga, Bella)
   - 4 tjänster (Hovslagning, Hovvard, Ridlektion, Halsokontroll)
   - 8 bokningar (2 bekraftade, 1 pending, 4 genomförda, 1 avbokad)
   - 3 recensioner (snitt 4.7)
3. **Satte NEXT_PUBLIC_DEMO_MODE=true pa Vercel** (Production env)
4. **Triggade redeploy** -- `vercel deploy --prod`, bekraftade fra1-region
5. **Verifierade via API** -- health, login, dashboard, services, customers fungerar
6. **Uppdaterade demo-mode.md** -- prod-flode, korrekta inloggningsuppgifter, datatabell

## Avvikelser

- Ingen kodandring -- bara data-seeding, env-var och dokumentation
- Gammal "Hovslagning Standard"-tjänst deaktiverades (hade FK-constraints, kunde inte raderas)

## Lardomar

- **Prod-data var tom**: Trots att Supabase-databasen funnits lange var all meningsfull data bara lokalt. Seeding mot prod bor goras tidigt i processen.
- **seed-demo.ts fungerade direkt mot Supabase**: Bara behov ovverridea DATABASE_URL i terminalen. Scriptet ar redan idempotent tack vare upserts och existens-checkar.
- **NEXT_PUBLIC_*-variabler kraver rebuild**: Att lagga till env-var pa Vercel racker inte -- deployen maste triggras for att variabeln ska baka in i klient-koden.
- **fra1-region bekraftad**: `x-vercel-id: iad1::fra1::...` -- build-servern ar i USA men funktionerna kors i Frankfurt. vercel.json `regions: ["fra1"]` fungerar.
