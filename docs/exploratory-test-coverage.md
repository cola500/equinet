# Exploratory Test Coverage Mapping

Mapping mellan exploratorisk testplan (11 faser) och automatiserade E2E-tester.

## Sammanfattning

| Status | Antal testfall | Procent |
|--------|---------------|---------|
| Automatiserat | ~85 | ~78% |
| Manuellt krävs | ~15 | ~14% |
| Skip (env override) | ~9 | ~8% |

## Nya E2E-specs (skapade)

| Spec | Testfall | Tester |
|------|----------|--------|
| `feature-flag-toggle.spec.ts` | Fas 0-1, 4-11 (flagg-toggling) | 30 |
| `exploratory-baseline.spec.ts` | 1.2.4, 1.8.7, 1.14.2, smoke tests | 7 |

## Fas 1: Baseline (alla flaggor AV)

| # | Testfall | E2E Spec | Status |
|---|----------|----------|--------|
| 1.1.1-1.1.4 | Autentisering (login, logout, felmeddelanden) | `auth.spec.ts` | Automatiserat |
| 1.2.1-1.2.2 | Dashboard laddar, stat-kort visas | `provider.spec.ts` | Automatiserat |
| 1.2.3 | "Logga arbete" INTE synlig (voice_logging av) | `feature-flag-toggle.spec.ts` | Automatiserat |
| 1.2.4 | Stat-kort navigering | `exploratory-baseline.spec.ts` | Automatiserat |
| 1.3.1 | Flag-beroende nav-items INTE synliga | `feature-flag-toggle.spec.ts` | Automatiserat |
| 1.3.2 | Alltid-synliga nav-items visas | `feature-flag-toggle.spec.ts` | Automatiserat |
| 1.4.1-1.4.6 | Tjänstehantering (CRUD) | `provider.spec.ts` | Automatiserat |
| 1.5.1-1.5.6 | Bokningshantering (filter, accept, avboj, genomford, ej infunnen) | `provider.spec.ts` | Automatiserat |
| 1.6.1-1.6.3 | Kalender (veckovy, navigation) | `calendar.spec.ts` | Automatiserat |
| 1.6.4 | Klicka bokning -> detaljdialog | - | Manuellt |
| 1.6.5 | Klicka veckodag -> redigera oppettider | `calendar.spec.ts` | Automatiserat |
| 1.6.6 | Klicka datum -> undantagsdialog | `calendar.spec.ts` | Automatiserat |
| 1.6.7 | Manuell bokning via "+" | `manual-booking.spec.ts` | Automatiserat |
| 1.7.1-1.7.5 | Kundregister (sok, detaljer, anteckningar) | `customer-registry.spec.ts`, `provider-notes.spec.ts` | Automatiserat |
| 1.7.6 | Insiktskort INTE synligt | `customer-insights.spec.ts` | Automatiserat |
| 1.8.1-1.8.4 | Profil (personuppgifter, foretagsinfo, geocoding) | `provider.spec.ts` | Partiellt |
| 1.8.5 | Acceptera nya kunder toggle | `accepting-new-customers.spec.ts` | Automatiserat |
| 1.8.6 | Ombokningsinstallningar | `reschedule.spec.ts` | Automatiserat |
| 1.8.7 | Aterkommande bokningar max | `exploratory-baseline.spec.ts` | Skip (kräver flag) |
| 1.9.1-1.9.2 | Recensioner (lista, svara) | `customer-reviews.spec.ts` | Automatiserat |
| 1.10.1-1.10.8 | Sok och boka (sok, profil, dialog, steg) | `booking.spec.ts` | Automatiserat |
| 1.10.9 | Serie-alternativ INTE synligt | `feature-flag-toggle.spec.ts` (9.9) | Automatiserat |
| 1.11.1-1.11.4 | Mina bokningar (filter, avboka) | `booking.spec.ts` | Automatiserat |
| 1.11.5 | Lamna recension | `customer-reviews.spec.ts` | Automatiserat |
| 1.12.1-1.12.5 | Hastar (CRUD, historik) | `horses.spec.ts` | Automatiserat |
| 1.13.1 | Gruppbokningar INTE synligt i kundnav | `feature-flag-toggle.spec.ts` | Automatiserat |
| 1.13.2 | Alltid-synliga kundnav-items | `feature-flag-toggle.spec.ts` | Automatiserat |
| 1.14.1 | Admin dashboard KPI | `admin.spec.ts` | Automatiserat |
| 1.14.2 | Admin system (DB, flags, email) | `exploratory-baseline.spec.ts` | Automatiserat |
| 1.14.3-1.14.4 | Admin users (sok, blockera) | `admin.spec.ts` | Automatiserat |

