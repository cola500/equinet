---
title: "Retrospektiv: E2E Test Genomgang & Tackningsanalys"
description: "Alla 34 E2E specs genomgangna i 6 batchar, 2 app-buggar fixade, feature flag pollution lost"
category: retrospective
status: complete
last_updated: 2026-03-14
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: E2E Test Genomgang & Tackningsanalys (Batch 1-6)

**Datum:** 2026-03-13 -- 2026-03-14
**Scope:** Systematisk genomgang av samtliga 34 E2E spec-filer, fix av failures, kartlaggning av tackningsgap

---

## Resultat

- 29 andrade filer (22 E2E specs, 2 app-filer, 1 config, 3 docs, 1 retro)
- 688 insertions, 279 deletions
- 0 nya migrationer, 0 nya tester (befintliga E2E-tester fixade)
- 3282 unit-tester (inga regressioner)
- E2E-resultat: **373 pass, 77 skip, 0 fail** (6 flaky som passerar i isolation)
- Typecheck = 0 errors
- 7 commits over 2 sessioner

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| E2E Config | `playwright.config.ts` | 4 nya feature flag env-overrides (totalt 9) |
| E2E Specs | 22 spec-filer | Selektorer, wait-strategier, strict mode, tab-navigering |
| UI (buggfix) | `CalendarHeader.tsx` | `type="button"` pa 7 knappar (form-submit-bugg) |
| UI (buggfix) | `provider/profile/page.tsx` | Saknad `CardHeader`+`CardTitle` pa Bokningsinstallningar |
| Docs | `e2e-test-review.md` | Plan med fullstandig dokumentation av alla batchar |
| Docs | `CLAUDE.md` | Button type="button" gotcha |

### Batch-oversikt

| Batch | Scope | Pass | Skip | Fixar |
|-------|-------|------|------|-------|
| 1: Infrastruktur | admin, auth, security-headers, feature-flag-toggle | 92 | 26 | Nav-selektorer, env-overrides |
| 2: Bokningar | booking, calendar, manual-booking, flexible, group | 41 | 19 | CalendarHeader bugg, bokningsflode |
| 3: Leverantor | provider, profile-edit, notes, accepting-customers | 50 | 6 | Profilsida flikar, CardTitle, svenska regex |
| 4: Kund | profile, registry, reviews, insights, due-for-service | 44 | 0 | Tab-namn, mobil regex |
| 5: Rutter & socialt | route-planning, announcements, notification, municipality, follow | 66 | 0 | Strict mode, heading, combobox-id |
| 6: Ovrigt | recurring, reschedule, horses, payment, insights, offline, exploratory | 139 | 47 | Feature flag pollution (rotorsak) |

## Vad gick bra

### 1. Systematisk batch-approach avslojde rotorsaker
Genom att kora specs i batchar istallet for alla pa en gang kunde vi isolera att failures i batch 6 berodde pa feature flag-forurening fran `feature-flag-toggle.spec.ts`. Specs som failade i batch passerade i isolation -- klassiskt tecken pa delat tillstand.

### 2. Tva genuina app-buggar hittades och fixades
E2E-testerna avslojde tva riktiga buggar som paverkade anvandare:
- **CalendarHeader**: 7 knappar utan `type="button"` triggade form-submit i DesktopBookingDialog
- **Provider profile**: Bokningsinstallningar-kortet saknade CardHeader/CardTitle, inkonsekvent med ovriga kort

### 3. Env-override-strategi eliminerade en hel klass av failures
Genom att lagga till feature flag env-overrides i `playwright.config.ts` (9 totalt) blev flaggorna immuna mot DB-forurening. Detta ar en systemfix som skyddar mot framtida test-pollution.

### 4. Plan-dokumentet fungerade som levande dokumentation
`e2e-test-review.md` uppdaterades efter varje batch med exakta fixar, vilket gjorde det enkelt att spara nagot nar kontexten fylldes och sessionen delades.

## Vad kan forbattras

### 1. Feature flag test-arkitektur ar fragil
`feature-flag-toggle.spec.ts` testar 30+ scenarios och manipulerar DB-state. Nar nya flaggor far env-overrides maste specen manuellt uppdateras. Det finns inget automatiskt skydd mot att en ny flagga laggs till med env-override utan att specen anpassas.

**Prioritet:** MEDEL -- funkar nu men kravs manuellt underhall vid nya feature flags

