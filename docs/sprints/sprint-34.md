---
title: "Sprint 34: iOS UX Major-fixar"
description: "Åtgärda 6 Major-fynd från iOS UX-audit (S33-1) över Profil, Bokningsdetalj, Felmeddelanden"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, ios, ux, accessibility, polish]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
  - Risker
---

# Sprint 34: iOS UX Major-fixar

## Sprint Overview

**Mål:** Åtgärda 6 Major-fynd från iOS UX-audit (S33-1) grupperade i 3 värde-drivna stories. Alla fynd har konkreta mätvärden (pt-storlek, specifika beteenden) från mobile-mcp accessibility tree.

**Bakgrund:** S33-1-audit körde cx-ux-reviewer + mobile-mcp på alla 15 native-vyer. Blockers + enklaste Minors fixades direkt. 6 Majors backloggades som dessa stories. Se [2026-04-18-ios-ux-audit.md](../retrospectives/2026-04-18-ios-ux-audit.md) för fullständig rapport.

**Prioriterat före messaging (S35):** Bokningsdetaljfixarna (S34-2) är särskilt viktiga att ha på plats innan messaging byggs i samma vy -- vi vill inte fixa UX på gammal vy som sedan förändras.

**Avgränsning:**
- Bara Major-fynd från audit -- Minor-fynd stannar i backlog
- Ingen native-konvertering av nya vyer
- Ingen arkitekturändring

---

## Sessionstilldelning

Alla tre stories är ios-domän och rör olika Swift-filer -- kan köras sekventiellt av en session eller parallelliseras om två iOS-sessioner önskas (sällsynt).

---

## Stories

### S34-1: Profilvy -- tap-targets och bekräftelsedialog

**Prioritet:** 1
**Effort:** 0.5 dag
**Domän:** ios (`ios/Equinet/Equinet/NativeProfileView.swift`)

Fixa 5 fynd i NativeProfileView: tap-targets under 44pt, saknad bekräftelse för destruktiv action, accessibility-labels.

**Aktualitet verifierad:**
- Backlog-story baserad på audit 2026-04-18. Grep-verifiera att fynden fortfarande finns innan fix.

**Implementation:**

**Fynd att åtgärda (från audit):**

| ID | Problem | Fix |
|----|---------|-----|
| M-01 | "Byt bild"-knapp 44×15pt | `frame(minHeight: 44)` + ikon |
| M-02 | "Redigera"-knappar i sektionsrubriker 18-19pt | `frame(minHeight: 44)` + `contentShape(Rectangle())` |
| M-03 | "Radera konto" saknar confirmationDialog | Native `.confirmationDialog` med destruktiv roll |
| m-06 | Settings-fliken saknar error-state | ErrorBanner eller motsvarande |
| m-07 | linkRow saknar accessibilityLabel | Beskrivande label som inkluderar destination |

**Tester:**
- ProfileViewModelTests: inga förändringar (UI-only)
- Manuell verifiering via mobile-mcp EFTER fixar: screenshot + accessibility tree

**Acceptanskriterier:**
- [ ] Alla 3 Major-fynd (M-01, M-02, M-03) åtgärdade
- [ ] 2 Minor-fynd (m-06, m-07) åtgärdade
- [ ] mobile-mcp-verifiering: tap-targets ≥ 44pt bekräftat
- [ ] Radera konto triggar confirmationDialog före kall till API
- [ ] `xcodebuild test -only-testing:EquinetTests/ProfileViewModelTests` grön
- [ ] cx-ux-reviewer godkänner

**Reviews:** cx-ux-reviewer (primär), ios-expert om confirmationDialog-mönstret är nytt, code-reviewer

---

### S34-2: Bokningsdetalj -- kontakter och knappar

**Prioritet:** 2
**Effort:** 0.5 dag
**Domän:** ios (`ios/Equinet/Equinet/NativeBookingDetailView.swift`)

Fixa 3 fynd i NativeBookingDetailView: kontaktinformation för liten + inte klickbar, sekundärknappar saknar rätt storlek.

**Aktualitet verifierad:**
- Backlog-story. Verifiera med grep att fynden fortfarande finns.

**Implementation:**

**Fynd att åtgärda (från audit):**

| ID | Problem | Fix |
|----|---------|-----|
| M-04 | Telefon + e-post ~19pt, e-post inte klickbar | `minHeight: 44` + `mailto:`-länk |
| M-05 | "Uteblev"/"Avboka" 34pt (< 44) | `.controlSize(.large)` + `role: .destructive` på Avboka |
| m-05 | Hästnamn-knapp ingen visuell affordance | `Label` med ikon + `frame(minHeight: 44)` |

