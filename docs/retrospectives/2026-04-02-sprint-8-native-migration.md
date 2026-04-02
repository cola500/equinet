---
title: "Retrospektiv: Sprint 8 -- iOS native-migrering"
description: "Retro for S8-1 annonsering + S8-2 business insights + S8-3 plan + login-debugging"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Sprint 8 -- iOS native-migrering

**Datum:** 2026-04-02
**Scope:** Tva native iOS-skarmar (annonsering + business insights) + voice logging polish plan + login-debugging

---

## Resultat

- 22 andrade/nya filer, 0 nya migrationer
- 54 nya tester (29 webb + 25 iOS), alla TDD, alla grona
- 3905 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: 1 session (S8-1 + S8-2 implementation + S8-3 plan + login-debug)
- S8-1 done, S8-2 done, S8-3 plan redo

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API | `src/app/api/native/announcements/route.ts` | GET leverantorens annonser (Bearer JWT) |
| API | `src/app/api/native/announcements/[id]/cancel/route.ts` | POST avbryt annons (ownership check) |
| API | `src/app/api/native/insights/route.ts` | GET business insights (5 KPIs, charts) |
| API test | 3 testfiler | 29 webb-tester (auth, rate limit, feature flag, KPI-berakning) |
| iOS modeller | `AnnouncementModels.swift`, `InsightsModels.swift` | Codable structs + HeatmapMatrix pre-computation |
| iOS ViewModel | `AnnouncementsViewModel.swift`, `InsightsViewModel.swift` | DI-protokoll, cache-first, optimistic cancel |
| iOS vy | `NativeAnnouncementsView.swift`, `NativeInsightsView.swift` | SwiftUI List + Swift Charts + Grid heatmap |
| iOS test | 2 testfiler | 25 iOS-tester (ViewModel + modell-logik) |
| iOS routing | `NativeMoreView.swift` | 2 nya native routes + reset vid logout |
| iOS infra | `APIClient.swift`, `SharedDataManager.swift`, `project.pbxproj` | 3 API-metoder, 2 cache-system |
| Config | `.env.local` | Fix: DATABASE_URL + NEXTAUTH_URL for lokal dev |

## Vad gick bra

### 1. Hog leveranstakt med TDD
Tva kompletta native-skarmar (API + modeller + ViewModel + vy + tester + routing + cache) implementerade i en session. TDD fangade cache-relaterat testfel tidigt (SharedDataManager overlever mellan testkkorningar).

### 2. Swift Charts forsta gangen -- rent och enkelt
Forsta anvandningen av Swift Charts i projektet. `import Charts` + `Chart { BarMark/LineMark }` var deklarativt och rent. Kan ateranvandas for andra analytics-vyer.

### 3. Heatmap pre-computation i ViewModel
Transformera API-data till 2D-matris med max-varde i ViewModel. Vyn laser bara fran matrisen -- ingen berakningslogik i body. 7 av 13 iOS-tester testar heatmap-logik. Testbart och performant.

### 4. SwiftUI Pro review fangade 5 problem
Oanvand import, icon-only button utan text label, saknad accessibilityAddTraits, dod kod, icke-expression switch. Alla fixade innan commit.

## Vad kan forbattras

### 1. Berakningslogik duplicerad mellan webb- och native-routes
`/api/provider/insights` och `/api/native/insights` har identisk berakningslogik (~100 rader). Bor extraheras till delad service.

**Prioritet:** MEDEL -- fungerar men okar underhallskostnad vid andringar.

### 2. Parallella sessioner overskrev filer
En annan session (S9-1 architect) bytte branch och modifierade filer under S8-1-implementationen. Alla iOS-andringar (APIClient, NativeMoreView, SharedDataManager, pbxproj) reverterades och behode tillampas pa nytt.

**Prioritet:** HOG -- delad working directory ar fragilt. Dokumenterat i CLAUDE.md men hander anda.

