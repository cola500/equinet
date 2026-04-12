---
title: "Sprint 23: Token-effektivitet"
description: "Minska tokenförbrukning per session genom smartare kontext, kodkarta och dedup"
category: sprint
status: active
last_updated: 2026-04-12
tags: [sprint, tokens, efficiency, agent, dx]
sections:
  - Sprint Overview
  - Bakgrund
  - Stories
  - Exekveringsplan
---

# Sprint 23: Token-effektivitet

## Sprint Overview

**Mål:** Minska antalet tokens som bränns per session genom att ladda rätt information vid rätt tillfälle, eliminera redundans och ge agenter snabbare navigering.

**Bakgrund:** Idag laddas ~1900 rader kontext vid varje session (CLAUDE.md 571 + rules 1135 + MEMORY.md 207). Mycket av detta är relevant, men det finns redundans och information som bara behövs i specifika situationer. Dessutom bränner agenter 3-7 tool calls bara för att orientera sig i kodbasen.

**Mätetal:** Vi mäter framgång genom:
- Rader laddade per session (mål: <1200 från 1913)
- Tool calls för orientering (mål: <3 från 7-10, kodkartan löser redan detta)
- Andel kontext som är selektivt laddat (mål: >50% från 31%)

---

## Stories

### S23-1: Spike -- tokenförbrukning och kontext-audit

**Prioritet:** 1
**Effort:** 2h
**Roll:** fullstack

Systematisk genomgång av all automatiskt laddad kontext. Identifiera vad som kan göras selektivt, vad som är redundant, och vad som kan komprimeras.

**Undersök:**

1. **CLAUDE.md (571 rader)** -- Vilka sektioner läses faktiskt? Key Learnings är 179 bullet points -- kan de bli selektiva (iOS-learnings laddas bara vid iOS-arbete)?
2. **Rules utan paths (1135 rader)** -- Ska auto-assign.md (107), autonomous-sprint.md (216), team-workflow.md (256), code-review-checklist.md (154), tech-lead.md (78) alltid laddas? De behövs bara vid sprint-start, review respektive merge.
3. **Överlapp** -- auto-assign + autonomous-sprint + team-workflow beskriver alla stationsflödet. Kan de konsolideras eller referera varandra?
4. **MEMORY.md (207 rader)** -- Gammal sessions-historik (session 112-116) tar 40 rader. Behövs den?
5. **code-map.md (218 rader)** -- Alltid laddad. Behövs hela kartan eller kan den delas per domän?

**Acceptanskriterier:**
- [ ] Rapport: varje fil med "behåll som alltid / gör selektiv / komprimera / ta bort"
- [ ] Beräknat: hur många rader sparas per session
- [ ] Plan för S23-2 baserad på fynden

---

### S23-2: Gör process-rules selektiva

**Prioritet:** 2
**Effort:** 1h
**Roll:** fullstack

Baserat på spiken (S23-1): lägg till `paths:`-frontmatter på rules som kan göras selektiva.

**OBS (spike-fynd):** auto-assign.md, autonomous-sprint.md och team-workflow.md KAN INTE göras selektiva -- de triggas av "kör"-kommandon i chatten, inte filändringar. Paths-matchning funkar inte för dem.

**Filer att göra selektiva (3 st, 338 rader):**
- `code-review-checklist.md` (154 rader) -> `paths: ["src/**"]`
- `feature-flags.md` (106 rader) -> `paths: ["src/lib/feature-flag*", "src/components/providers/FeatureFlagProvider*"]`
- `tech-lead.md` (78 rader) -> `paths: ["docs/sprints/*"]`

**Acceptanskriterier:**
- [ ] 3 rules-filer gjorda selektiva med paths-frontmatter
- [ ] Kontext per session minskar med ~338 rader
- [ ] Sprint-flödet fungerar fortfarande (auto-assign, autonomous-sprint, team-workflow oförändrade)

---

### S23-3: Auto-generera kodkartan

**Prioritet:** 3
**Effort:** 2h
**Roll:** fullstack

Script som genererar `.claude/rules/code-map.md` från faktisk kod. Förhindrar att kartan blir inaktuell.

**Implementation:**
- `scripts/generate-code-map.sh` eller `.ts`
- Läser: `src/domain/*/`, `src/infrastructure/persistence/*/`, `src/app/api/**/route.ts`, `src/app/provider/*/page.tsx`, `src/app/customer/*/page.tsx`, `src/app/admin/*/page.tsx`
- Genererar markdown-tabeller per domän
- `npm run codemap` script i package.json
- Kör manuellt vid behov (inte hook -- kartan ändras sällan)

