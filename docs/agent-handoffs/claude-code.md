---
title: "Claude Code – överlämning"
description: "Claude Codes tillfälliga överlämning i pågående sprint"
category: sprint
status: active
last_updated: 2026-10-16
tags: [agents, collaboration, handoff]
sections:
  - Gjort
  - Verifierat
  - Beslut eller frågor till Johan
  - Rekommenderat nästa steg
  - Rör inte
  - Relaterade filer och PR
---

# Claude Code – överlämning

**Senast uppdaterad:** 2026-10-16\
**Aktuell uppgift:** R4 – beslut och åtgärdsplan (klar)\
**Branch eller worktree:** `docs/readiness-r4`\
**Status:** väntar på Codex/Johan-granskning

## Gjort

- R4-beslutet står i sprintdokumentet: klassningen **`NOT READY`**, prioritetsnivåer, en samlad slice-lista med evidens, ägare, beroende och våg, villkoren för `READY WITH CONDITIONS` i en pilot och kopplingen till backloggen.
- Backloggen har en hänvisning till R4. "Stripe Idempotency Keys" är markerad som ersatt av C1 och "Production Monitoring" som en del av D5. `status.md` säger att R0–R4 är genomförda och att retron återstår.
- Ingen produktkod, miljö eller data ändrad.

## Verifierat

- [läst] D1 är olöst och blockerar enligt beslutsgaten alla livebetalningar. Därför är klassningen `NOT READY`, även bortsett från övriga P0-fynd.
- [läst] Prioriteringar, alla med evidens från R0–R3:
  - P0: D1, C1, C2, C3, A, D2 och D3. D2 inkluderar verifierat personuppgiftsbiträdesavtal och dataplats för Stripe. D3 är P0 för pilot, medan senare layout- och automatiseringsförbättringar är P1.
  - D5: grundlarm och runbook är P0, övriga förbättringar P1.
  - P1: C4–C7, D4, B.
  - P2: E1, E2.
- [läst] Ordningen är våg 0 (beslut), 1 (P0 utan D1), 2 (P0 med D1), 3 (P1) och 4 (P2).
- [läst] Pilotens live-gate kräver dessutom restricted Stripe keys och en formell Payment Security Review. Grundläggande D5 får **inte** ersättas av en manuell rutin. Bara kvarvarande D5-förbättringar får ha en tillfällig manuell kompensation.
- [läst] R2: API:t avvisar `pending` och en annan kunds bokning, men tillåter fortfarande felaktigt betalning vid `confirmed`. Det hanteras av C2.
- [läst] Nya slices från R1 som inte fanns tidigare är E1 (publik kundresa) och E2 (`.vercel`-driftgap).

## Beslut eller frågor till Johan

- Våg 0 behöver dina beslut: att starta extern verifiering för D1, om C3 ska förhindra eller bekräfta, och att godkänna en plan för A.
- Backlograden "CI-guard: kräv icke-tom APP_URL" är inaktuell, eftersom guarden redan finns (R0). Jag har inte rört den. Ska den städas i en senare docs-slice?

## Rekommenderat nästa steg

- Codex och Johan granskar R4. Därefter sprintens retro enligt Definition of Done, och varje agent nollställer sin handoff.

## Rör inte

- `codex.md`, produktkod, env, flaggor, Stripe, Supabase, `.vercel`.

## Relaterade filer och PR

- `docs/sprints/customer-purchase-readiness-2026-10.md` (R4-beslut), `docs/sprints/backlog.md`, `docs/sprints/status.md`
- PR: ingen. Ocommittat på `docs/readiness-r4`.
