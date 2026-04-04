---
title: "S15-3 Done: Byt Vercel env"
description: "Vercel Production pekar nu helt pa prod Supabase-projekt"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S15-3 Done: Byt Vercel env

## Acceptanskriterier

- [x] NEXT_PUBLIC_SUPABASE_URL pekar pa prod (redan korrekt)
- [x] NEXT_PUBLIC_SUPABASE_ANON_KEY uppdaterad till prod
- [x] SUPABASE_SERVICE_ROLE_KEY pekar pa prod (redan korrekt)
- [x] DATABASE_URL + DIRECT_DATABASE_URL behalles (redan prod)
- [x] Redeploy till produktion
- [x] Login fungerar pa equinet-app.vercel.app
- [x] Custom claims (userType, providerId, isAdmin) i JWT

## Definition of Done

- [x] Fungerar som forvantat
- [x] Saker (inga credentials exponerade)
- [x] Docs uppdaterade (.env.supabase kompletterad med ANON_KEY)

## Reviews

- Kordes: code-reviewer (enda relevanta -- config-andring, ingen ny kod)

## Avvikelser

- Bara 1 av 4 Supabase-env-variabler behovde andras (ANON_KEY).
  Ovriga pekade redan pa prod -- troligen fran tidigare Vercel CLI `env pull`.
- ANON_KEY var fran PoC (zzdamokfeenencuggjjp), resten fran prod (xybyzflfxnqqyxnvjklv).

## Lardomar

1. **Verifiera ALLA env-variabler individuellt**: Bara for att URL:en pekar ratt
   betyder inte att alla nycklar gor det. ANON_KEY och SERVICE_ROLE_KEY ar
   projektspecifika -- de maste matcha URL:en.

2. **`vercel env add` laser fran stdin**: Piping `echo VALUE | vercel env add NAME`
   fungerar for att undvika interaktiv prompt i non-TTY.

3. **JWT decode for verifiering**: Dekodera ANON_KEY:s payload (`ref`-falt)
   for att verifiera vilken Supabase-instans den tillhor.
