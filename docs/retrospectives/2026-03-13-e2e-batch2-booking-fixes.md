---
title: "Retrospektiv: E2E Batch 2 -- Bokningsflode & CalendarHeader-bugg"
description: "E2E-testgenomgang batch 2: hittade produktionsbugg i CalendarHeader, fixade 9 testfailures"
category: retrospective
status: done
last_updated: 2026-03-13
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: E2E Batch 2 -- Bokningsflode & CalendarHeader-bugg

**Datum:** 2026-03-13
**Scope:** E2E-testgenomgang batch 2 (booking, calendar, manual-booking, flexible-booking, group-bookings)

---

## Resultat

- 9 andrade filer, 1 ny fil (plan), 0 nya migrationer
- 0 nya unit-tester (fokus pa E2E-fixar och en appbugg)
- 3282 totala unit-tester (inga regressioner)
- E2E batch 2: 41 pass, 19 skip, 0 fail (fran 9 failures)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI (buggfix) | `src/components/calendar/CalendarHeader.tsx` | Lade till `type="button"` pa alla 7 Button-element -- forhindrar oavsiktlig form-submit |
| Infra | `playwright.config.ts` | `FEATURE_GROUP_BOOKINGS=true` i webServer.env |
| E2E | `e2e/booking.spec.ts` | Uppdaterad till nuvarande bokningsflode (HorseSelector, granska-steg) |
| E2E | `e2e/calendar.spec.ts` | Legend-text matchar nuvarande UI ("Stangt" istallet for "Stangt (veckoschema)") |
| E2E | `e2e/manual-booking.spec.ts` | `networkidle` -> `domcontentloaded` + heading-wait |
| E2E | `e2e/group-bookings.spec.ts` | `.first()` pa card-text, korrekt filter-knapp-selektor |
| Docs | `docs/plans/e2e-test-review.md` | Batch 2-resultat dokumenterade |

## Vad gick bra

### 1. Hittade riktig produktionsbugg via E2E-genomgang
CalendarHeader-knapparna saknade `type="button"` -- en bugg som kunde drabba anvandare i produktion nar de navigerade i bokningskalendern. E2E-testerna avslojade buggen som rotorsak till testfailures.

### 2. Systematisk 5 Whys avslojade HTML-spec-gotcha
Istallet for att bara fixa testerna gravde vi djupare och hittade att HTML-spec definierar `<button>` utan `type` som `type="submit"` i forms. Detta ar ett vanligt misstag med komponentbibliotek som shadcn/ui dar Button inte satter `type="button"` som default.

### 3. Parallella agenter snabbade upp rotorsaksanalysen
Tre explore-agenter korde parallellt for att undersoka booking-dialog, calendar-legend och group-bookings. Alla tre levererade korrekt rotorsak.

### 4. Dev-server restart avslojde env-var-issue
Group-bookings-testerna failade pga att `reuseExistingServer: true` anvande en dev-server utan den nya `FEATURE_GROUP_BOOKINGS` env-variabeln. Att doda och starta om servern fixade problemet direkt.

## Vad kan forbattras

### 1. Button-komponent bor alltid ha type="button" som default
shadcn/ui:s Button-komponent arver HTML:s default `type="submit"`. Alla Button-instanser i projektet som finns inuti forms (inte bara CalendarHeader) kan ha samma bugg.

**Prioritet:** HOG -- kan orsaka fler dolda buggar i andra forms

### 2. E2E-tester hamnar efter UI-forandringar
Bokningsflodets evolution (textfalt -> combobox, direkt submit -> granska-steg) fangades inte av testerna. Testerna maste uppdateras nar UI-flodet andras.

**Prioritet:** MEDEL -- risken minskar med battre CI som kor E2E pa PR

## Patterns att spara

### type="button" i alla Button-element inuti forms
Alla `<Button>` fran shadcn/ui som ar inuti `<form>` och INTE ska submita maste ha `type="button"`. Utan det defaultar de till `type="submit"` (HTML-spec). Kontrollera detta vid code review.

### Dev-server restart vid env-var-ändringar i Playwright
Nar `reuseExistingServer: true` ar aktivt (icke-CI) maste dev-servern doodas och startas om for att plocka upp nya env-variabler i `playwright.config.ts`. Annars kor testerna mot en server med gamla env-vars.

### .first() pa getByText for card-element
Kort-layouts dar samma text forrekommer i bade titel och beskrivning kraver `.first()` pa `getByText()` for att undvika Playwrights strict mode violation.

## 5 Whys (Root-Cause Analysis)

### Problem: Bokningsdialogen hoppade till sammanfattningsvyn nar man klickade "Nasta vecka"
1. Varfor? CalendarHeader-knappen "Nasta" submittade formularet
2. Varfor? Knappen hade inget explicit `type`-attribut
3. Varfor? shadcn/ui:s Button-komponent satter inte `type="button"` som default
4. Varfor? Button-komponenten foljer HTML-spec dar default ar `type="submit"` i forms
5. Varfor? CalendarHeader designades ursprungligen utanfor forms och problemet uppstod nar den baddades i DesktopBookingDialog

**Åtgärd:** Lade till `type="button"` pa alla 7 knappar i CalendarHeader. Overovag att audita alla Button-instanser i forms.
**Status:** Implementerad (CalendarHeader). Audit av ovriga forms: Att gora.

### Problem: Group-bookings visade tom lista trots seedade data
1. Varfor? API-routen returnerade 404
2. Varfor? Feature-flaggan `group_bookings` var inaktiv i E2E-miljon
3. Varfor? `FEATURE_GROUP_BOOKINGS` saknades i playwright.config.ts webServer.env
4. Varfor? Flaggan har `defaultEnabled: true` men env-variabeln trumfar default, och serverns env laddades vid start
5. Varfor? `reuseExistingServer: true` ateranvander en server startad utan den nya env-variabeln

**Åtgärd:** Lade till `FEATURE_GROUP_BOOKINGS=true` i playwright.config.ts. Gotcha dokumenterad.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** E2E-testgenomgangar ar inte bara for att fixa tester -- de avsloojar riktiga buggar i applikationskoden. CalendarHeader-buggen hade kunnat drabba anvandare i produktion. Att alltid fraga "ar detta en appbugg eller en testbugg?" leder till battre fixar.
