---
title: "Sprint 29: iOS Polish + mobile-mcp-verifiering"
description: "Utnyttja mobile-mcp för automatiserad iOS-verifiering + små iOS-cleanups som väntat"
category: sprint
status: active
last_updated: 2026-04-17
tags: [sprint, ios, mobile-mcp, offline, verification]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 29: iOS Polish + mobile-mcp-verifiering

## Sprint Overview

**Mål:** Automatisera de manuella iOS-verifieringar som hoppats över historiskt, och städa upp två SwiftUI Pro-fynd som legat i backloggen.

**Bakgrund:** S28-5 hoppade över manuell offline-verifiering i simulator som "nice-to-have". Med mobile-mcp (redan registrerad i projektet via XCUITest/WebDriverAgent) kan vi automatisera detta. Passar också att knäcka två små Task.detached/force unwrap-fynd från SwiftUI Pro-reviewen i S13-4.

**Renodlat iOS-fokus.** Resend-verifiering flyttades ut (kräver domänverifiering eller Pro -- tas när det är löst).

---

## Sessionstilldelning

En session kör hela sprinten sekventiellt. Inga parallella sessioner -- alla stories rör iOS-domänen.

- **Session 1 (Sonnet, `ios/*`)**: Alla S29-stories i ordning

Det finns ingen webb-domän att parallellisera med i denna sprint. Om det finns önskan att jobba parallellt med något annat -- plocka en backlog-story från docs-domänen (t.ex. en pattern-katalog-story).

---

## Stories

### S29-0: Review-gating -- tydliggör när subagent-review kan skippas

**Prioritet:** 0 (FÖRST -- påverkar hur S29-3 och S29-4 körs)
**Effort:** 30 min
**Domän:** docs

Idag är det otydligt när en story kräver subagent-review (code-reviewer, security, cx-ux) och när det är overkill. S29-3 och S29-4 är 5-minuters-fixar där full review kostar mer än den ger.

**Implementation:**
- Lägg till sektion "Review-gating" i `.claude/rules/team-workflow.md` station 4
- Definiera "trivial story" med tydliga kriterier
- Uppdatera auto-assign.md Done-fil-checklistan så "Reviews körda: ingen (trivial, motivering)" blir acceptabelt
- Dokumentera att check:all fortfarande är obligatorisk oavsett

**Kriterier för "trivial" (alla måste stämma):**
- <15 min effort
- Mekanisk ändring (inte ny logik)
- Ingen API-yta ändras
- Ingen säkerhetspåverkan
- Inget UI ändras

**Regel:** Om story är trivial → skippa subagent-review, `npm run check:all` räcker. Om osäker → kör review.

**Acceptanskriterier:**
- [ ] Review-gating-sektion i team-workflow.md
- [ ] auto-assign.md done-fil-checklista uppdaterad
- [ ] Dokumenterat i patterns.md (under Processer)
- [ ] Tydliga kriterier så sessioner inte behöver gissa

---

### S29-1: Mobile-mcp offline-verifiering (simulator)

**Prioritet:** 1
**Effort:** 2-3h
**Domän:** ios

Automatisera det som S28-5 gjorde manuellt: verifiera att iOS-appens offline-kedja fungerar.

**Implementation:**
- Starta appen i simulator via mobile-mcp (`mobile_launch_app`)
- Navigera till relevanta vyer (dashboard, bokningar) när online
- Stäng av nätverk via `simctl status_bar ... --data-network` eller motsvarande
- Verifiera att offline-banner visas
- Verifiera att cached data renderas
- Återaktivera nät
- Verifiera retry-kedjan (banner försvinner, fresh data kommer)

**Skriv som ett återanvändbart Swift-test eller skript.** Ska kunna köras i CI framöver om simulator-setup fungerar, annars som pre-release-gate lokalt.

