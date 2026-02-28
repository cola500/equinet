# Retrospektiv: Fix pre-existerande E2E-failures

**Datum:** 2026-02-18
**Scope:** Systematisk fix av ~40 pre-existerande E2E-testfailures med 5 Whys-analys

---

## Resultat

- 9 andrade filer, 0 nya filer, 0 nya migrationer
- +74/-23 rader (renodlat E2E-test-fixar)
- 325 E2E-tester pass, 63 skip, 0 failures (fran ~40 failures)
- 1959 unit-tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| E2E Fixtures | `e2e/fixtures.ts` | Global cookie-consent dismissal via `addInitScript` (localStorage) |
| E2E Specs | 7 spec-filer | `reset-rate-limit` i beforeEach for 6 specs |
| E2E Specs | `e2e/admin.spec.ts` | Mobil BottomTabBar-selectors, table-scoping, mobile skip |
| E2E Specs | `e2e/calendar.spec.ts` | Borttagen icke-existerande legend-toggle |
| E2E Specs | `e2e/accepting-new-customers.spec.ts` | `{ exact: true }` for "Bokningsinstallningar" |
| E2E Specs | `e2e/customer-reviews.spec.ts` | `{ exact: true }` for heading "Bokningar" |
| E2E Specs | `e2e/booking.spec.ts` | Mobil-anpassning av ort-filter och rensa-filter |
| E2E Specs | `e2e/feature-flag-toggle.spec.ts` | `resetRateLimit` i test 9.9 + restoreDefaults |

## Vad gick bra

### 1. 5 Whys-planen traffsaker
Planen identifierade 6 rotorsaker. Under implementation hittades 2 till (cookie-consent, strict mode). 5 Whys-analysen i planeringsfasen sparade tid -- de flesta fixar var mekaniska.

### 2. Fixture-level cookie dismissal
Istallet for att fixa cookie-consent per test (som borjade handa) identifierades grundorsaken (`CookieNotice` med localStorage) och fixades globalt i `e2e/fixtures.ts` med `addInitScript`. En rad som loser problemet for alla framtida tester.

### 3. Iterativ verifiering
Varje fix verifierades individuellt innan full suite. Detta fangade sekundara problem (strict mode violations, dolda element-matching) tidigt istallet for att behova debugga en stor batch.

### 4. Nya rotorsaker dokumenterade under arbetet
Strict mode violations (`.first()`, `{ exact: true }`, table-scoping) ar ett aterkommande monster i projektet. Att dokumentera dem har gor framtida E2E-tester mer robusta.

## Vad kan forbattras

### 1. Cookie-consent borde ha fixats tidigare
Cookie-consent-bannern har troligen orsakat dolda failures anda sedan den introducerades. Global dismissal borde ha lagts till i fixtures direkt.

**Prioritet:** LAG -- fixat nu, ingen framtida paverkan.

### 2. E2E-test strict mode patterns saknas i riktlinjer
Flera failures berodde pa att `getByText('X')` matchade dolda element (filter-options, mobil-cards). Det finns ingen E2E-riktlinje om att anvanda `{ exact: true }` eller scopa till container.

**Prioritet:** MEDEL -- bor laggas till i `.claude/rules/` for E2E.

## Patterns att spara

### Cookie-consent dismissal i fixtures
```typescript
// e2e/fixtures.ts
page: async ({ page }, use) => {
  await page.addInitScript(() => {
    localStorage.setItem('equinet-cookie-notice-dismissed', 'true')
  })
  await use(page)
}
```
Anvand `addInitScript` for att satta localStorage INNAN sidan laddas. Fungerar for alla cookie/consent/onboarding-banners.

### Strict mode-safe selektorer i E2E
- `getByText('Bokningar', { exact: true })` -- undviker att "Inga bokningar" matchar
- `page.locator('table').getByText('Avbokad').first()` -- scopar till synligt omrade
- Admin mobil: `page.locator('nav').filter({ has: page.getByRole('link', { name: 'System' }) })` -- scopar till ratt nav

### BottomTabBar E2E-monster (admin mobil)
```typescript
const adminNav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'System' }) })
// Verifiera tabs
for (const item of bottomTabItems) {
  await expect(adminNav.getByRole('link', { name: item })).toBeVisible()
}
// Oppna "Mer" drawer
await adminNav.getByRole('button', { name: /mer/i }).click()
```

## 5 Whys (Root-Cause Analysis)

### Problem: Cookie-consent blockerade klick pa mobil (ej i ursprunglig plan)
1. Varfor failade "Mer"-klicket? Cookie-consent-banner blockerade pointer events
2. Varfor blockerade den? `position: fixed; bottom: 0; z-50` overlappar BottomTabBar
3. Varfor visades cookie-consent i tester? Ingen dismissal i test-setup
4. Varfor saknade test-setup cookie-dismissal? CookieNotice lades till utan E2E-havsyn
5. Varfor testades inte mobil-viewporten? E2E mobile-tester kordes inte regelbundet

**Atgard:** Global cookie dismissal via `addInitScript` i fixtures.ts
**Status:** Implementerad

### Problem: `getByText()` matchade dolda element (strict mode violations)
1. Varfor failade `getByText('Avbokad')`? Matchade dold option i statusfilter-dropdown
2. Varfor matchade den dolda element? Playwright resolvar ALLA DOM-element, inte bara synliga
3. Varfor anvandes inte `{ exact: true }` eller scoping? Inga E2E-riktlinjer for detta
4. Varfor saknas riktlinjer? Problemet uppstar gradvis nar UI:t vaxer (fler element med liknande text)
5. Varfor fangades det inte tidigare? Testerna skrevs nar UI:t var enklare, innan t.ex. "Ombokningsinstallningar" lades till

**Atgard:** Dokumenterat patterns i retro. Bor laggas till i `.claude/rules/e2e.md`.
**Status:** Delvis implementerad (patterns dokumenterade, regler ej uppdaterade)

## Larandeeffekt

**Nyckelinsikt:** Flertalet E2E-failures hade INTE med felaktig appkod att gora -- de berodde pa att tester inte var robusta mot UI-forandringar (nya sektioner, filter-dropdowns, mobil-layout, cookie-banners). Investering i test-infrastruktur (fixtures, shared patterns, strict selectors) ger hogre avkastning an att fixa individuella tester.
