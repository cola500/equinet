# Retrospektiv: Kognitiv last Sprint 4 -- Skeletons & FirstUseTooltip

**Datum:** 2026-02-27
**Scope:** Ersatte generiska spinners med content-aware skeletons pa 26 sidor, skapade FirstUseTooltip-komponent for kontextuell hjalp

---

## Resultat

- 26 andrade filer, 6 nya filer, 0 nya migrationer
- 6 nya tester (TDD for FirstUseTooltip helpers)
- 2664 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 nya varningar
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI (skeletons) | `CalendarSkeleton.tsx`, `DashboardSkeleton.tsx`, `ProfileSkeleton.tsx`, `GenericListSkeleton.tsx` | 4 nya content-aware skeleton-komponenter i `src/components/loading/` |
| UI (tooltip) | `first-use-tooltip.tsx` | Ny komponent med Popover + localStorage-persistens for forsta-anvandning-hjalp |
| Sidor (26 st) | `src/app/provider/**`, `src/app/customer/**`, `src/app/providers/**`, `src/app/announcements/**` | Ersatte `animate-spin` spinner med ratt skeleton pa varje sida |
| Sidor (5 st) | `calendar`, `dashboard`, `bookings`, `routes`, `customer/bookings` | FirstUseTooltip wrappade runt nyckelkomponenter |
| Test | `first-use-tooltip.test.ts` | 6 tester for `getStorageKey`, `isTooltipDismissed`, `dismissTooltip` |

## Vad gick bra

### 1. Parallella subagenter for mekaniskt arbete
26 sidor med identisk andring (spinner -> skeleton) delades upp i 5 parallella subagenter. Totaltid ~1 minut istallet for sekventiell andring. Monsterdefiniering uppfront + tydlig instruktion per agent var nyckeln.

### 2. TDD for testbar logik, skippa for ren UI
Separerade exporterade hjalpfunktioner (`getStorageKey`, `isTooltipDismissed`, `dismissTooltip`) fran React-komponenten. Rena funktioner = enkla tester utan DOM-rendering. Skeletons ar ren UI utan sidoeffekter, sa typecheck racker.

### 3. Nettoreduktion av kod
416 nya rader men 170 borttagna = netto +246 rader. Spinner-koden var 6-7 rader per sida, skeleton-importen ar 1-2 rader. Mindre boilerplate per sida.

### 4. Fas 1 + Fas 3 paralleliserade
Skeletons och FirstUseTooltip var oberoende, sa bada byggdes samtidigt. Bra planering av beroenden i planen sparade tid.

## Vad kan forbattras

### 1. Tooltip-placering kravde manuell kontextlasning
For varje tooltip-sida behoven jag lasa koden for att hitta ratt ankarelement. Framtida losnning: en mapping-fil som deklarativt mappar tooltip-id -> sida -> element.

**Prioritet:** LAG -- engangsjobb, 5 sidor ar inte mycket

### 2. Lint-varningar i E2E-filer
7 befintliga lint-varningar i E2E-filer (`no-unused-vars`, `no-explicit-any`) kvarstar. Inte fran denna sprint men bor fixas.

**Prioritet:** LAG -- paverkar inte produktion, men bryter "0 warnings"-malet

## Patterns att spara

### Content-aware skeleton-monster
4 skeletonvarianter tacker alla sidtyper:
- `CalendarSkeleton` -- grid-baserade vyer (kalender, schema)
- `DashboardSkeleton` -- dashboard med kort + statistik + chart
- `ProfileSkeleton` -- formularsidor med avatar
- `GenericListSkeleton` -- listasidor med sokfalt + kort (props: `count`, `showSearch`)

Valj skeleton baserat pa sidans dominerande layout, inte sidans namn.

### FirstUseTooltip med localStorage-persistens
- Exportera rena hjalpfunktioner for testning
- `useEffect` for mount-state undviker hydration mismatch
- `onOpenChange` callback for dismiss vid klick utanfor
- localStorage-nyckel: `equinet-firstuse-{id}-dismissed`

### Subagent-driven mekanisk refaktorering
Nar N sidor behover identisk andring: (1) definiera monstret tydligt, (2) dela i 4-5 grupper, (3) kor parallella subagenter. Funkar bra for import + ersattning.

## Larandeeffekt

**Nyckelinsikt:** Content-aware skeletons ar en "high leverage, low risk"-forbattring -- varje sida kravde bara 2 andringar (import + byt div) men anvandarna far markbart battre upplevd prestanda. Separera testbar logik fran React-rendering gor TDD naturligt aven for UI-komponenter.
