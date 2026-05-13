---
title: "Help-data drift protection"
description: "Hindra att src/lib/help/articles-data.ts blir out-of-sync med markdown-källorna, eller att Vercel-build råkar generera tom help-data igen."
category: plan
status: draft
last_updated: 2026-05-13
tags: [help, build, vercel, drift-prevention, ci]
related:
  - ../../package.json
  - ../../scripts/generate-help-data.ts
  - ../../src/lib/help/articles-data.ts
  - ../../.vercelignore
sections:
  - Problem
  - Risk
  - Mål
  - Förslag på lösningar
  - Rekommendation
  - Acceptanskriterier
  - Risk och tradeoffs
  - Verifieringsstrategi
  - Prioritet
---

# Help-data drift protection

## Problem

`src/lib/help/articles-data.ts` är auto-genererad av `scripts/generate-help-data.ts` från markdown-filer i `src/lib/help/articles/<role>/*.md`. Filen committas och importeras synkront i `src/lib/help/index.ts`. Hjälpsektionen är beroende av att den committade versionen faktiskt matchar källorna.

**Failure mode A — Vercel-byggets regenerering (fixad 2026-05-13, PR #333)**: Build-scriptet anropade `tsx scripts/generate-help-data.ts` före `next build`. Vercel kör `vercel build` som respekterar `.vercelignore` (`*.md`), så markdown-filerna filtrerades bort. Generatorn hittade noll filer och skrev `[]` till `articles-data.ts`, vilket överskrev den committade versionen. Build-loggen sa `Generated ... with 0 articles`, men bygget rapporterades som SUCCESS. Hjälpsidorna blev tomma i staging (och troligen prod) — lokalt fungerade allt eftersom markdown-filerna fanns på disk.

**Failure mode B — Glömd regenerering**: En utvecklare redigerar en markdown-artikel men glömmer `npm run generate:help` innan commit. `articles-data.ts` är då out-of-sync med källorna. Hjälpsidorna visar gammal data tills någon märker det, ofta lång tid efter.

**Varför det är svårt att upptäcka:**
- Build är "grön" — exit code 0, alla checks passerar, deploy READY.
- TypeScript-kompilering passerar (tom array är giltig).
- Inga tester fångar tom data eftersom unit-tester typiskt mockar artikelladdning.
- Lokalt fungerar allt, så bug:en syns bara i staging/prod efter deploy.
- Slutanvändaren ser "Inga artiklar matchade din sökning" — kan tolkas som UI-bug, inte data-bug.

## Risk

| Risk | Sannolikhet | Påverkan |
|------|-------------|----------|
| Staging/prod får tom hjälpsektion | Medel (failure mode A inträffat 1 gång; B kan ske vid varje markdown-edit) | Hög — användare får ingen hjälp, försämrad demo, supportbörda |
| Build blir "grön" trots fel innehåll | Hög | Hög — falsk trygghet, inga automatiska larm |
| Lokalt fungerar fortfarande | Hög | Medel — utvecklaren ser inte buggen, ingen incident-driver |
| Hjälpsökningar pekar på saknade slugs | Medel | Låg-medel — 404-spikar i loggar utan tydlig orsak |

## Mål

Skydda mot:
- **Stale generated data** — `articles-data.ts` är gammal jämfört med markdown-källor.
- **Missing regeneration efter markdown-edits** — utvecklaren commitar markdown utan att uppdatera den genererade filen.
- **Build/runtime drift mellan lokalt och Vercel** — bygg-pipelinen producerar annan output än utvecklaren ser.

Icke-mål:
- Att flytta tillbaka regenereringen till build-time. Det är vad som orsakade originalbuggen.
- Att designa om help-systemet (synkron import-modell fungerar bra).

## Förslag på lösningar

### A. Pre-commit check

Hook som varnar (eller blockerar) om någon `articles/**/*.md` har nyare mtime än `articles-data.ts`, eller om en diff mellan regenerering och committed version inte är tom.

**Implementation:** Bash i `.husky/pre-commit` (eller motsvarande hook-katalog). Kör `tsx scripts/generate-help-data.ts` mot en tempfil, diffa mot committed `articles-data.ts`. Om olika → ge ett tydligt felmeddelande som pekar på `npm run generate:help`.

**Pros:** Fångar buggen vid commit-tillfället. Snabb feedback. Påverkar bara utvecklaren som glömde regenerera.
**Cons:** Lokala hooks kan skippas med `--no-verify`. Kräver att alla utvecklare har hooks installerade.

### B. CI validation

GitHub Actions-step som regenererar `articles-data.ts` i CI-miljön och diffar mot committed version. Om olika → CI rött.

**Implementation:** Ett `validate-help-data`-job i `.github/workflows/check.yml`. Kör `tsx scripts/generate-help-data.ts`, sedan `git diff --exit-code src/lib/help/articles-data.ts`. Failar med tydligt meddelande.

**Pros:** Kan inte skippas. Fångar både A och B. Krävs som status-check på PR.
**Cons:** Lägger till några sekunder per CI-körning. Kräver att markdown-filer faktiskt finns i CI (vilket de gör — CI är inte Vercel-build-miljö).

### C. Runtime sanity check

Vid app-start eller per-request på `/api/feature-flags` (eller liknande low-frequency endpoint): logga `error` (eller skicka Sentry-larm) om `allArticles.length === 0` när `help_center`-flaggan är på.

**Implementation:** En init-check i `src/lib/help/index.ts` eller i en `instrumentation.ts`-fil. `if (process.env.NODE_ENV === 'production' && allArticles.length === 0) logger.error("help_center: zero articles in bundle")`.

**Pros:** Fångar buggen i produktion även om CI/pre-commit missar. Self-healing detection.
**Cons:** Reagerar först efter deploy, inte före. Sentry-brus om tom data är legitim någonstans (vilket den inte borde vara).

### D. Developer UX

- Tydlig README-rad i `src/lib/help/articles/`: "Efter ändring av .md-filer: kör `npm run generate:help` och commita både md + articles-data.ts".
- Felmeddelande i `npm run generate:help` om dir saknas — annars skriver det tyst tom fil.
- `npm run lint:help` eller liknande alias som diffar utan att skriva (read-only check).

**Pros:** Hjälper utvecklare göra rätt från början. Komplement till A/B/C.
**Cons:** Hjälper inte om utvecklaren inte läser docs eller glömmer.

## Rekommendation

**MVP: B (CI validation), plus minimal D (README-rad).**

Motivation:
- B är det enda alternativet som **inte kan skippas** av utvecklare och **inte beror på lokal miljö**. CI är auktoritativ.
- B fångar **både failure mode A och B** med samma mekanism — diffen mellan regenererad och committed version.
- Implementation är trivial (~10 rader yaml + 3 rader bash) och tar <5 sek per CI-körning.
- D är gratis tillägg som minskar friktion för utvecklare som faktiskt vill göra rätt.
- A (pre-commit) är värdefull men inte tillräcklig som primärt skydd (`--no-verify` finns; nya utvecklare kanske inte har hooks). Kan läggas till senare om CI-misstag blir vanliga.
- C (runtime sanity) är overkill när B fångar buggen pre-merge. Kan läggas till om vi vill ha defense-in-depth, men inte värt MVP-tiden.

**Avgränsning:** Inte göra något åt `.vercelignore`-raden `*.md` — den är inte längre relevant eftersom vi inte kör generatorn under Vercel-build. Att ta bort den skulle bara öka deploy-storleken utan vinst.

## Acceptanskriterier

- [ ] CI failar (rött PR-check) om en PR ändrar `articles/**/*.md` utan att uppdatera `articles-data.ts`, eller om någon ändrar `articles-data.ts` på sätt som inte matchar markdown.
- [ ] CI failar med tydligt felmeddelande som nämner `npm run generate:help` (inte bara en stack trace).
- [ ] `npm run generate:help` är dokumenterad i README eller `src/lib/help/articles/README.md` (filen behöver kanske skapas) som det enda sättet att uppdatera help-data.
- [ ] Bevisad: PR som introducerar en orelaterad markdown-edit utan regenerering blockeras av CI-checken.
- [ ] Bevisad: PR som regenererar korrekt passerar utan friktion.

## Risk och tradeoffs

| Risk | Mitigation |
|------|------------|
| Generated file in git skapar merge-conflicts vid samtidiga markdown-edits | Acceptabel — konflikten är trivial att lösa (kör `npm run generate:help` post-merge). Alternativet (generera vid build) skapade värre bugg. |
| Längre CI-tid | Försumbart — generatorn tar <2 sek. CI är redan flera minuter. |
| False positives om `JSON.stringify`-output blir non-deterministisk | Generatorn är deterministisk per inspektion (samma input → samma output). Om problem uppstår: normalisera diff:en (whitespace-insensitive) eller lägg till sort-key. |
| CI-checken blockerar legitima docs-only PR:s med markdown-format-fixar | Inget problem — sådana PR:s ska faktiskt regenerera, det är hela poängen. |
| Pre-commit hook (om vi lägger till A senare) ger friktion | Kan göras opt-in via husky, eller bara varning utan blockering. |

## Verifieringsstrategi

1. **Negative test**: Skapa en test-PR som ändrar `src/lib/help/articles/customer/boka-en-tjanst.md` (t.ex. byter ett ord i summary) utan att köra generatorn. Förvänta: CI rött med tydligt felmeddelande.
2. **Positive test**: I samma PR, kör `npm run generate:help` och committa båda. Förvänta: CI grönt.
3. **Roundtrip test**: Verifiera att `npm run generate:help` är idempotent — kör två gånger, ingen diff andra gången.
4. **No-op test**: PR som inte rör help-systemet alls — CI-checken ska passera utan extra tid (alternativt: bara köra checken om relevanta paths ändrats, via `paths:` i workflow trigger).

## Prioritet

| Dimension | Bedömning |
|-----------|-----------|
| Severity | **Medel-Hög**. Hjälpsektionen är inte affärskritisk (ingen pengar-flöde), men är central för demo och onboarding. Tom help i staging undergräver demokänslan. |
| Likelihood | **Medel**. Failure mode A är fixad. Failure mode B (glömd regenerering) kan ske vid varje markdown-edit — kanske 1 gång per 5 edits utan skydd. |
| Effort | **Small (15-30 min)** för MVP (B + D). Kan göras som en separat slice utan beroenden. |
| Sprint-prio | **Nästa lediga sprint**, inte hotfix. Vi har redan fixat akut-buggen (PR #333). Detta är härdning. Inte värt att bryta pågående sprint-arbete för. |

**Rekommenderad sprint-prio: Lägsta i nästa sprint.** Sätt på backlogen som "S68-X: Help-data drift protection" eller liknande. Plocka när någon har 30 min utrymme.
