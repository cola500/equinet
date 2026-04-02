---
title: "Sprint 8: iOS native-migrering -- Annonsering + Insikter"
description: "Migrera annonserings- och business insights-skärmarna från WebView till native SwiftUI"
category: sprint
status: active
last_updated: 2026-04-02
tags: [sprint, ios, native, migration, swiftui]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 8: iOS native-migrering -- Annonsering + Insikter

**Sprint Duration:** 1 vecka
**Sprint Goal:** Två nya native iOS-skärmar som visar leverantörens räckvidd och analytics.

---

## Sprint Overview

Migrerar annonsering och business insights från WebView till native SwiftUI.
Följer iOS Native Screen Pattern (CLAUDE.md): feature inventory -> API -> modeller -> ViewModel -> vy -> routing.

**Efter sprint 8:** 12/16 provider-skärmar native (4 kvar: röstloggning, ruttplanering, gruppbokningar, hjälp).

---

## Stories

### S8-1: Annonsering native iOS -- READY

**Prioritet:** Hög
**Typ:** iOS-migrering
**Beskrivning:** Migrera rutt-annonseringsskärmen från WebView till native SwiftUI. Leverantörer ser sina publicerade rutt-annonser, kan skapa nya, och se intresse.

**Uppgifter:**

1. Feature inventory (obligatoriskt) -- läs webbsidans komponenter rad för rad
2. Skapa `/api/native/announcements` med Bearer JWT-auth
3. Codable structs + ViewModel med DI
4. SwiftUI-vy med lista, skapa ny, statusfilter
5. Koppla in i NativeMoreView (native routing)
6. Tester: ViewModel + API route (BDD dual-loop)

**Acceptanskriterier:**
- [ ] Feature inventory genomförd och granskad
- [ ] Native vy visar leverantörens rutt-annonser
- [ ] Skapa ny annons fungerar
- [ ] ViewModel-tester (BDD inre loop)
- [ ] API route-tester med integrationstester (BDD yttre loop)
- [ ] `npm run check:all` passerar
- [ ] iOS-tester gröna

**Stationsflöde:** Plan -> Red -> Green -> **SwiftUI Pro review** -> Review -> Verify -> Merge

---

### S8-2: Business insights native iOS -- READY

**Prioritet:** Hög
**Typ:** iOS-migrering
**Beskrivning:** Migrera business insights-skärmen från WebView till native SwiftUI. Visar intäktsöversikt, tjänsteanalys, kundretention och tidsanalys.

**Uppgifter:**

1. Feature inventory (obligatoriskt)
2. Skapa `/api/native/insights` med Bearer JWT-auth
3. Codable structs + ViewModel med DI
4. SwiftUI-vy med sammanfattningskort + grafer (Swift Charts istället för Recharts)
5. Koppla in i NativeMoreView
6. Tester: ViewModel + API route (BDD dual-loop)

**Acceptanskriterier:**
- [ ] Feature inventory genomförd
- [ ] Native vy visar intäkter, tjänstefördelning, kundretention
- [ ] Swift Charts för grafer (inte WebView Recharts)
- [ ] ViewModel-tester (BDD inre loop)
- [ ] API route-tester med integrationstester (BDD yttre loop)
- [ ] `npm run check:all` passerar
- [ ] iOS-tester gröna

**Stationsflöde:** Plan -> Red -> Green -> **SwiftUI Pro review** -> Review -> Verify -> Merge

---

### S8-3: Voice logging polish (från S7-5) -- READY

**Prioritet:** Medel
**Typ:** Polish
**Beskrivning:** 5 småfixar från voice logging spike. Flyttad från sprint 7.

**Uppgifter:**
1. Sonnet 4.5 -> 4.6 (1 rad)
2. Confirm-route till withApiHandler (~30 min)
3. UTC-datumlogik (leverantörens tidszon) (~1h)
4. Vercel Preview API-nyckel (Johan, 1 min)
5. Verifiera SDK-timeout

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.
