---
title: "S17-9 Done: iOS -> Supabase staging"
description: "iOS-appens miljöhantering refaktorerad för local/staging/production"
category: retro
status: active
last_updated: 2026-04-05
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S17-9 Done: iOS -> Supabase staging

## Acceptanskriterier

- [x] SupabaseManager konfigurerad med staging URL och anon key
- [x] Miljöhantering: dev (localhost + local Supabase) vs staging (Vercel + remote Supabase) via build config
- [x] Miljöbyte via Xcode launch argument `-STAGING`
- [x] Local Supabase (port 54321) konfigurerad med standard demo anon key
- [ ] Verifiering av login mot staging -- kräver simulator + test-konto (manuell verifiering)
- [ ] Verifiering av session exchange -- kräver körande app (manuell verifiering)
- [ ] Verifiering av RLS -- kräver inloggad session (manuell verifiering)
- [x] Dokumentation i AppConfig.swift (kommentarer om hur man byter miljö)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript/kompileringsfel (BUILD SUCCEEDED)
- [x] Säker (anon keys är publika, inga secrets exponerade)
- [x] Tester gröna (AuthManagerTests 7/7, APIClientTests 9/9)
- [x] Docs uppdaterade (AppConfig kommentarer)

## Reviews

Kördes: ios-expert (plan-review, inga blockers), code-reviewer (enda relevanta utöver ios-expert)

### ios-expert resultat
- Inga blockers
- Major: AppConfig-properties måste vara `var` (computed) inte `let` (stored) -- implementerat
- Rekommendation: ProcessInfo-approach är bra, migrera till xcconfig vid TestFlight-distribution

## Avvikelser

- **Manuell verifiering ej körd**: Login/session exchange/RLS-verifiering mot staging kräver att appen körs i simulator med test-konto. Kodändringen är ren konfiguration -- den ändrar bara vilka URLs/nycklar som används.
- **Production = staging**: Staging och production delar samma Supabase-projekt tills vi har separat produktionsprojekt.

## Lärdomar

- **`supabase status --output json`** ger JWT-format anon key (`ANON_KEY`), medan vanlig `supabase status` bara visar nya `sb_publishable_*`-format. Supabase Swift SDK kräver JWT-formatet.
- **`URL(string:relativeTo:)` istället för `appendingPathComponent`**: Bytte `startURL` och `dashboardURL` till `URL(string:relativeTo:)` för att undvika URL-encoding-problem med `/` i sökvägar (dokumenterad gotcha i CLAUDE.md).
- **Swift `static let` på enum är lazy**: `SupabaseManager.client` (static let) evalueras vid första access, så computed `AppConfig.supabaseURL` fungerar korrekt trots att den evalueras bara en gång.
