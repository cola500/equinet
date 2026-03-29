---
title: iOS DashboardViewModel Pilot – Retro
description: Retro från DashboardViewModel-extraktion, quick wins och iOS-genomlysning
category: retro
status: current
last_updated: 2026-03-29
sections:
  - Bakgrund
  - Vad vi gjorde
  - Vad som fungerade bra
  - Vad som var svårt eller mindre bra
  - Lärdomar
  - Rekommendation framåt
---

# iOS DashboardViewModel Pilot – Retro

## Bakgrund

iOS-genomlysningen (session 111) identifierade NativeDashboardView som den enda native-vyn utan ViewModel. 555 rader med API-anrop, cache-logik, felhantering och UserDefaults-persistens direkt i vyn. 0 unit-tester för appens förstasida. Alla andra 6 native-vyer följer MVVM med protokoll-DI.

Piloten syftade till att bekräfta att extraktionen var säker, att mönstret var enkelt att följa, och att iOS-spåret är värt att fortsätta.

## Vad vi gjorde

**Quick wins först (commit `fd3e4f7e`):**
- R1: Ersatte hårdkodade `Color(red:green:blue:)` med `Color.equinetGreen` i 3 filer (NativeLoginView, BiometricPromptView, SplashView). Upptäckte att main redan hade fixat 2 av 3 -- diff blev mindre än väntat.
- R2: KeychainHelper print() -> AppLogger -- **hoppades över**. AppLogger.swift rad 12 dokumenterar att KeychainHelper delas med widget-extensionen som inte har tillgång till AppLogger. `print()` är medvetet.
- R3: Skapade `DateFormatters.swift` med 5 delade formatterare. Ersatte 14 duplicerade definitioner i 8 filer.

**DashboardViewModel-pilot (commit `2e9454ce`):**
- Skapade `DashboardViewModel.swift` (133 rader) med `DashboardDataFetching`-protokoll och `APIDashboardFetcher`-adapter.
- Flyttade: `dashboard`/`isLoading`/`error`/`onboardingDismissed` state, `loadDashboard()`, `fetchDashboard()`, `isOnboardingDismissed()`, `dismissOnboarding(permanent:)`, `reset()`.
- Uppdaterade `NativeDashboardView` till `@Bindable var viewModel` istället för `@State`.
- Registrerade `dashboardViewModel` i `AppCoordinator` (samma mönster som övriga 6).
- Kopplade in via `AuthenticatedView`.
- Skrev 15 unit-tester: initial state, lyckad laddning, 5 feltyper, cache-fallback, refresh, onboarding-dismiss (temporär + permanent + persistens), reset.

**Filer:** 2 nya (ViewModel + tester), 3 ändrade (View, Coordinator, AuthenticatedView).

## Vad som fungerade bra

- **Mönstret var tydligt att följa.** BookingsViewModel fungerade som 1:1-mall. Protokoll-DI, `@Observable @MainActor`, cache-first, felmeddelande-mappning -- allt kopierades rakt av.
- **Testerna var enkla att skriva.** Mock-fetcher med `Result`-typ, `@MainActor`-testclass, clear/teardown av UserDefaults och SharedDataManager. Samma mönster som alla andra ViewModel-tester.
- **Ren extraktion utan överraskningar.** Ingen logik behövde skrivas om. `withAnimation` i onboarding-dismiss var enda fallet som krävde eftertanke -- löstes med att animationen stannar i vyn, state-ändringen i ViewModel.
- **Genomlysningen betalade sig.** Utan ios-architecture-review.md hade vi inte vetat att Dashboard var den enda avvikelsen, och vi hade inte kunnat avgränsa piloten så tydligt.

## Vad som var svårt eller mindre bra

- **Xcode-uppdatering blockerade build-verifiering.** Simulatorer var otillgängliga under iOS SDK-installation. Löstes genom att vänta och använda explicit UUID istället för enhetsnamn.
- **Dubbla testkörningar.** Testsviten kördes två gånger -- en gång för output, en gång för att räkna passed. Onödig väntetid (~3 min extra). Feedback sparat: kör EN gång, sammanfatta från den körningen.
- **Branch-hygien.** Första committen hamnade på fel branch (`fix/manual-recurring-booking`). Krävde `git reset --soft`, stash, branch-byte, conflict resolution. Hade undvikits om vi skapat branch först. Befintlig feedback om branch-strategi gäller.
- **R2 (KeychainHelper logging) var inte genomförbar.** Genomlysningen missade att KeychainHelper delas med widget-extensionen. Upptäcktes genom att läsa AppLogger.swift:s kommentar. Påminnelse: läs alltid filens kontext innan mekanisk ändring.

## Lärdomar

1. **Genomlysning -> avgränsad pilot -> verifiering fungerar.** Tre steg, tre commits, inga regressioner. Bättre än att hoppa direkt till implementation.
2. **Quick wins först bygger förtroende.** R1+R3 tog ~45 min och bekräftade att kodbasen reagerar som väntat. Minskade risken för piloten.
3. **Befintliga mönster gör extraktionen mekanisk.** 6 referens-ViewModels + tester innebär att nya ViewModels blir copy-paste med domänspecifik logik. Ingen arkitekturdebatt behövs.
4. **Läs kommentarer i delade filer.** AppLogger/KeychainHelper-gotchan hade kostat tid om vi inte kollat.
5. **Skapa branch innan första ändring.** Inte efter.

## Rekommendation framåt

**Pausa iOS-refaktorspåret nu.** Piloten bekräftade att arkitekturen är sund och att extraktioner är säkra. Det finns inget akut behov av fler refaktorer.

**Nästa steg vid behov:**
- R7 (konsolidera BookingsListItem/NativeBooking) -- gör vid nästa booking-fältsutvidgning.
- R8 (CodingKeys) -- gör inkrementellt, modell för modell, när en modell ändå rörs.
- R11 (APIClient-uppdelning) -- planera först om appen växer väsentligt.

**Gör inte nu:**
- Stora APIClient-omskrivningar.
- Type-safe routing (R13) -- appen är inte tillräckligt stor.
- Fler ViewModel-extraktioner -- alla andra vyer har redan ViewModels.
