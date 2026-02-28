# Retrospektiv: Officiell hastidentifiering + Namnbyte hastpass -> hastprofil

**Datum:** 2026-02-10
**Scope:** Nya falt for UELN och mikrochip pa Horse + rename "hastpass" till "hastprofil" i hela kodbasen

---

## Resultat

- 24 andrade filer, 0 nya filer, 1 ny migration
- 1 nytt test (UELN/chip i profil-response), 1337 totala tester
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma`, migration SQL | Rename `HorsePassportToken` -> `HorseProfileToken`, nya falt `registrationNumber` + `microchipNumber` pa Horse |
| Repository | `IHorseRepository.ts`, `HorseRepository.ts`, `MockHorseRepository.ts` | Rename `PassportToken`/`createPassportToken` -> `ProfileToken`/`createProfileToken`, nya falt i Horse/CreateHorseData/UpdateHorseData, horseSelect utokat |
| Domain | `HorseService.ts` | Rename `PassportResult`/`createPassportToken` -> `ProfileResult`/`createProfileToken`, ExportResult.horse + nya falt |
| API (6 routes) | `horses/route.ts`, `horses/[id]/route.ts`, `horses/[id]/profile/route.ts`, `profile/[token]/route.ts`, `horses/[id]/export/route.ts`, `customers/[id]/horses/route.ts`, `export/my-data/route.ts` | Zod-schema (max 15 tecken), select-block, response-objekt, URL-byten |
| Export | `export-utils.ts` | `FlatHorse` + `flattenHorses()` utokade med nya falt |
| Hooks | `useHorses.ts` | `HorseData` utokad |
| UI (4 sidor) | `customer/horses/page.tsx`, `customer/horses/[id]/page.tsx`, `ShareProfileDialog.tsx`, `profile/[token]/page.tsx` | Formularfalt, detaljvy, delbar profil-sida, alla UI-strangar |
| Tester (5 filer) | `HorseService.test.ts`, `horses/[id]/profile/route.test.ts`, `profile/[token]/route.test.ts`, `export-utils.test.ts` | Rename + mockHorse-fixtures + nytt UELN/chip-test |
| Docs | `API.md` | Uppdaterade endpoint-namn |
| E2E | `cleanup-utils.ts` | Kommentar-fix |

## Vad gick bra

### 1. Mekanisk rename gick smidigt tack vare DDD-lager
Tack vare att koden ar organiserad i tydliga lager (IRepository -> Repository -> Service -> Route) kunde rename-arbetet goras systematiskt utan att missa nagot. `grep` bekraftade noll kvarvarande "passport"-referenser i src/ efter jobbet.

### 2. Nya falt adderades utan att bryta nagot
Alla 1336 befintliga tester forblev grona trots att Horse-interfacet utokades med tva nya falt. Nullable falt + `toMatchObject` i tester = frikopplat. Bara `makeHorse`-fixturen i HorseService.test och export-utils.test behovde uppdateras.

### 3. git mv bevarade historik
Genom att anvanda `git mv` istallet for att radera+skapa nya filer bevaras filhistoriken, vilket gor framtida `git log` och `git blame` mer anvandbart.

### 4. Custom SQL migration for rename
Prisma auto-detekterar inte renames (den gor DROP + CREATE). Genom att skriva custom migration-SQL (`ALTER TABLE ... RENAME TO`) undveks dataloss och onodiga index-ombyggnader.

## Vad kan forbattras

### 1. Ingen UELN-formatvalidering
Vi validerar bara max langd (15 tecken) men inte UELN-format (landsprefix + databas + ID). Jordbruksverkets riktiga format ar striktare.

**Prioritet:** LAG -- MVP behover bara friformstext. Formatvalidering kan laggas till nar vi integrerar med Jordbruksverkets API.

### 2. Ingen redirect fran /passport/ till /profile/
Gamla /passport/-lankar slutar fungera direkt. En enkel redirect-route hade kunnat ge batttre upplevelse for existerande delningar.

**Prioritet:** LAG -- MVP med fa anvandare, och tokens har 30 dagars expiry. Inga gamla lankar i produktion annu.

## Patterns att spara

### Rename-steg for Next.js route-mappar
1. `git mv` for filflyttar (bevarar historik)
2. Uppdatera alla identifierare bottom-up (Interface -> Repo -> Service -> Route)
3. `grep -r` for att verifiera noll kvarvarande referenser
4. Custom SQL migration for tabellrename (`ALTER TABLE RENAME TO`)

### Nullable falt pa befintlig modell
Lagg till som `String?` (nullable) -- kraver ingen datamigration. Uppdatera: (1) Prisma schema, (2) Interface-typ, (3) horseSelect, (4) create() data-mapping, (5) update schema, (6) alla select-block i routes, (7) export-utils, (8) UI hook-typ, (9) formular.

## Larandeeffekt

**Nyckelinsikt:** Stora rename-operationer ar sakrare an de ser ut nar kodbasen har tydlig lagerstruktur. DDD-Light med IRepository-interface gor att man kan jobba systematiskt bottom-up utan att missa nagot. Nyckeln ar `grep` som verifiering efter varje steg.
