---
title: "S48-1 Done: Miljö-hardening"
description: "Staging-URL, iOS staging-scheme, .env-städning, status-script, environments.md"
category: guide
status: active
last_updated: 2026-04-20
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S48-1 Done: Miljö-hardening

## Acceptanskriterier

- [x] Staging-deployment: `equinet-git-staging-cola500.vercel.app` (stabil Vercel branch-URL för `staging`-branchen)
- [x] iOS staging-scheme pekar rätt URL (separerade `.staging` från `.production` i AppConfig.swift)
- [x] `npm run status` visar aktiv miljö tydligt (grön "lokal", gul "supabase-remote", röd varning)
- [x] `environments.md` skapad — miljömatris, hierarki, iOS-scheman, staging-deploy
- [x] `.env.example` uppdaterad — Docker borttaget, hierarki förklarad, staging-kommentar

**Not om staging-URL:** Sprint-dokumentet antog `equinet-staging.vercel.app` (custom alias, Vercel Pro).
Vercel Hobby har inte custom aliases. Stabil branch-preview-URL (`equinet-git-staging-cola500.vercel.app`)
uppfyller samma syfte utan extra kostnad och är dokumenterat i environments.md.

## Definition of Done

- [x] Inga TypeScript-fel (`npm run check:all` 4/4 grön)
- [x] Säker (inga känsliga data exponerade)
- [x] Scripts testade: `npm run status` visar korrekt miljö
- [x] Feature branch (`feature/s48-1-miljo-hardening`)

## Reviews körda

- [x] code-reviewer — Granskade alla 5 filer. Important: enkla citationstecken ej hanterade i `tr -d` (fixat), `env-status.sh` refererade Docker (fixat). Inga kritiska problem.
- [x] ios-expert — AppConfig.swift-separation godkänt. Minor: lägg till kommentar om GitHub-användarnamn i URL (fixat). Inga övriga konsekvenser.
- [ ] tech-architect — ej tillämplig (dokumentation + konfiguration, ingen ny arkitektur)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] security-reviewer — ej tillämplig (inga auth-ändringar)

## Docs uppdaterade

- [x] `docs/guides/environments.md` — skapad (ny fil)
- [x] `docs/guides/gotchas.md` — Gotcha #23 uppdaterad med DATABASE_URL-fokus
- [x] `.env.example` — hierarki + staging-kommentar, Docker borttaget
- Ingen README/NFR-uppdatering (intern dev-tooling, ej synlig för slutanvändare)

## Verktyg använda

- Läste `docs/architecture/patterns.md` vid planering: nej (config/scripting, inte i patterns)
- Kollade `code-map.md` för att hitta filer: nej (kände till filerna från sprint-dokumentet)
- Hittade matchande pattern: nej

## Arkitekturcoverage

Plan: `docs/plans/s48-1-plan.md`. Alla planerade delar implementerade.
Avvikelse: Staging-URL är branch-preview (gratis) istället för custom alias (Pro) — dokumenterat.

## Modell

claude-sonnet-4-6

## Lärdomar

**Vercel Hobby vs Pro alias:** `equinet-staging.vercel.app` kräver Pro custom domains/aliases.
Vercel Hobby ger gratis stabil branch-preview-URL per branch — funkar lika bra för interna ändamål.

**`env-status.sh` vs `status.sh` dualism:** Projektet hade två överlappande status-scripts.
`env-status.sh` refererade Docker (borttaget S17-7). Fixades vid tillfälle. Framöver: håll scripts synkroniserade.

**`tr -d '"'` hanterar inte enkla citationstecken:** Bash-quoting i .env-filer kan vara `"val"` eller `'val'`.
Använd `tr -d "\"'"` för att hantera båda.
