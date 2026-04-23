---
title: "Review-matris"
description: "Glob-baserad matris som definierar obligatoriska subagents per ändrad filtyp. Maskinläsbar av S47-1 hook."
category: rule
status: active
last_updated: 2026-04-23
sections:
  - Matris
  - Globalt krav
  - Seriell körning (experiment)
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

## Seriell körning (experiment 2026-04-23)

När en story kräver flera reviewers per matrisen: **kör dem seriellt, inte parallellt**.

### Regel

1. Kör **code-reviewer först** (alltid obligatorisk).
2. Kör nästa reviewer(s) i matrisen **bara om** code-reviewer:
   - flaggar Blocker/Major **eller**
   - flaggar fynd i reviewer-specifika domäner (UX, säkerhet, arkitektur, iOS)
3. Om code-reviewer returnerar "inga blockers/majors utanför UI-polish/kosmetik": **skippa fallback-reviewers**, dokumentera i done-fil.

### Varför

S53-1 (2026-04-23) körde code-reviewer (78k tokens) + cx-ux-reviewer (39k tokens) parallellt för en FAQ-polish-story. Reviewers hittade 4 minors varav 1 var verklig (Safari webkit-detail-marker), 3 var kosmetiska. **117k tokens för 1 verklig bugg = låg ROI.**

Seriell körning:
- Gör code-reviewer till första gate
- Låter honom bedöma om specialist-review behövs
- Sparar ~40-80k tokens när code-reviewer säger "inga issues" på trivial UI-polish
- Bibehåller full reviewer-täckning för stories som verkligen behöver det (Blocker/Major flaggade)

### Dokumentation i done-fil

Vid seriell körning som skippar fallback-reviewers:

```markdown
## Reviews körda

- [x] code-reviewer — inga blockers/majors, endast kosmetiska minors. Se nedan.
- [ ] cx-ux-reviewer — SKIPPAD (code-reviewer flaggade inga UX-concerns)
```

### Test-period

Kör seriellt under S53-S55 (3 sprintar). Mät i process-kost-retro S56:
- Tokens per review-cykel (mål: <50k genomsnitt)
- Antal missade fynd (jämfört med vad parallell körning skulle hittat)
- Gränsfalls-stories där code-reviewer osäker om specialist behövs

Om parallell körning faktiskt hittar mer värde i praktiken: revert till parallellt default.

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
