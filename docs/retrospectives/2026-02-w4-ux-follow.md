# Vecka 4 Februari del 2: UX & Följ leverantör (2026-02-22 -- 2026-02-25)

> Konsoliderad sammanfattning av 7 retrospectives från session 52-58: UX-förbättringar, följ-leverantör-system, per-service intervall, feature flag hardening, refaktorering och hook-refaktorering.

---

## Sammanfattning

| Session | Datum | Ämne | Resultat |
|---------|-------|------|----------|
| 52 | 2026-02-22 | UX-förbättringsplan (15 items) | 33 filer, 25 tester, lösenordsåterställning + UI-polish |
| 53 | 2026-02-23 | E2E-tester för följ-leverantör | 2 filer, 10 E2E-tester (chromium + mobile) |
| 54 | 2026-02-23 | Följ leverantör + notifiering | 10 ändrade + 20 nya filer, 42 tester, fire-and-forget notifier |
| 55 | 2026-02-23 | Per-service intervall (provider) | 12 ändrade filer, 83 nya tester, datamigrering |
| 56 | 2026-02-24 | Feature flag hardening | 48 ändrade filer, 19 nya tester, client-safe modulseparation |
| 57 | 2026-02-24 | Snabba refaktoreringsvinster | 10 ändrade + 2 nya filer, -132 rader, Haversine + error mappers |
| 58 | 2026-02-25 | Sprint D - Hook-refaktorering | 11 ändrade filer, -770 rader UI (5 nya komponenter) |

**Totalt denna vecka:** ~130 ändrade/nya filer, ~168 nya tester, 2575 totala tester, 0 regressioner.

---

## Viktiga learnings

### DDD-mönster skalerar till nya domäner
Review-mönstret (IRepository → MockRepo → PrismaRepo → Service → Factory → Route) kopierades framgångsrikt för Follow-domänen. Varje lager scaffoldades på < 5 minuter tack vare etablerade patterns. **Insikt:** Mönster är kodets mest värdefulla tillgång -- när de är väl designade skalerar nya features utan arkitekturisk overhead.

### Fire-and-forget notifier med dependency injection
RouteAnnouncementNotifier fick alla beroenden via constructor (followRepo, notificationService, emailService, etc.). Gjorde testning trivial med mocks, och produktions-factory:n kopplar ihop allt. Pattern återanvänds för framtida side-effects (webhooks, async events). **Insikt:** DI gör det möjligt att testa asynkrona operationer utan att faktiskt skicka e-post/anrop.

### Feature flags i E2E kräver env-variabler
Feature flag-gated E2E-tester misslyckades med admin API-toggle ensamt (modulinstans-isolation i dev mode). Lösning: `FEATURE_X=true` i `.env` + admin API i beforeAll/afterAll. **Insikt:** Prioritetskedjan `env > Redis > in-memory > default` gör att env-variabler är den enda mekanism som garanterat fungerar i ALLA modulinstanser.

### Per-service override map pattern
Vid schema-utvidgning (från `[horseId, providerId]` till `[horseId, providerId, serviceId]`): byt Map-nyckel från `entityId` till `` `${entityId}:${serviceId}` `` i ALLA konsumenter (3 domain-filer + 2 routes). Mönstret är identiskt överallt -- inga specialfall. **Insikt:** Grep för alla `overrideMap.get(` före implementation för att undvika missade referenser.

### Client-safe modulseparation
PrismaClient krascher i browser när klient-komponenter indirekt importerar server-only moduler. Lösning: extrahera metadata (`FEATURE_FLAGS`, typer) till `feature-flag-definitions.ts` (utan Prisma), re-exportera från `feature-flags.ts`. **Insikt:** Next.js bundler respekterar inte runtime-grensar -- allt som KAN importeras KOMMER att bundlas.

### Context eliminerar prop-drilling snabbare än hook-splitting
Original-plan var att splitta `useBookingFlow` (302 rader) i 5 delar. Analys visade att hooken var väl strukturerad -- problemet var 22-prop drilling och duplicerad markup i konsumenter. Context + 4 delade subkomponenter (BookingSummaryCard, HorseSelector, RecurringSection, FlexibleBookingForm) minskade MobileBookingFlow från 679 → 330 rader (-51%) och DesktopBookingDialog från 585 → 246 rader (-58%). **Insikt:** Analysera VAR problemet sitter innan du refaktorerar.