**Acceptanskriterier:**
- [ ] Skript/test som kör hela offline → retry-kedjan utan manuell interaktion
- [ ] Dokumenterat hur det körs (README eller iOS-learnings.md)
- [ ] Täcker: offline-banner visas, stale cache renderas, retry fungerar vid reconnect
- [ ] Grönt i simulator-körning

---

### S29-2: E2E för iOS offline-flödet via mobile-mcp

**Prioritet:** 2
**Effort:** 0.5 dag
**Domän:** ios

Bygg ut S29-1 till ett fullständigt E2E-test som täcker kedjan NWPathMonitor → offline-banner → stale cache → retry. Testas idag bara med XCTest på ViewModel-nivå.

**Implementation:**
- Komplett scenario: Anna (leverantör) är online, laddar dashboard, tappar nätet, navigerar (stale cache), återfår nät, verifierar att retry triggar fresh fetch
- Kombinera mobile-mcp med XCUITest där det passar (XCUITest för in-app assertions, mobile-mcp för systeminteraktion som nätverksavstängning)
- Bygga ut från S29-1:s scripting

**Acceptanskriterier:**
- [ ] E2E-test som täcker hela offline-flödet
- [ ] Grönt 3 gånger i rad (inte flaky)
- [ ] Dokumenterat i iOS-testflödet (`.claude/rules/ios-learnings.md`)
- [ ] Beslut fattat: körs i CI eller bara lokalt pre-release?

---

### S29-3: Task.detached → Task

**Prioritet:** 3
**Effort:** 5 min
**Domän:** ios

SwiftUI Pro-fynd från S13-4. Byt `Task.detached` till `Task` i:
- `AuthManager`
- `PushManager`

**Acceptanskriterier:**
- [ ] Inga `Task.detached` kvar i AuthManager eller PushManager
- [ ] iOS-tester passerar

---

### S29-4: Force unwrap → guard let

**Prioritet:** 4
**Effort:** 5 min
**Domän:** ios

SwiftUI Pro-fynd från S13-4. Byt force unwrap till `guard let` i:
- `AuthManager.exchangeSessionForWebCookies()`

**Acceptanskriterier:**
- [ ] Inga force unwraps i `AuthManager.exchangeSessionForWebCookies()`
- [ ] iOS-tester passerar

---

### S29-5: Uppdatera iOS-learnings med mobile-mcp-mönster

**Prioritet:** 5
**Effort:** 30 min
**Domän:** docs

Baserat på S29-1/S29-2: lägg till ett mönster i `.claude/rules/ios-learnings.md` som beskriver:
- När använda mobile-mcp vs XCUITest vs mock-tester
- Exempel på offline-verifieringsskript
- Hur man stänger av nät i simulator programmatiskt
- Vanliga fallgropar (timing, state-reset mellan test-körningar)

**Acceptanskriterier:**
- [ ] `.claude/rules/ios-learnings.md` utökad med mobile-mcp-sektion
- [ ] Länkad från `docs/architecture/patterns.md` (rad i testning-sektionen)
- [ ] Exempel-skript från S29-1 refererat

---

## Exekveringsplan

```
Session 1 (Sonnet, ios):
  S29-0 (30 min, docs) -> S29-1 (2-3h) -> S29-2 (0.5 dag) -> S29-3 (5 min, trivial) -> S29-4 (5 min, trivial) -> S29-5 (30 min)
```

**Total effort:** ~1 dag + 30 min.

S29-0 körs FÖRST så S29-3 och S29-4 kan skippa review enligt den nya gatingen.

## Definition of Done (sprintnivå)

- [ ] iOS offline-flödet verifieras automatiskt (inte längre manuellt)
- [ ] S13-4 SwiftUI Pro-fynd åtgärdade
- [ ] Mobile-mcp-mönstret dokumenterat för framtida iOS-sessioner
- [ ] `xcodebuild test ... -only-testing:EquinetTests` grön
- [ ] Beslut fattat om CI-integration av mobile-mcp-tester
