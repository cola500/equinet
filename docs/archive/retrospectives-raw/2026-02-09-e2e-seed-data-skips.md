# Retrospektiv: E2E seed-data for reducerade skips

**Datum:** 2026-02-09
**Scope:** Forbattrad E2E seed-data for att minska skips fran 13 till 7

---

## Resultat

- 6 andrade filer, 0 nya filer, 0 nya migrationer
- 248 tillagda / 152 borttagna rader (netto +96)
- 1332 unit-tester (alla grona, inga regressioner)
- E2E: 95 pass, 7 skip, 1 fail (fran 90 pass, 13 skip, 0 fail)
- Typecheck = 0 errors

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| E2E utilities | `e2e/setup/e2e-utils.ts` | Ny `futureWeekday()` som garanterar vardag (man-fre) |
| E2E seed | `e2e/setup/seed-helpers.ts` | `seedRoute()` helper, `routeOrderId` opt, annons-status `open`, utokad cleanup med Route-borttagning |
| E2E spec | `e2e/announcements.spec.ts` | Dubbla annonser + pending bokning, iterate-pattern for bekrafta-knapp |
| E2E spec | `e2e/customer-reviews.spec.ts` | Tva completed bookings, robustare selektorer med `.first()` och iterate |
| E2E spec | `e2e/route-planning.spec.ts` | `seedRoute()`, fixade selektorer (`data-slot`), tvasteg start->complete |
| E2E spec | `e2e/flexible-booking.spec.ts` | Seedat route order + kopplad bokning i beforeAll |

## Fixade tester (6 skips eliminerade)

| Spec | Tester | Rotorsak |
|------|--------|----------|
| announcements | 3 (confirm + 2 kundtester) | Status `pending` -> `open`, saknad bokning, cancel forstorde data |
| route-planning | 2 (view details + mark complete) | Ingen seedat rutt, trasig CSS-selektor, tvasteg-flode |
| customer-reviews | 2 fails -> 0 pass | Strict mode violation (2 kort), saknad andra bokning |

## Vad gick bra

### 1. Rotorsaksanalys avslojde djupare problem
Planens ursprungliga hypoteser (helgdatum, saknad data) var korrekta for nagra skips, men de verkliga rotorsakerna var ofta annorlunda: felaktig status (`pending` vs `open`), trasiga CSS-selektorer (`border.rounded-lg` matchar inte shadcn Card langre), och tvasteg-UI-floden (Paborja besok -> Markera som klar).

### 2. Iterativ debugging-cykel
Att kora specs isolerat (`npx playwright test e2e/announcements.spec.ts`) var ovardelig for att snabbt iterera. Varje fix verifierades isolerat innan full suite.

### 3. seedRoute() monstret
Ny helper som skapar Route + RouteStops direkt i DB, med egna taggade route orders for cleanup. Oberoende av UI-skapade rutter, vilket gor testerna stabila.

### 4. Iterate-pattern for multi-match
Istallet for att anta att forsta elementet ar ratt (`.first()`), iterera genom alla alternativ for att hitta det med ratt state. Anvant i bade customer-reviews (hitta orecenserad bokning) och announcements (hitta annons med pending bokning).

## Vad kan forbattras

### 1. shadcn CSS-selektorer ar brakliga
`.border.rounded-lg` slutade fungera nar shadcn uppgraderades till `data-slot`-attribut och `rounded-xl`. Alla E2E-tester som anvander CSS-klass-selektorer for shadcn-komponenter bor migreras till `data-slot` eller `getByRole/getByText`.

**Prioritet:** MEDEL -- kvarvarande specs (booking, provider, calendar) har sannolikt samma problem.

### 2. Annons-status var odokumenterad
Att `provider_announced` route orders behover `status: 'open'` (inte `pending`) for att synas publikt var inte dokumenterat nagonsstans. Seedern hade `pending` fran borjan.

**Prioritet:** LAG -- nu dokumenterat i MEMORY.md och denna retro.

### 3. Kvarvarande 7 skips
Booking (2), calendar (1), flexible-booking (2) och provider (2) skippar fortfarande. De beror pa UI-interaktionsproblem (kalendertider, pending-bokningar) snarare an seed-data.

**Prioritet:** MEDEL -- bor fixas i nasta E2E-session.

## Patterns att spara

### futureWeekday() for helgrobusthet
`futureWeekday(days)` adderar N dagar och skiftar lordag/sondag till mandag. Ateranvandbar for alla seed-funktioner som skapar framtida datum for leverantorer med man-fre tillganglighet.

### seedRoute() for pre-existerande rutter
Skapar Route + RouteStops direkt i DB med taggade route orders (`specTag-route`). Cleanup kraver att BADA tags rensas (`cleanupSpecData(tag)` + `cleanupSpecData(tag + '-route')`).

### Iterate-pattern for dynamisk UI-state
Nar testet behover hitta ett specifikt element bland manga (t.ex. "hitta bokning utan recension"), iterera genom alla matchande element istallet for att anta position:
```typescript
for (let i = 0; i < cardCount; i++) {
  const card = cards.nth(i);
  const btn = card.getByRole('button', { name: /target/i });
  if (await btn.isVisible().catch(() => false)) { /* found */ break; }
}
```

## Larandeeffekt

**Nyckelinsikt:** E2E skips beror salllan pa en enda rotorsak. Varje skip kravde djupare analys -- fran seed-data, till API-filter, till CSS-selektorer, till UI-flodesordning. Att fixa skips iterativt (en spec at gangen, isolerat) ar mycket effektivare an att forsoka fixa allt pa en gang.
