---
title: "Sprint 50: Pre-launch visuell verifiering"
description: "End-to-end-testning av kritiska flöden innan lansering. Första ut: messaging-bilagor som aldrig fick live-test pga auth-desync-blocker."
category: sprint
status: planned
last_updated: 2026-04-21
tags: [sprint, visual-verification, pre-launch, messaging, e2e]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 50: Pre-launch visuell verifiering

## Sprint Overview

**Mål:** Bevisa att kritiska flöden fungerar **i praktiken**, inte bara enligt kod-reviews. Efter S47-enforcement fångar vi strukturella problem före merge — men vi har inte bevisat att hela user journeys fungerar end-to-end.

**Triggande observation (2026-04-21):** S46-3-audit noterade "audit-stories bör alltid köras med LIVE-test som ambition". För messaging-bilagor kördes kod-analys istället för live-test pga auth-desync-blocker. Nu när S48-0 + S49 har löst auth-frågan kan vi faktiskt köra live-testet.

**Scope-princip:** Inga kod-ändringar i denna sprint. Bara verifieringar. Om bugg hittas → egen story i senare sprint.

---

## Stories

### S50-0: Visuell verifiering av messaging-bilagor

**Prioritet:** 0
**Effort:** 45-60 min
**Domän:** test/verifiering (Playwright MCP + mobile-mcp)

**Bakgrund:** S46 byggde bild-bilagor (Supabase Storage, magic bytes-validering, thumbnail-komponent). Kod-reviews godkände implementationen. Men ingen har **faktiskt** laddat upp en bild och sett den i tråden.

**Aktualitet verifierad:**
- Bekräfta att Supabase kör lokalt (`npm run status`)
- Bekräfta att testkonton funkar (`test@example.com` / `TestPassword123!`)
- Storage bucket `message-attachments` existerar (skapades i S46-0)

**Implementation:**

**Del 1 — Webb (Playwright MCP):**

1. Logga in som kund (`test@example.com`)
2. Skapa eller öppna befintlig bokning med provider@example.com
3. Öppna MessagingDialog (från kundens bokningsvy)
4. Klicka på Paperclip-knappen → file-picker öppnas
5. Välj en test-bild (JPEG eller PNG, <10 MB — skapa en test-fil om det behövs)
6. Verifiera preview före upload
7. Skicka → verifiera att thumbnail renderas i tråden
8. Klicka thumbnail → verifiera fullvy-modal
9. Logga ut → logga in som leverantör (`provider@example.com`)
10. Öppna samma tråd → verifiera att bilden syns även där

**Del 2 — iOS (mobile-mcp):**

1. Boot iOS Simulator, installera senaste build med `-STAGING`-scheme
2. Logga in som kund (`test@example.com`)
3. Öppna Meddelanden (WebView-sida)
4. Testa samma fil-upload-flöde
5. Verifiera HEIC-hantering (om möjligt — iOS-simulator kan inte ta bilder direkt, men kan använda foto-bibliotek)

**Del 3 — Dokumentation:**

- Screenshots per steg sparas i `docs/metrics/messaging-attachments-visual/2026-04-21/`
- Numrerade: `01-kund-login.png`, `02-paperclip-click.png`, osv.
- Retro-fil `docs/retrospectives/2026-04-21-messaging-visual.md` med fynd per plattform
- Om buggar hittas: backlog-rader eller egen story, **fixa INTE i denna sprint**

**Acceptanskriterier:**
- [ ] Webb: minst 8 screenshots (login → thumbnail i tråd)
- [ ] iOS: minst 6 screenshots (login → thumbnail i tråd)
- [ ] Både kund och leverantör testade (båda håll av tråd)
- [ ] Retro-fil med fynd (även om "inga fynd" — det är också värdefull info)
- [ ] Om bugg hittas → backlog-rad med repro-steg

**Reviews:** ingen subagent-review (audit, ingen kod)

**Arkitekturcoverage:** N/A

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| iOS-simulator har inga bilder i fotobibliotek | Medel | Dra in fil via Finder → Simulator, eller använd safari-upload från URL |
| Bokning saknas mellan testkonton | Hög | Skapa manuellt via provider-dashboard först |
| Storage bucket inte skapad lokalt | Medel | Bucket skapas manuellt via Supabase Dashboard (`http://localhost:54323/project/default/storage`) — dokumenterad i S46-0-designen |
| Auth-desync efter JWT-rotation under test | Låg | S49 fixade detta — om det dyker upp: markera som S49-regression |

---

## Definition of Done (sprintnivå)

- [ ] S50-0 done: screenshots + retro-fil + backlog-rader (om buggar)
- [ ] `docs/metrics/messaging-attachments-visual/2026-04-21/` innehåller båda plattformar
- [ ] Inga kod-ändringar i denna sprint (om buggar hittas: separata stories)
- [ ] Sprint-avslut via feature branch + PR per S47-5

**Framtida kandidater för S50:**
- S50-1: Visuell verifiering av booking-flödet (pre-launch)
- S50-2: Visuell verifiering av Stripe-betalning (pre-launch)
- S50-3: iOS auth-flöde efter S48-0/S49-fixarna
