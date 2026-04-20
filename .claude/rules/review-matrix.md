---
title: "Review-matris"
description: "Glob-baserad matris som definierar obligatoriska subagents per ändrad filtyp. Maskinläsbar av S47-1 hook."
category: rule
status: active
last_updated: 2026-04-20
sections:
  - Matris
  - Globalt krav
  - Docs-only-semantik
  - Trivial-gating
  - Täckning och Gap
  - Designstory-tillägg
  - Feature-flag-tillägg
---

# Review-matris

Obligatoriska subagents bestäms av vilka filer en story ändrar. Hooken `check-reviews-done.sh` (S47-1) slår upp story-typ per ändrad fil och verifierar att done-filen innehåller alla krävda reviews.

## Matris

| Filmönster (glob) | Story-typ | Obligatoriska subagents |
|-------------------|-----------|-------------------------|
| `src/app/api/**/route.ts` (ny/ändrad) | api-route | code-reviewer, security-reviewer |
| `src/app/api/**/route.integration.test.ts` | api-integration-test | code-reviewer |
| `src/components/**/*.tsx` (ny/ändrad) | ui-component | code-reviewer, cx-ux-reviewer |
| `ios/**/*.swift` | ios | code-reviewer, ios-expert |
| `prisma/schema.prisma` | schema-change | tech-architect, code-reviewer |
| `src/lib/*auth*.ts` | auth/säkerhet | security-reviewer, code-reviewer |
| `middleware.ts` | middleware | security-reviewer, tech-architect, code-reviewer |
| `docs/**` (se Docs-only-semantik nedan) | docs-only | — (kan skippas) |
| Övrigt | default | code-reviewer |

## Globalt krav

Kör **alltid** code-reviewer. Övriga subagents bestäms av matristabellen ovan. `required_set` = unionen av alla obligatoriska subagents för alla ändrade filer i storyn.

En ändrad fil kan matcha noll, en eller flera rader. `required_set` är alltid union av alla matchande raders subagents.

För domänspecifika granskningstips per subagent: se `.claude/rules/review-manifest.md`.

## Docs-only-semantik

`docs/**`-raden ger tom `required_set` **ENBART om inga filer utanför `docs/**` är ändrade i storyn**. Om en story ändrar både `docs/` och kod-filer: union-regeln gäller fullt ut och docs-only-undantaget appliceras inte.

## Trivial-gating

Trivial-gating (skippa review för stories med effort <15 min + ≤1 fil) är **hook-intern logik**, inte matrisbaserad. Matrisen definierar vilka subagents som *krävs*. Hooken bestämmer om kravet kan kringgås baserat på story-metadata. Se `.claude/rules/team-workflow.md` Station 4 Review-gating för kriterierna.

## Täckning och Gap

Lägg alltid till följande i prompt-texten till code-reviewer och security-reviewer:
> "Avsluta med: **Täckning** (vad du konkret granskade, filnamn/aspekter) och **Gap** (vad du INTE granskade och varför)."

## Designstory-tillägg

Om en story implementerar ett tidigare arkitekturdokument (designstory): lägg till "arkitekturcoverage"-prompt till security-reviewer/tech-architect:
> "Verifiera att varje numrerat designbeslut (D1, D2...) finns implementerat i koden. Lista eventuella gap."

## Feature-flag-tillägg

Om en story sätter `defaultEnabled: true` på en feature flag: obligatorisk rollout-checklista
([docs/operations/feature-flag-rollout-checklist.md](../../docs/operations/feature-flag-rollout-checklist.md))
med webb-audit + iOS-audit + post-rollout plan.