### Parallella agenter för bred kodanalys
4 agenter analyserade samtidigt (stora filer, duplikation, komponentarkitektur, testtäckning). Total analystid ~3 minuter för vad som annars hade tagit 30+ minuter. Dokumenterade till prioriterad refaktoreringsplan. **Insikt:** Specialiserade parallella agenter är överlägsen sekventiell manual-kodgenomgång.

### Enumeration prevention för publika auth-endpoints
`forgot-password` och `reset-password` är publika men returnerar ALLTID samma framgångsresponse oavsett om e-postadressen finns. Rate limiting per IP (inte per email). **Insikt:** Säkerhet på publika endpoints kräver konstant response-tid, inte bara rate limiting.

### Designtokens definieras men migreras inte
CSS-variabler för status-färger (--status-confirmed, --status-pending, etc.) lades till globalt men ~56 instanser av hardkodade färger migrerades inte. Teknisk skuld, låg prioritet, men principen att "introducera standarder" måste följas av "migrering". **Insikt:** Design-standardisering kräver två sessioner (introducera + migrering), inte en.

---

## Nyckelmetrik

| Metrik | Värde |
|--------|-------|
| Tester skrivna | 168 nya |
| Totalt testantal | 2575 |
| Regressioner | 0 |
| Typecheck-fel | 0 |
| Lint-varningar | 0 |
| Rader bortagna (refaktorering) | -770 |
| Rader tillagda (netto) | +375 |
| Filer ändrade | ~130 |
| E2E-specs (alla TDD) | 10 nya |
| Feature-gated API-routes | 31 |
| Features implementerade | 7 (lösenord, follow, interval, E2E, flags, refactor, context) |

---

## Root Cause Analysis: 5 Whys per session

### Session 52 (UX): Design-tokens utan migrering
1. **Varför?** Designtokens definierades men inte applicerades på befintlig kod
2. **Varför?** Two-phase-approach saknades (define → apply)
3. **Varför?** Prioriteringen var "alla features först, styling senare"
4. **Varför?** CSS är inte kritisk för funktionalitet
5. **Varför?** Projektets kultur prioriterar affärslogik över design-konsistens

**Åtgärd:** Dokumentera att designtokens kräver två sessioner.

### Session 53 (E2E): Modulinstans-isolation döljer feature flags
1. **Varför?** E2E-tester failade trots admin API flag-toggle
2. **Varför?** `isFeatureEnabled()` returnerade false i API-routens instans
3. **Varför?** Admin API uppdaterade en ANNAN modulinstans (in-memory state delas inte)
4. **Varför?** Next.js dev mode skapar separata modulinstanser för HMR
5. **Varför?** Hot module replacement kräver isolering för snabb omstart

**Åtgärd:** Använd env-variabler (`FEATURE_X=true` i `.env`) -- högsta prioritet, delas av ALLA instanser.

### Session 54 (Follow): Feature flag-tester med hardcoded lista
1. **Varför?** Nya tester failed på hardcoded flagg-lista i `feature-flags.test.ts`
2. **Varför?** `toEqual()` jämför EXAKT lista av alla flaggor
3. **Varför?** Manuell uppdatering kräver två testfiler per ny flagga
4. **Varför?** Ingen dynamisk test-hjälpare för flagg-lista
5. **Varför?** Lagret skapades innan multi-feature-flag-systemet var stabilt

**Åtgärd:** Låg prioritet -- sällan uppdaterat, fel är uppenbart.

### Session 55 (Interval): Migrerings-SQL failade med duplicate key
1. **Varför?** INSERT failade på unique constraint `(horseId, providerId)`
2. **Varför?** Gamla constrainten var kvar när datamigreringssteget kördes
3. **Varför?** DROP INDEX låg EFTER DO-blocket i SQL
4. **Varför?** Migrationen skrevs i "logisk ordning" utan att tänka på constraints
5. **Varför?** Ingen checklista för migrationer med constraint-ändringar + datamigrering

