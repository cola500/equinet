# Retrospektiv: Feature Flag Hardening

**Datum:** 2026-02-24
**Scope:** Hardna feature flag enforcement pa alla gated API routes + fixa PrismaClient-krasch i klient-bundle

---

## Resultat

- 48 andrade filer (31 routes, 17 testfiler), 3 nya filer
- 19 nya tester (alla TDD, alla grona)
- 2478 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session (planering + implementation + merge)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Lib | `src/lib/feature-flag-definitions.ts` (NY) | Client-safe modul med flagg-metadata (inget Prisma-beroende) |
| Lib | `src/lib/feature-flags.ts` | Refaktorerad till re-export av FEATURE_FLAGS fran definitions |
| API (route_planning) | 8 routes + 4 nya testfiler | Feature flag gate pa alla route-planning endpoints |
| API (group_bookings) | 8 routes + 8 testfiler | Feature flag gate pa alla group-booking endpoints |
| API (recurring_bookings) | 3 routes + 3 testfiler | Feature flag gate pa alla booking-series endpoints |
| API (voice_logging) | 2 routes + 2 testfiler | Feature flag gate pa voice-log endpoints |
| API (self_reschedule) | 1 route + 1 testfil | Feature flag gate pa reschedule endpoint |
| UI | `admin/system/page.tsx` | Fixad import fran feature-flag-definitions (klient-safe) |
| UI | `announcements/page.tsx`, `provider/insights/page.tsx` | Lade till feature flag gate i klient-sidor |
| E2E | `e2e/feature-flag-toggle.spec.ts` | Utokade E2E-tester for feature flag toggle |
| Rules | `.claude/rules/feature-flags.md` (NY) | Standardmonster for feature flag-anvandning |

## Vad gick bra

### 1. Klient-safe modulseparation
Genom att extrahera `FEATURE_FLAGS` och `FeatureFlag`-typen till `feature-flag-definitions.ts` (utan Prisma-beroenden) brot vi import-kedjan som drog in PrismaClient i klient-bundlen. Enkelt, elegant och framtidsakert.

### 2. Systematisk genomgang av alla gated routes
Istallet for att bara fixa admin-sidan (symptomet) gick vi igenom ALLA API-routes och satte konsekvent `isFeatureEnabled()` guard med 404-respons. 31 routes fick guards, 17 testfiler uppdaterades.

### 3. Rules-fil for framtida konsistens
`.claude/rules/feature-flags.md` dokumenterar standardmonstret (server-gate, klient-gate, test-mock, checklista). Framtida features foljer samma monster automatiskt.

## Vad kan forbattras

### 1. Merge-konflikter vid divergerande branches
Vart branch divergerade fran main INNAN commit `1e5de13` (all flags default-on). Vid merge fick vi konflikter i bade `feature-flags.ts` (inline vs re-export) och `feature-flag-definitions.ts` (false vs true defaults). Kravde manuell losning.

**Prioritet:** MEDEL -- kortare branch-livstid eller rebasing minskar risken.

### 2. Worktree-begransningar vid merge
Kunde inte checka ut main i worktree:n (redan utcheckad i huvud-repot). Fick kora merge fran huvud-repots working directory, vilket var riskabelt med untracked filer dar.

**Prioritet:** LAG -- ovanligt scenario, men bra att vara medveten om.

## Patterns att spara

### Client-safe modulseparation
Nar en server-only modul (med Prisma, fs, etc.) exporterar typer eller konstanter som behoves i `"use client"`-komponenter: extrahera till en separat fil utan server-beroenden, och re-exportera fran originalet for bakatkompatibilitet.

```
feature-flag-definitions.ts  <- Client-safe (typer + konstanter)
feature-flags.ts             <- Server-only (re-exporterar + DB-logik)
```

### Standardiserat feature flag gate-monster
```typescript
// Route: tidigt i handler, efter auth + rate limit
if (!(await isFeatureEnabled("flag_name"))) {
  return NextResponse.json({ error: "Ej tillganglig" }, { status: 404 })
}
```
- Alltid 404 (doljer att feature existerar)
- Alltid "Ej tillganglig" som felmeddelande
- Test: `mockIsFeatureEnabled.mockResolvedValueOnce(false)` + expect 404

## 5 Whys (Root-Cause Analysis)

### Problem: PrismaClient kraschar i browser pa /admin/system
1. Varfor? `admin/system/page.tsx` ("use client") importerar PrismaClient indirekt
2. Varfor? Filen importerar `FEATURE_FLAGS` fran `@/lib/feature-flags`
3. Varfor? `feature-flags.ts` importerar `featureFlagRepository` som importerar Prisma
4. Varfor? Commit `f121831` (migrate flags from Redis to PostgreSQL) lade till Prisma-importer utan att separera klient-safe exports
5. Varfor? Det fanns inget monster/regel for att skilja klient-safe metadata fran server-only logik i feature flag-systemet

**Atgard:** Skapade `feature-flag-definitions.ts` (klient-safe) + `.claude/rules/feature-flags.md` (dokumenterar monster). Alla framtida feature-flag-importer i klient-kod pekar pa definitions-filen.
**Status:** Implementerad

### Problem: Merge-konflikt i feature-flag-defaults
1. Varfor? Testerna pa main forvantade sig `defaultEnabled: true` for alla flaggor, men vart branch hade 4 st som `false`
2. Varfor? Main fick commit `1e5de13` (all flags default-on) EFTER att vart branch skapades
3. Varfor? Vart branch baserades pa en aldre commit dar `group_bookings`, `recurring_bookings`, `follow_provider`, `municipality_watch` var `false`
4. Varfor? Branch:en levde parallellt med main utan rebasing
5. Varfor? Ingen process for att rebasera langlivade branches

**Atgard:** Uppdaterade `feature-flag-definitions.ts` till att matcha main:s alla-true-defaults vid merge-tillfallet.
**Status:** Implementerad (for denna gang). Rebase-policy: att gora.

## Larandeeffekt

**Nyckelinsikt:** Nar en server-only modul exporterar bade databaslogik OCH klient-safe metadata, maste metadata extraheras till en separat fil INNAN klient-komponenter importerar den. Import-kedjan i Next.js bundler respekterar inte runtime-grensar -- allt som kan importeras KOMMER att bundlas.