**Acceptanskriterier:**
- [ ] Script genererar korrekt kodkarta
- [ ] Output matchar nuvarande code-map.md
- [ ] Dokumenterat i README (Viktiga Kommandon)

---

### S23-4: Feature flag -> fil-mapping

**Prioritet:** 4
**Effort:** 1h
**Roll:** fullstack

Utöka kodkartan med en sektion som mappar varje feature flag till de filer som refererar den. Grep-baserat.

**Implementation:**
- Inkludera i generate-code-map-scriptet
- För varje flagga i `feature-flag-definitions.ts`: grep alla `.ts`/`.tsx`-filer
- Gruppera per flagga: routes, services, UI-komponenter
- Lägg till som sektion i code-map.md

**Acceptanskriterier:**
- [ ] Varje feature flag listad med alla filer som refererar den
- [ ] Agenter kan snabbt se "vilka filer berörs om jag slår av offline_mode?"

---

### S23-5: Komprimera CLAUDE.md + rensa MEMORY.md

**Prioritet:** 5
**Effort:** 1h
**Roll:** fullstack

Tre åtgärder från spiken (S23-1), totalt ~200 rader besparing:

**1. Flytta iOS-learnings (120 rader)**
- Ny `.claude/rules/ios-learnings.md` med `paths: ["ios/**"]`
- Flytta alla 33 iOS-bullet points + iOS-testflödet från CLAUDE.md
- CLAUDE.md behåller: Serverless, Domain Patterns, Utvecklingsmönster (webb), RLS

**2. Rensa MEMORY.md sessionshistorik (50 rader)**
- Ta bort "Senaste sessioner" (session 112-116) -- tillgänglig via `git log`
- Komprimera Feature Flags och iOS-arkitektur-sektionerna

**3. Ta bort duplicerad Testing-sektion (30 rader)**
- BDD dual-loop beskrivs både i CLAUDE.md och `.claude/rules/testing.md`
- CLAUDE.md refererar testing.md istället för att duplicera

**Acceptanskriterier:**
- [ ] CLAUDE.md krympt med >150 rader
- [ ] iOS-learnings i separat selektiv fil med paths: ["ios/**"]
- [ ] MEMORY.md sessionshistorik borttagen
- [ ] Inga learnings förlorade (flyttade, inte raderade)
- [ ] Testing-referens istället för duplicering

---

### S23-6: Domän-metadata i Services (JSDoc)

**Prioritet:** 6
**Effort:** 2h
**Roll:** fullstack

Lägg till en strukturerad JSDoc-kommentar överst i varje domain service:

```typescript
/**
 * @domain booking
 * @routes POST /api/bookings, PUT /api/bookings/[id], DELETE /api/bookings/[id]
 * @repository IBookingRepository
 * @featureFlag recurring_bookings (BookingSeriesService)
 * @consumers provider/bookings/page.tsx, customer/bookings/page.tsx
 */
```

Agenter som läser en Service-fil ser direkt vilka routes och UI-sidor som berörs -- utan att behöva kodkartan.

**Acceptanskriterier:**
- [ ] JSDoc på alla 20 domain services
- [ ] Konsekvent format
- [ ] Kodkartan refererar att metadata finns i filerna

---

### S23-7: Dokumentera och mät

**Prioritet:** 7 (sist)
**Effort:** 30 min
**Roll:** fullstack

- Mät nya kontexttotaler (rader per session, selektiv andel)
- Jämför med baseline (1913 rader, 31% selektivt)
- Dokumentera i CLAUDE.md
- Uppdatera backlog

**Acceptanskriterier:**
- [ ] Före/efter-jämförelse dokumenterad
- [ ] Mål nått: <1200 rader per session, >50% selektivt
- [ ] `npm run check:all` grön

---

## Exekveringsplan

```
S23-1 (2h, spike) -> S23-2 (1h, selektiva rules) -> S23-3 (2h, auto-codemap) -> S23-4 (1h, flag-mapping) -> S23-5 (1h, komprimera) -> S23-6 (2h, JSDoc) -> S23-7 (30m, mät)
```

**Total effort:** ~1.5 dag

S23-1 (spike) styr resten -- om vi hittar andra optimeringar justerar vi.

## Definition of Done (sprintnivå)

- [ ] Kontext per session < 1200 rader (från 1913)
- [ ] > 50% av rules selektivt laddade (från 31%)
- [ ] Kodkarta auto-genererad och uppdateringsbar
- [ ] Feature flag-mapping i kodkartan
- [ ] JSDoc-metadata på alla domain services
- [ ] Före/efter-mätning dokumenterad
- [ ] `npm run check:all` grön