**Åtgärd:** DOKUMENTERA migration-ordning: "Vid constraint-ändringar + datamigrering: ALLTID droppa gamla constrainten FÖRE datamigreringssteget."

### Session 56 (Feature flags): PrismaClient kraschar i browser
1. **Varför?** `admin/system/page.tsx` ("use client") importerar PrismaClient indirekt
2. **Varför?** Filen importerar `FEATURE_FLAGS` från `@/lib/feature-flags`
3. **Varför?** `feature-flags.ts` importerar `featureFlagRepository` som importerar Prisma
4. **Varför?** Commit `f121831` (Redis → PostgreSQL) lade till Prisma-importer utan modulseparation
5. **Varför?** Inget pattern för att skilja klient-safe metadata från server-only logik

**Åtgärd:** Skapade `feature-flag-definitions.ts` (klient-safe) + dokumenterade pattern i `.claude/rules/feature-flags.md`.

### Session 57 (Refaktorering): RouteOrder saknar repository
1. **Varför?** RouteOrder är kärndomän men saknar IRepository
2. **Varför?** Routen använder Prisma direkt istället för repository
3. **Varför?** Implementationen före repository-compliance-policy
4. **Varför?** Repository-pattern var inte obligatoriskt för alla kärndomäner då
5. **Varför?** Projektet växte organiskt utan initial arkitektur-blueprint

**Åtgärd:** Medel prioritet. Blockerar repository-compliance men fungerar.

### Session 58 (Context): DesktopBookingDialog visar summary direkt vid öppning
1. **Varför?** `showSummary` är `true` när dialogen öppnas
2. **Varför?** State återställdes inte vid förra stängningen
3. **Varför?** `handleOpenChange` anropas bara vid användarinteraktion
4. **Varför?** Radix Dialog's `onOpenChange` triggar inte vid programmatisk `open`-ändring
5. **Varför?** Radix designval -- kontrollerad komponent rapporterar bara användar-initierade ändringar

**Åtgärd:** `useEffect(() => { if (isOpen) setShowSummary(false) }, [isOpen])` -- återställ vid varje öppning. Dokumenterat som GOTCHAS.md #28.

---

## Patterns att spara

### 1. DDD-domän-scaffolding
**Mallkod för ny kärndomän:**
```
src/infrastructure/persistence/{domain}/
├── I{Domain}Repository.ts
├── Mock{Domain}Repository.ts
├── Prisma{Domain}Repository.ts
└── index.ts

src/domain/{domain}/
├── {Domain}Service.ts
├── {Domain}Service.test.ts
├── {Domain}Factory.ts (DI)
└── map{Domain}ErrorToStatus.ts

src/app/api/{domain}/
├── route.ts (handler)
├── route.test.ts (auth + validation + service)
```
Estimat: <1 session per domän när mönster är känt.

### 2. Feature flag-gated E2E
```typescript
// 1. .env + playwright.config.ts webServer.env
FEATURE_X=true

// 2. beforeAll: admin login + toggle
await page.goto('/admin/system')
await adminToggleFlag('flag_name', true)

// 3. UI-baserad interaction, INTE Prisma-seeding
await page.getByRole('button', { name: 'Follow' }).click()

// 4. Cleanup i afterAll
await adminToggleFlag('flag_name', false)
```

### 3. Client-safe modulseparation
```
lib/feature-flag-definitions.ts
├─ export FEATURE_FLAGS = { ... } // Ingen Prisma
├─ export type FeatureFlag = ...
└─ // Importeras av "use client"-komponenter

lib/feature-flags.ts
├─ export { FEATURE_FLAGS } from './feature-flag-definitions'
├─ export async function isFeatureEnabled(...) { ... }
└─ // Server-only logik, Prisma-access
```

### 4. Per-service override map pattern
```typescript
// Ändring från [key] till [key:serviceId]
const map = new Map<string, HorseServiceInterval>()

// SET
map.set(`${horseId}:${serviceId}`, interval)

// GET
const interval = map.get(`${horseId}:${serviceId}`)
```
Appliceras konsistent i: DueForServiceService, DueForServiceLookup, provider due-for-service route.