### 3. Simulator-problem vid branch-byte
DerivedData blev stale efter att en annan session rorde filerna. Kravde `rm -rf DerivedData/Equinet-*` + simulator reboot. Vanligt men tidskravande.

**Prioritet:** LAG -- kand gotcha, snabb fix.

## Patterns att spara

### Cache per parameter-nyckel
`insights_cache_\(months)` ger separata caches for varje periodval (3/6/12). `clearAllInsightsCache()` rensar alla vid logout. Anvandbart for alla API:er med variabla parametrar.

### Native Screen Pattern (forfinat)
S8-1 och S8-2 foljde monster: Feature inventory -> API (BDD) -> Modeller + ViewModel (DI) -> Vy -> Routing -> Cache -> SwiftUI Pro review. Fungerar effektivt. Tillagg: widget `membershipExceptions` i pbxproj for alla modeller som SharedDataManager refererar.

## 5 Whys (Root-Cause Analysis)

### Problem: iOS-appen kunde inte logga in lokalt
1. Varfor? NextAuth returnerade "no matching decryption secret"
2. Varfor? Session-cookien skapades med en annan NEXTAUTH_SECRET
3. Varfor? `.env.local` pekade pa Supabase (produktion) istallet for lokal databas
4. Varfor? Vercel CLI skapade `.env.local` med produktions-credentials (`vercel env pull`)
5. Varfor? Ingen guard eller dokumentation som varnar for att `.env.local` trumfar `.env`

**Atgard:** Dokumentera tydligare i README/CLAUDE.md att `vercel env pull` overskriver lokal config. Overdag `npm run env:status`-skriptet att varna om `.env.local` pekar pa produktion medan Docker kor.
**Status:** Parkerad (manuell fix gjord, systemic fix later)

### Problem: Parallella sessioner krockar pa delade filer
1. Varfor? S9-1 architect-session modifierade NativeMoreView/APIClient/SharedDataManager
2. Varfor? Bada sessionerna delade working directory
3. Varfor? Git worktrees anvandes inte for isolering
4. Varfor? Architect-sessionen var "bara docs" men status.md-uppdateringen triggade branch-byte
5. Varfor? Ingen hard guard som hindrar branch-byte nar ocommittade andringar finns

**Atgard:** Redan dokumenterat i CLAUDE.md ("EN SESSION AT GANGEN"). Enforcement via pre-checkout hook overdriven for nu.
**Status:** Parkerad

## Larandeeffekt

**Nyckelinsikt:** `.env.local` trumfar `.env` i Next.js -- det ar ett kant problem men orsakar fortfarande forvirring. `vercel env pull` skapar `.env.local` med produktions-credentials som tyst overskriver lokal config. Kontrollera ALLTID `npm run env:status` efter `vercel env pull`.

---

## Lead-komplettering

### Vad gick bra (Lead-perspektiv)

- **Tech-architect pa plan fungerade utmarkt.** Fangade feature flag mismatch (blocker) och cache-nyckel-gap (major) pa S8-1 och S8-2. Hade missats utan.
- **Dev tog feedback direkt.** Uppdaterade planer och committade -- inget motstand.
- **Review-flodet stabiliserat.** Plan -> tech-architect -> godkand -> implementation -> review -> merge.
- **Done-filer med lardomar.** Alla tre stories hade dem.

### Vad som inte fungerade (Lead-perspektiv)

- **Parallella sessioner krockade igen.** Trots guide och fillasning i status.md. Delade filer ar svaga punkten.
- **Lead glomde status.md igen** vid S8-1 merge.

### Processandring till sprint 9

1. **Inga parallella sessioner forran worktrees testats.** Filbaserad uppdelning fungerar inte tillrackligt bra.
2. **Tech-architect alltid som subagent vid Lead-review** for iOS och API-stories. Bevisat varde.
3. **env:status-skriptet bor varna** om .env.local pekar pa produktion.