## Fas 2: self_reschedule PA

| # | E2E Spec | Status |
|---|----------|--------|
| 2.1-2.8 | `reschedule.spec.ts` | Automatiserat (env-override, alltid PA) |

## Fas 3: customer_insights PA

| # | E2E Spec | Status |
|---|----------|--------|
| 3.1-3.5 | `customer-insights.spec.ts` | Automatiserat (env-override, alltid PA) |

## Fas 4-10: Feature flag toggles

| Fas | Flagga | E2E Spec | Status |
|-----|--------|----------|--------|
| 4 | business_insights | `feature-flag-toggle.spec.ts` (4.1, 4.2, 4.5) | Automatiserat |
| 5 | route_planning | `feature-flag-toggle.spec.ts` (5.1, 5.2, 5.5) | Automatiserat |
| 6 | route_announcements | `feature-flag-toggle.spec.ts` (6.1, 6.6) | Automatiserat |
| 7 | due_for_service | `feature-flag-toggle.spec.ts` (7.1, 7.2, 7.4) | Automatiserat |
| 8 | voice_logging | `feature-flag-toggle.spec.ts` (8.1-8.3, 8.6) | Automatiserat |
| 8.4 | Mikrofon-dialog | - | Manuellt (browser permission) |
| 8.5 | Mobil FAB-knapp | - | Manuellt (mobil-specifik) |
| 9 | recurring_bookings | `feature-flag-toggle.spec.ts` (9.2, 9.9) | Automatiserat (toggle) |
| 9.3-9.8 | Full serie-skapning | - | Manuellt (komplex flow) |
| 10 | group_bookings | `feature-flag-toggle.spec.ts` (10.1-10.3, 10.5) | Automatiserat |

## Fas 11: Alla flaggor PA

| # | E2E Spec | Status |
|---|----------|--------|
| 11.1-11.3 | `feature-flag-toggle.spec.ts` | Automatiserat |
| 11.4 | Serie + ombokning | - | Manuellt |
| 11.5 | Sidladdningstid | `exploratory-baseline.spec.ts` (smoke) | Automatiserat |
| 11.6 | Console-fel | `feature-flag-toggle.spec.ts` (11.6) | Automatiserat |

## Kvarvarande manuella tester

Dessa tester kraver manuell verifiering:

1. **1.6.4** - Kalender: klicka bokning -> detaljdialog (komplex interaktion)
2. **1.8.1-1.8.4** - Profilredigering (geocoding kraver extern API)
3. **8.4** - Mikrofon-dialog (kraver browser permission)
4. **8.5** - Mobil FAB-knapp (kraver faktisk mobil viewport-interaktion)
5. **9.3-9.8** - Aterkommande bokningar: full serie-skapning (komplex multi-step)
6. **11.4** - Serie + ombokning kombinerat (cross-feature interaktion)

## Observerad bugg: In-memory flag isolation i Next.js dev

**Beskrivning:** I Next.js dev-mode kan API-routes och Server Components ha separata in-memory modulinstanser. Admin-toggle via API uppdaterar API-routens instans men SSR kan lasa fran en annan instans med default-varden.

**Paverkan:** Lokal utveckling. I produktion (med Redis) delas flaggstaten korrekt.

**Workaround i E2E:** Dispatcha `featureflags-changed` custom event efter navigation for att trigga client-side refetch fran `/api/feature-flags`.