### 5. Fire-and-forget notifier
```typescript
// I API route:
if (await isFeatureEnabled("follow_provider")) {
  notifier.notifyFollowersOfNewRoute(id).catch(err =>
    logger.error("Failed to notify", err)
  )
}

// I notifier: dedup via NotificationDelivery
const alreadyDelivered = await deliveryStore.exists(routeOrderId, customerId, "in_app")
if (alreadyDelivered) { skipped++; continue }
```

### 6. Context + shared subcomponents
**Ej:** Hook-splitting (Splitta `useBookingFlow` i 5 delar)
**Ja:** Context + delade UI-komponenter
```typescript
<BookingFlowProvider>
  <BookingSummaryCard /> {/* Läser från context */}
  <HorseSelector /> {/* Läser från context */}
  <RecurringSection /> {/* Läser från context */}
</BookingFlowProvider>
```

### 7. Kanonisk utility-modul
För duplicerad beräkning:
1. Välj implementation med tester + extra utilities
2. Peka ALLA imports dit (`lib/geo/distance.ts` har både `calculateDistance()` och `filterByDistance()`)
3. Ta bort övriga
4. Dokumentera i comments varför det är kanonisk källa

### 8. Enumeration prevention
Publika auth-endpoints (forgot-password, reset-password):
- ALLTID samma framgångsresponse oavsett om e-postadressen finns
- Rate limiting per IP (inte per email)
- Zod `.strict()` för JSON-validering

---

## Tekniska skuld identifierad (men avsatt)

| Område | Beskrivning | Prioritet | Estimat |
|--------|-------------|-----------|---------|
| Design-tokens | 56 färg-instanser använder inte CSS-variabler | LAG | 1 session |
| Payment route | 239 rader utan tester, högt finansiellt risk | HOG | 2 sessioner |
| Stora sidor | 4 sidor > 1000 rader (provider/customers, BookingService, etc.) | MEDEL | 2-3 sessioner |
| RouteOrder | Saknar repository, bryter DDD-mönster | MEDEL | 1-2 sessioner |
| E2E booking.spec.ts | 2 av 3 chromium-tester flaky/bruten (Radix Dialog bug) | MEDEL | 1 session |

---

## Reflektioner

### Vad som fungerade
- **Fasindelning med typechecks mellan varje fas** (session 52): Kvalitetsgrindar tidigt = 0 ackumulerade fel vid slutverifiering
- **TDD-approach**: 168 nya tester utan regressioner visar att röd-grön-refactor-cykeln fungerar
- **Parallella agenter för kodanalys**: ~3 minuter för vad som tar 30+ minuter manuellt
- **Befintliga patterns som mall**: DDD-domäner scaffoldas på < 5 minuter när patterns är etablerade

### Vad som kan förbättras
- **Commit mellan faser** (session 52): Alla items commitades i en stor commit -- svårare att identifiera regression
- **Längre session-kontext skulle spara overhead** (session 52): Context-split mellan fas 5 och 6 skapade overhead
- **Worktree-begränsningar** (session 56): Kunde inte checka ut main i worktree under merge
- **E2E flakiness**: 2 av 3 tester i booking.spec.ts failade även på main -- borde ärenderas separately

---

## Affärsvärde

Denna vecka levererade:
1. **Användarupplevelse:** Lösenordsåterställning, följ leverantör, bättre UI (FAQ, flikar, sortering)
2. **Data-granularitet:** Per-service intervall för leverantörer (parity med kundgränssnittet)
3. **Infrastruktur:** Feature flag-hardening (31 routes gated), E2E-testsvit för follow
4. **Kod-hälsa:** -132 rader duplikation, 0 regressioner, 0 lint-varningar

**Nästa fokus:** Payment-route testning (HOG prioritet), RouteOrder repository (MEDEL), E2E flakiness (MEDEL).

---

*Originaldokument: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)*

Senast uppdaterad: 2026-02-25
