---
title: "S4-3 Done: Due-for-service native iOS"
description: "Besoksplanering migrerad fran WebView till native SwiftUI"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S4-3 Done: Due-for-service native iOS

## Acceptanskriterier

- [x] Feature inventory genomford och granskad
- [x] Native vy visar kunder med service-intervall och dagar sedan senast
- [x] ViewModel-tester skrivna och grona (9 tester)
- [x] API route-tester skrivna och grona (7 tester)
- [ ] Tap navigerar till kunddetalj (skippat -- se avvikelser)
- [ ] Visuell verifiering med mobile-mcp (vantande -- behover dev-server + seed-data)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Zod-validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests skrivna forst (TDD), coverage god
- [x] Feature branch, alla tester grona
- [ ] Mergad till main (vantar review)

## Filer skapade/andrade

| Fil | Typ |
|-----|-----|
| `src/app/api/native/due-for-service/route.ts` | Ny API route (Bearer JWT) |
| `src/app/api/native/due-for-service/route.test.ts` | 7 tester |
| `ios/Equinet/Equinet/DueForServiceModels.swift` | Codable structs |
| `ios/Equinet/Equinet/DueForServiceViewModel.swift` | ViewModel med DI |
| `ios/Equinet/Equinet/NativeDueForServiceView.swift` | SwiftUI-vy |
| `ios/Equinet/EquinetTests/DueForServiceViewModelTests.swift` | 9 tester |
| `ios/Equinet/Equinet/APIClient.swift` | +fetchDueForService() |
| `ios/Equinet/Equinet/NativeMoreView.swift` | +native routing |

## Avvikelser

1. **Tap-navigering till kunddetalj** -- Skippades. Kraver integration med CustomersViewModel
   och CustomerDetailView som gor scopet for stort. Kan laggas till i S4-4 (UX-polish).

2. **Boka-knapp** -- Skippades (beslut i feature inventory). Kraver WebView-navigering
   till kalender -- hanteras battre med helhetsflodet senare.

3. **Visuell verifiering** -- Ej genomford i denna session. Kraver dev-server med
   seed-data som har completed bookings med service-intervall.

## Lardomar

1. **Xcode 26 har iPhone 17 -- inte 16.** Simulatornamn har andrats, alla xcodebuild-kommandon
   behover `iPhone 17 Pro` istallet for `iPhone 16 Pro`.

2. **SwiftUI Pro-review innan implementation lonar sig.** Hittade 4 forbattringar
   (modern Date API, statisk member lookup, action-extrahering, sensoryFeedback)
   som annars hade blivit tech debt.

3. **Native API route ar en exakt kopia av provider-route men med Bearer JWT.** Overvagg
   att extrahera gemensam logik till en delad service-funktion i framtiden om fler
   native routes foljer samma monster.
