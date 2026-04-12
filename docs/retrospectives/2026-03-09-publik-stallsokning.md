---
title: "Retrospektiv: Publik stallsökning och stallprofil"
description: "Fas 4 av stallägare-epicen: publika sök-API:er, söksida med kommun-autocomplete, SEO-optimerad profilsida"
category: "retrospective"
status: "final"
last_updated: "2026-03-09"
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - 5 Whys
  - Lärandeeffekt
tags:
  - stall
  - publik-sok
  - marketplace
---

# Retrospektiv: Publik stallsökning och stallprofil (Fas 4)

**Datum:** 2026-03-09
**Scope:** Publika API-endpoints för stallsökning och stallprofil, söksida med kommun-autocomplete, SEO-optimerad profilsida med generateMetadata

---

## Resultat

- 8 nya filer, 6 ändrade filer, 0 nya migrationer
- 16 nya tester (alla TDD, alla gröna)
- 3227 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API (publik) | `src/app/api/stables/route.ts` | GET /api/stables -- publik sökning med municipality/city/search/hasAvailableSpots-filter |
| API (publik) | `src/app/api/stables/[stableId]/route.ts` | GET /api/stables/[stableId] -- publik stallprofil med lediga platser |
| Tester | `route.test.ts` (2 st) | 16 tester: feature flag, rate limit, filter, unauthenticated access, data exposure |
| Domain | `StableService.ts` | +searchPublic(filters) metod |
| Hook | `src/hooks/useStableSearch.ts` | Debounce + URL-sync, kopierat useProviderSearch-mönstret |
| UI | `src/app/stables/page.tsx` | Söksida med kommun-autocomplete, filter-chips, checkbox "Lediga platser" |
| UI | `src/app/stables/[stableId]/page.tsx` | Server Component med generateMetadata för SEO |
| UI | `StableProfileView.tsx` | Klientkomponent: stallbeskrivning, lediga platser med pris, kontaktinfo |
| Auth | `src/lib/auth.config.ts` | Fix: `/stables` publikt, `/stable/` skyddat |
| Svenska | 4 filer | Fixade ASCII-substitut (a->å, o->ö) i fas 1-3 filer |

## Vad gick bra

### 1. Befintliga patterns påskyndade arbetet enormt
Repository (`findAll`, `findPublicById`), service (`getPublicById`), factory-mönstret, Zod-scheman -- allt fanns redan från fas 1-3. Fas 4 handlade om att exponera befintlig funktionalitet publikt, inte om att bygga ny domänlogik.

### 2. Auth.config-buggen upptäcktes proaktivt
`startsWith('/stable')` matchade BÅDE `/stable/...` (skyddat) OCH `/stables/...` (ska vara publikt). Hade detta inte fixats hade alla publika stallsidor blockerats av auth-middleware. Upptäcktes vid planering, inte vid test.

### 3. Publik data-exponering hanterades med explicit allowlist
`toPublicStable()` och `toPublicProfile()` returnerar bara tillåtna fält istället för att ta bort känsliga. Allowlist > blocklist -- nya fält exponeras inte oavsiktligt.

### 4. Security audit gav rent resultat
5 PASS, 0 FAIL. Rate limiting, feature flag gating, input sanitization och explicit fält-allowlisting -- alla säkerhetsmönster tillämpades korrekt.

## Vad kan förbättras

### 1. Svenska tecken i fas 1-3 kod
Flera filer från fas 1-3 hade ASCII-substitut ("Ej tillgänglig", "Översikt", "Leverantör"). Borde ha fångats av `check:swedish` vid commit.

**Prioritet:** LÅG -- fixat nu, men indikerar att `check:swedish` inte kördes efter fas 1-3.

### 2. Pagination saknas i publika sökresultat
`/api/stables` returnerar alla matchande stall utan pagination. Provider-sökningens `limit/offset`-mönster kopierades inte. Fungerar för MVP (få stall initialt) men behöver läggas till vid tillväxt.

**Prioritet:** LÅG -- bra nog för MVP, men ska implementeras innan 100+ stall registreras.

### 3. PrismaStableRepository-mock krävde omväg
Första försöket att mocka `new PrismaStableRepository()` direkt i testet fungerade inte. Lösningen var att använda factory/service-mönstret istället, vilket var rätt design-beslut men tog en extra iteration.

**Prioritet:** LÅG -- resulterade i bättre kod (factory DI istället för direkt repo-instansiering).

## Patterns att spara

### Publik vs skyddad URL-konvention
- `/api/stable/*` = auth-skyddad (ägarens stall, singularis)
- `/api/stables/*` = publik (sökning, pluralis)
- Auth.config: `startsWith('/stable/')` + `=== '/stable'` (inte `startsWith('/stable')` som matchar båda)

### Explicit field allowlist för publika API:er
```typescript
function toPublicStable(stable: StableWithCounts) {
  return { id: stable.id, name: stable.name, ... } // Bara tillåtna fält
}
```
Allowlist > blocklist. Nya fält exponeras inte oavsiktligt.

### generateMetadata för SEO i Server Components
```typescript
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stableId } = await params
  const stable = await service.getPublicById(stableId)
  return { title: `${stable.name} | Equinet`, description: ..., openGraph: ... }
}
```
Första användningen i projektet. Kräver att sidan är en Server Component (inte "use client").

### Kommun-autocomplete med searchMunicipalities
```typescript
const matches = searchMunicipalities(value).map((m) => m.name).slice(0, 5)
```
Återanvänder `src/lib/geo/municipalities.ts` med 290 svenska kommuner. Klient-side, ingen API-anrop.

## 5 Whys (Root-Cause Analysis)

### Problem: startsWith('/stable') blockerade /stables-sidor
1. Varför? Auth.config använde `startsWith('/stable')` som matchar alla sökvägar som börjar med "stable"
2. Varför? Fas 1 implementerade auth-skydd före publika sidor existerade
3. Varför? Ingen behövde skilja mellan `/stable` och `/stables` när bara skyddade sidor fanns
4. Varför? URL-konventionen (singularis = skyddad, pluralis = publik) definierades i handoff.json men testades aldrig
5. Varför? Auth.config-tester kollar inte kombinationen av skyddade och publika sökvägar

**Åtgärd:** Notera i gotchas: "startsWith-matcher i auth.config matchar prefix -- testa att nya publika routes inte oavsiktligt blockeras av befintliga skydd"
**Status:** Implementerad (fixad i denna session)

## Lärandeeffekt

**Nyckelinsikt:** Prefix-matcher i middleware (`startsWith`) är farliga -- en skyddad `/stable`-prefix blockerar oavsiktligt alla `/stables`-varianter. Konventionen singularis (skyddad) vs pluralis (publik) kräver att middleware-matchen inkluderar trailing slash (`/stable/`) för att fungera korrekt.