**Kod-skiss:**
```swift
// mailto-länk
Link(destination: URL(string: "mailto:\(email)")!) {
  Text(email)
    .frame(minHeight: 44)
}

// role: .destructive
Button("Avboka", role: .destructive) { ... }
  .controlSize(.large)
```

**Acceptanskriterier:**
- [ ] Alla 3 Major-fynd åtgärdade
- [ ] 1 Minor-fynd (m-05) åtgärdat
- [ ] E-post triggar native mail-app vid tap
- [ ] Telefon triggar tel-link (om inte redan implementerat)
- [ ] mobile-mcp-verifiering bekräftar tap-targets
- [ ] cx-ux-reviewer godkänner
- [ ] BookingDetailViewModelTests grön

**Reviews:** cx-ux-reviewer (primär), code-reviewer

---

### S34-3: Felmeddelanden -- nätverksfel vs autentiseringsfel

**Prioritet:** 3
**Effort:** 0.5 dag
**Domän:** ios (`ios/Equinet/Equinet/AuthManager.swift` + `NativeLoginView.swift`)

Differentiera felmeddelanden så användaren ser skillnad på "fel lösenord" och "ingen internetanslutning".

**Aktualitet verifierad:**
- Backlog-story (M-06 från audit). Verifiera AuthManager error-hantering innan fix.

**Implementation:**

**Steg 1: AuthManager error-typer**
- Definiera `AuthError` enum: `.invalidCredentials`, `.networkUnavailable`, `.serverError`, `.unknown`
- Mappa från URLError (cancelled, notConnectedToInternet, timedOut) → .networkUnavailable
- Mappa från HTTP 401/403 → .invalidCredentials
- Mappa från HTTP 5xx → .serverError

**Steg 2: NativeLoginView felvisning**
- Switch på AuthError → svensk, actionable text:
  - `.invalidCredentials`: "E-post eller lösenord stämmer inte"
  - `.networkUnavailable`: "Ingen internetanslutning. Kontrollera nätverket och försök igen."
  - `.serverError`: "Något gick fel hos oss. Försök igen om en stund."
  - `.unknown`: "Oväntat fel. Försök igen eller kontakta support."
- Ikon per feltyp (wifi.slash, exclamationmark.triangle, etc)

**Steg 3: Tester**
- AuthManagerTests: 4 nya tester (en per feltyp, mock URLError/HTTPResponse)
- Visuell verifiering med mobile-mcp: inducera fel + screenshot

**Acceptanskriterier:**
- [ ] AuthError-enum definierad med 4 kategorier
- [ ] URLError + HTTP-status mappat till rätt kategori
- [ ] NativeLoginView visar differentierat meddelande + ikon
- [ ] 4 nya AuthManagerTests gröna
- [ ] cx-ux-reviewer godkänner textformulering (svenska)

**Reviews:** cx-ux-reviewer (text), code-reviewer (error-mapping-logik), ios-expert om error-enum-mönstret är nytt

---

## Exekveringsplan

```
S34-1 (0.5 dag, Profil) -> S34-2 (0.5 dag, Bokningsdetalj) -> S34-3 (0.5 dag, Felmeddelanden)
```

**Total effort:** ~1.5 dag.

**Parallellisering möjlig:** S34-2 och S34-3 rör helt olika filer (NativeBookingDetailView vs AuthManager+NativeLoginView). Om två iOS-sessioner önskas kan de köras parallellt via worktree.

## Risker

1. **`.confirmationDialog` i S34-1 är nytt mönster** -- första användningen i native koden. ios-expert bör review:a strukturen så det blir återanvändbart.

2. **URLError-mappning i S34-3 kan ha edge cases** -- iOS har många URLError-koder. Välj de vanligaste (notConnectedToInternet, timedOut, cancelled) och default till .unknown för resten.

3. **mobile-mcp-verifiering kräver simulator.** Om CI inte har iOS Simulator: verifiera manuellt på lokal maskin eller iPhone före merge.

## Definition of Done (sprintnivå)

- [ ] 6 Major-fynd från S33-1-audit åtgärdade
- [ ] 3 Minor-fynd inkluderade i fixarna
- [ ] mobile-mcp before/after-screenshots i relevant done-fil
- [ ] `xcodebuild test -only-testing:EquinetTests` grön
- [ ] cx-ux-reviewer körd på alla 3 stories
