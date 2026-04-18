---
title: "Sprint 33: Process tweaks + TBD"
description: "Mindre process-justeringar baserat på S31/S32-lärdomar, övriga stories TBD"
category: sprint
status: active
last_updated: 2026-04-18
tags: [sprint, process, meta]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 33: Process tweaks + TBD

## Sprint Overview

**Mål:** Formalisera fyra process-justeringar som kristalliserats från S31/S32-retros. Övriga stories planeras när S33-0 är merged.

---

## Stories

### S33-0: Process tweaks (4 justeringar)

**Prioritet:** 0 (meta, kör först)
**Effort:** 30 min
**Domän:** docs (`.claude/rules/**` + `docs/plans/TEMPLATE.md`)

Baserat på retro för S31 och S32 har fyra konkreta process-justeringar identifierats. Alla är små rule/template-ändringar med tydliga problem bakom sig.

**Implementation:**

1. **TEMPLATE.md -- audit-verifiering i "Aktualitet verifierad"-sektionen**
   - Utöka befintlig sektion med: "Audit-stories ska verifiera att det påstådda gapet faktiskt finns (grep-kommando + resultat)"
   - Problem bakom: S32-3-planen antog haptic saknades i 6 vyer, grep hade visat att det fanns.

2. **autonomous-sprint.md -- metrics:report obligatoriskt vid sprint-avslut**
   - Lägg till rad i Sprint-avslut-checklistan
   - Problem bakom: utan tvång glöms mätning bort. Hela poängen med S32-1.

3. **auto-assign.md -- "Modell:"-fält i done-fil-mallen (Steg 9)**
   - Lägg till rad: `**Modell:** opus / sonnet / haiku`
   - Problem bakom: modellval-metric kräver data. Varje dag utan fält = förlorad datapunkt.

4. **parallel-sessions.md -- tech lead räknas som session**
   - Lägg till en mening som förtydligar: "Tech lead är också en session när den rör working tree."
   - Problem bakom: S32-sessionen där tech lead och dev 2 delade main krockade.

**Acceptanskriterier:**
- [ ] Alla 4 filändringar gjorda
- [ ] Plan-filen har "Aktualitet verifierad"-sektion (dogfooding)
- [ ] `npm run check:all` grön
- [ ] Pre-commit-hook grön (inga svenska-tecken-fel)

**Avgränsning:** Ingen implementation av modellval-metriken -- bara fältet i mallen. Själva metric-utökningen är en framtida story.

---

### S33-1: UX + visuell review av iOS-appen

**Prioritet:** 1
**Effort:** 0.5-1 dag
**Domän:** ios

Systematisk genomgång av alla 15 native-vyer med två lager: visuell verifiering via mobile-mcp (screenshots + accessibility tree) och UX-granskning via cx-ux-reviewer subagent på koden. Fokus på vyer som ändrats i senaste sprintarna (S32-2 NativeBookingDetailView och alla 10 vyer som fick haptic-fixar i S32-3).

**Aktualitet verifierad (audit-story):**

Audit-story enligt nya TEMPLATE.md-kategorin. Innan implementation:
- Bekräfta att mobile-mcp fungerar mot iOS Simulator (kan ha regredat sedan S29-1)
- Verifiera att alla 15 Native*View.swift fortfarande finns
- Konfirmera att --debug-autologin fortfarande fungerar (pre-launch test)

**Implementation:**

**Steg 1: Setup**
- Boota iOS Simulator (iPhone 17 Pro) + vänta 10s efter kallstart
- Launch app med `--debug-autologin` som Anna (provider)
- Bekräfta att första screenshot fungerar (WebDriverAgent-timeout-fix)

**Steg 2: Visuell audit per vy (15 stycken)**

För varje Native*View:
- Navigera till vyn
- Ta screenshot
- Hämta accessibility tree
- Notera visuellt: layout, spacing, färger, typografi, ikoner
- Notera UX: loading states, empty states, error states, CTA-tydlighet
- Notera a11y: VoiceOver-labels, Dynamic Type-stöd

Ordning (mest kritiska först):
1. NativeBookingDetailView (NY i S32-2)
2. NativeBookingsView
3. NativeDashboardView
4. NativeCustomersView
5. NativeServicesView
6. NativeCalendarView
7. NativeProfileView
8. NativeReviewsView
9. NativeInsightsView
10. NativeAnnouncementsView
11. NativeDueForServiceView
12. NativeGroupBookingsView
13. NativeMoreView
14. NativeHelpView
15. NativeLoginView

**Steg 3: cx-ux-reviewer subagent**

Kör cx-ux-reviewer på:
- `NativeBookingDetailView.swift` (ny, störst risk för UX-gap)
- Alla 10 filer från S32-3 (haptic-fixar kan ha haft sidoeffekter)
- `NativeDashboardView.swift` (mest använda vyn)

**Steg 4: Sammanställ rapport**

Skapa `docs/retrospectives/<datum>-ios-ux-audit.md` med:
- Per vy: status (bra / mindre fynd / större fynd)
- Fynd-tabell: vy, kategori (visuell/UX/a11y), allvar (blocker/major/minor), beskrivning, föreslagen fix
- Sammanfattning: topp-3 prioriterade förbättringar
- Screenshots (inkludera i `docs/metrics/ios-audit-<datum>/` eller bilaga)

**Steg 5: Triage fynd**
- **Blocker (aldrig förväntat i audit):** stoppa, meddela Johan
- **Major:** skapa ny story (S33-2+) eller backlog-rad
- **Minor (<15 min per fix):** applicera direkt i denna story om scope tillåter, annars backlog-rad
- **Observation utan fix behövs:** dokumentera i rapport

**Acceptanskriterier:**
- [ ] Alla 15 native-vyer har screenshot + accessibility tree verifierad
- [ ] cx-ux-reviewer körd på minst 3 vyer (ny + polish-vyer + dashboard)
- [ ] Audit-rapport i `docs/retrospectives/` med fynd-tabell
- [ ] Minor-fynd (<15 min) applicerade eller dokumenterade i backlog
- [ ] Major-fynd har backlog-rader eller nya stories skapade
- [ ] `xcodebuild test -only-testing:EquinetTests` grön (ingen regression)

**Reviews:**
- cx-ux-reviewer (central för storyn)
- code-reviewer (om minor-fixar tillämpas)
- ios-expert (om större arkitekturfynd)

**Docs-matris:**
- `docs/retrospectives/<datum>-ios-ux-audit.md` (ny)
- `ios-learnings.md` om nya mönster/gotchas upptäcks
- Inga användarvända docs påverkas (intern audit)

---

## Exekveringsplan

```
S33-0 (30 min, process tweaks) -> S33-1 (0.5-1 dag, iOS UX-audit)
```

## Definition of Done (sprintnivå)

- [ ] S33-0 merged
- [ ] S33-1 merged med audit-rapport
- [ ] Topp-3 förbättringar antingen fixade eller i backlog med tydliga effort-estimat