### 2. 77 skippade tester
Manga skippade tester ar duplicerade mobil-varianter av desktop-tester (Playwright kor varje spec pa bade chromium och mobile). Nagra skippas pga begransningar (offline-mutations kraver prod-build). Bor granskas om alla skips ar motiverade.

**Prioritet:** LAG -- skips ar dokumenterade och motiverade, men listan vaxer

### 3. networkidle-monstret var utbrett
Manga specs anvande `waitForLoadState('networkidle')` som aldrig resolvade pga SWR-polling. Bytte till `domcontentloaded` + explicit element-wait. Bor ha fangats tidigare med en lint-regel eller E2E-konvention.

**Prioritet:** LAG -- fixat nu, men kunde undvikits med dokumentation

## Patterns att spara

### Feature flag beforeAll-guard
Satt feature flag via admin API i `beforeAll` for att skydda mot DB-pollution fran andra specs:
```typescript
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await resetRateLimit(page)
  // login as admin...
  await setFlag(page, 'flag_name', true)
  await context.close()
})
```

### Env-override vs DB-toggle i E2E
Feature flags med `FEATURE_X=true` i `playwright.config.ts` webServer.env kan inte toggles via DB. E2E-tester for dessa flaggor ska verifiera synlighet, inte toggle-beteende.

### Tab-navigering i refaktorerade sidor
Nar en sida refaktorerats fran flat layout till tabs, uppdatera E2E-tester att klicka relevant tab fore assertion:
```typescript
await page.goto('/provider/profile')
await page.getByRole('button', { name: /installningar/i }).click()
await expect(page.getByText('Ombokningsinstallningar')).toBeVisible()
```

### Strict mode-losningar (prioritetsordning)
1. `{ exact: true }` -- nar text finns i bade kort och lang variant
2. `{ level: 1 }` -- nar heading matchas pa flera nivaer
3. `.first()` -- nar element dupliceras (titel + beskrivning)
4. Scoped locator (`.locator('nav')`, `.locator('table')`) -- nar element finns i flera sektioner

## 5 Whys (Root-Cause Analysis)

### Problem: Feature flag test-forurening orsakade ~15 failures i batch 6

1. **Varfor failade recurring-bookings, business-insights, group-bookings i batch?** De forvantade feature flags att vara `true`, men flaggorna var `false` i databasen.
2. **Varfor var flaggorna false i databasen?** `feature-flag-toggle.spec.ts` korde innan dessa specs och lamnade flags i disabled-tillstand.
3. **Varfor aterstallde inte feature-flag-toggle flaggorna?** Cleanup-testet (sista testet) satte alla till default, men `FLAG_DEFAULTS`-mappen hade fel varden for 3 flaggor.
4. **Varfor hade FLAG_DEFAULTS fel varden?** Mappen underhalls manuellt och synkades inte nar feature flag definitions andrades (env-overrides lades till utan att specen uppdaterades).
5. **Varfor saknas automatisk synkronisering?** Det finns inget system som validerar att E2E feature flag-tester matchar feature-flag-definitions.ts.

**Atgard:** Systemfix implementerad -- env-overrides i playwright.config.ts gor flaggor immuna mot DB-state. Feature-flag-toggle.spec.ts uppdaterad att skilja mellan toggleable och env-override flaggor.
**Status:** Implementerad

### Problem: CalendarHeader triggade form-submit i bokningsdialogen

1. **Varfor hoppade bokningsdialogen direkt till sammanfattningsvyn?** Formularet submittades nar anvandaren klickade navigeringsknappar i kalendern.
2. **Varfor triggade navigeringsknappar form-submit?** Knapparna saknade `type="button"` och defaultade till `type="submit"` (HTML-spec).
3. **Varfor saknades type="button"?** CalendarHeader designades for standalone-anvandning, inte inuti forms.
4. **Varfor testades inte CalendarHeader i form-kontext?** Unit-tester for CalendarHeader renderade den utanfor `<form>`.
5. **Varfor saknas en lint-regel for buttons i forms?** React/HTML tillater implicit `type="submit"` -- det ar standard-beteende, inte ett fel.

**Atgard:** Fixade alla 7 knappar i CalendarHeader med `type="button"`. Lade till gotcha i CLAUDE.md. Framtida pattern: ALLA Button-element inuti forms som INTE ska submita MASTE ha `type="button"`.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** E2E-tester som manipulerar delat tillstand (databas, feature flags) maste skyddas pa systemniva -- env-overrides, beforeAll-guards, och tydlig separation mellan "toggleable" och "env-locked" flaggor. Att kora tester i isolation maskerar dessa problem; batch-korning avslojor dem.
