---
title: "S26-3 Done: Parallella reviews"
description: "Niva 1 experiment -- 2 review-agenter parallellt pa S26-1+S26-2"
category: retro
status: active
last_updated: 2026-04-13
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Experiment-matning
  - Avvikelser
  - Lardomar
---

# S26-3 Done: Parallella reviews (REVIEW-AGENTER)

## Acceptanskriterier

- [x] Minst 2 review-agenter korda parallellt (code-reviewer + security-reviewer)
- [x] Alla findings addresserade (svenska tecken fixade, ovriga dokumenterade)
- [x] Dokumenterat: tid for parallella vs uppskattat sekventiell tid

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Saker (security review godkand)
- [x] check:all gron

## Reviews korda

### Code-reviewer (kombinerad S26-1+S26-2)
- 2 important: duplicerad GuardMutation-typ (kant, S26-1), saknade å/ä/ö i AuthService (fixad)
- 1 suggestion: inkonsekvent toast i notes vs horses (noterat, inte fixat -- pre-existing)

### Security-reviewer (S26-2 auth-fokus)
- Alla 8 checklistepunkter godkanda
- 1 minor: Supabase/Prisma-ordning (integritet, inte sakerhet -- accepterat, kommentar tillagd)
- Ingen IDOR-risk, rate limiting bevarat, feature flag bevarat

## Experiment-matning

| Matt | Varde |
|------|-------|
| Total review-tid (parallellt) | ~49s (langsta agenten) |
| Uppskattat sekventiell tid | ~80s (summa bada) |
| Tidsbesparing | ~40% |
| Tokens code-reviewer | ~53k |
| Tokens security-reviewer | ~49k |
| Tokens totalt | ~102k |
| Antal findings (totalt) | 4 (2 important, 1 minor, 1 suggestion) |
| NYA findings (ej fangade per-story) | 1 (svenska tecken i AuthService) |

### Parallell vs sekventiell

- **Parallellt**: Bada agenter startade samtidigt, langsta tog ~49s
- **Sekventiellt**: Hade tagit ~80s (summa)
- **Varde**: ~40% tidsbesparing, men viktigare: cross-story review hittade 1 ny finding som per-story reviews missade

## Lardomar

- **Cross-story review hittar saker per-story missar.** Code-reviewern hittade saknade å/ä/ö i AuthService som per-story reviewn inte fangade (den fokuserade pa logik, inte tecken).
- **Parallella reviews ar enkla att implementera.** Bara spawna bada i samma meddelande med `run_in_background: true`.
- **Fokuserade prompts ger battre resultat.** Security-reviewern fick en 8-punkts checklista och svarade pa varje punkt. Code-reviewern fick "cross-story consistency" och hittade pattern-avvikelser.
- **Token-kostnad ar hog (~100k for 2 agenter).** Vart det for A/B-test, men i daglig drift kanske 1 kombinerad review racker for enklare stories.
