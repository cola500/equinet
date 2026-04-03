---
title: "S12-1 Done: Supabase Auth login-sida"
description: "Ny login-sida med Supabase signInWithPassword bakom feature flag"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S12-1 Done: Supabase Auth login-sida

## Acceptanskriterier

- [x] Ny login-sida pa `/supabase-login` med `signInWithPassword`
- [x] Feature flag gate -- `supabase_auth_poc` av = redirect till `/login`
- [x] Success -> redirect till dashboard
- [x] Felhantering: ogiltig inloggning, overifierad email, ovantade fel
- [x] 7 tester grona

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (feature flag gate, inga secrets, error handling)
- [x] Unit tests skrivna FORST (7 tester)
- [x] Feature branch, alla tester grona
- [x] Code review: godkand (inga blockers/majors, minors fixade)

## Avvikelser

- **3 filer istallet for 2**: Planen listade `page.tsx` + `page.test.tsx`, men implementationen
  kraver en separat `SupabaseLoginForm.tsx` (Client Component) fran `page.tsx` (Server Component
  for feature flag gate). Korrekt RSC-separation.

## Lardomar

- **Server/Client Component-split obligatorisk**: Feature flag gate (`isFeatureEnabled`) ar
  server-side, formularet ar client-side. Kan inte vara i samma fil med `"use client"`.
- **Supabase browser client enkel**: `signInWithPassword` hanterar allt i ett anrop -- inget
  pre-check steg som NextAuth-versionen behover.
- **Svenska tecken**: Glom inte a, a, o i UI-strangar! Fangades i code review.
