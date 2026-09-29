---
title: "Review-matris"
description: "Glob-baserad matris som definierar obligatoriska reviewers (inbyggda skills + projektagenter) per ändrad filtyp."
category: rule
status: active
last_updated: 2026-09-29
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

Obligatoriska reviewers bestäms av vilka filer en story ändrar.

**Reviewer-typer (2026-09-29):**

| Reviewer | Mekanism |
|----------|----------|
| `/code-review` | Inbyggd skill (Skill-verktyget). Granskar aktuell diff eller PR. |
| `/security-review` | Inbyggd skill (Skill-verktyget). Säkerhetsgranskar ändringarna på aktuell branch. |
| `cx-ux-reviewer`, `tech-architect`, `ios-expert` | Projektagenter i `.claude/agents/` (Agent-verktyget). |

Tidigare namn `code-reviewer`/`security-reviewer` (i done-filer, retros och planer) syftar på samma roller. Det finns inga sådana agenter: `security-reviewer` togs bort i `18d74c5d`, `code-reviewer` definierades aldrig.

De inbyggda skillsen känner inte till Equinets konventioner. Bocka själv av relevant sektion i `review-manifest.md` mot skillens resultat.

`check-reviews-done.sh` (S47-1) är sedan 2026-04-24 bortkopplad från pre-commit och verifierar inte längre done-filer.

## Matris

| Filmönster (glob) | Story-typ | Obligatoriska reviewers |
|-------------------|-----------|-------------------------|
| `src/app/api/**/route.ts` (ny/ändrad) | api-route | `/code-review`, `/security-review` |
| `src/app/api/**/route.integration.test.ts` | api-integration-test | `/code-review` |
| `src/components/**/*.tsx` (ny/ändrad) | ui-component | `/code-review`, cx-ux-reviewer |
| `ios/**/*.swift` | ios | `/code-review`, ios-expert |
| `prisma/schema.prisma` | schema-change | tech-architect, `/code-review` |
| `src/lib/*auth*.ts` | auth/säkerhet | `/security-review`, `/code-review` |
| `middleware.ts` | middleware | `/security-review`, tech-architect, `/code-review` |
| `docs/**` (se Docs-only-semantik nedan) | docs-only | — (kan skippas) |
| Övrigt | default | `/code-review` |

## Globalt krav

Kör **alltid** `/code-review`. Övriga reviewers bestäms av matristabellen ovan. `required_set` = unionen av alla obligatoriska reviewers för alla ändrade filer i storyn.

En ändrad fil kan matcha noll, en eller flera rader. `required_set` är alltid union av alla matchande raders reviewers.

För domänspecifika granskningstips per reviewer: se `.claude/rules/review-manifest.md`.

## Seriell körning (experiment 2026-04-23)

När en story kräver flera reviewers per matrisen: **kör dem seriellt, inte parallellt**.

### Regel

1. Kör **`/code-review` först** (alltid obligatorisk).
2. Kör nästa reviewer(s) i matrisen **bara om** `/code-review`:
   - flaggar Blocker/Major **eller**
   - flaggar fynd i reviewer-specifika domäner (UX, säkerhet, arkitektur, iOS)
3. Om `/code-review` returnerar "inga blockers/majors utanför UI-polish/kosmetik": **skippa fallback-reviewers**, dokumentera i done-fil.

### Varför

S53-1 (2026-04-23) körde `/code-review` (78k tokens) + cx-ux-reviewer (39k tokens) parallellt för en FAQ-polish-story. Reviewers hittade 4 minors varav 1 var verklig (Safari webkit-detail-marker), 3 var kosmetiska. **117k tokens för 1 verklig bugg = låg ROI.**

Seriell körning:
- Gör `/code-review` till första gate
- Låter den bedöma om specialist-review behövs
- Sparar ~40-80k tokens när `/code-review` säger "inga issues" på trivial UI-polish
- Bibehåller full reviewer-täckning för stories som verkligen behöver det (Blocker/Major flaggade)

### Dokumentation i done-fil

Vid seriell körning som skippar fallback-reviewers:

```markdown
## Reviews körda

- [x] `/code-review` — inga blockers/majors, endast kosmetiska minors. Se nedan.
- [ ] cx-ux-reviewer — SKIPPAD (`/code-review` flaggade inga UX-concerns)
```

### Test-period

Kör seriellt under S53-S55 (3 sprintar). Mät i process-kost-retro S56:
- Tokens per review-cykel (mål: <50k genomsnitt)
- Antal missade fynd (jämfört med vad parallell körning skulle hittat)
- Gränsfalls-stories där `/code-review` osäker om specialist behövs

Om parallell körning faktiskt hittar mer värde i praktiken: revert till parallellt default.

## Docs-only-semantik

`docs/**`-raden ger tom `required_set` **ENBART om inga filer utanför `docs/**` är ändrade i storyn**. Om en story ändrar både `docs/` och kod-filer: union-regeln gäller fullt ut och docs-only-undantaget appliceras inte.

**Observera:** "Docs-only" här handlar bara om vilka *reviewers* som krävs -- inte om PR/branch krävs. Feature branch + PR och grön `Quality Gate Passed` krävs alltid, docs-only inkluderat. Se `.claude/rules/commit-strategy.md`.

## Trivial-gating

Trivial-gating (skippa review för stories med effort <15 min + ≤1 fil) är **hook-intern logik**, inte matrisbaserad. Matrisen definierar vilka reviewers som *krävs*. Hooken bestämmer om kravet kan kringgås baserat på story-metadata. Se `.claude/rules/team-workflow.md` Station 4 Review-gating för kriterierna.

## Täckning och Gap

Lägg alltid till följande i prompt-texten till agent-reviewers (`cx-ux-reviewer`, `tech-architect`, `ios-expert`). För `/code-review` och `/security-review`: sammanfatta täckning och gap själv efter körningen.
> "Avsluta med: **Täckning** (vad du konkret granskade, filnamn/aspekter) och **Gap** (vad du INTE granskade och varför)."

## Designstory-tillägg

Om en story implementerar ett tidigare arkitekturdokument (designstory): lägg till "arkitekturcoverage"-prompt till tech-architect (och verifiera själv mot `/security-review`-resultatet):
> "Verifiera att varje numrerat designbeslut (D1, D2...) finns implementerat i koden. Lista eventuella gap."

## Feature-flag-tillägg

Om en story sätter `defaultEnabled: true` på en feature flag: obligatorisk rollout-checklista
([docs/operations/feature-flag-rollout-checklist.md](../../docs/operations/feature-flag-rollout-checklist.md))
med webb-audit + iOS-audit + post-rollout plan.
