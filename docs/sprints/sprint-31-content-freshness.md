---
title: "Sprint 31: Content Freshness Audit"
description: "Uppdatera hjälpartiklar, admin testing-guide och bygg en återanvändbar release-checklista"
category: sprint
status: active
last_updated: 2026-04-18
tags: [sprint, content, docs, help, testing]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 31: Content Freshness Audit

## Sprint Overview

**Mål:** Säkerställ att användarvänd content är aktuell -- hjälpartiklar och admin testing-guide matchar faktiska features. Skapa en release-checklista som Johan kan köra manuellt före varje större lansering.

**Bakgrund:** Vi har byggt mycket sedan hjälpartiklarna skrevs (S18-2, 2026-02-19). Nya features som återkommande bokningar, onboarding-wizard, MFA, offline PWA och native iOS-vyer nämns inte i hjälpen. Admin testing-guide (S27-8) har samma utmaning. Johan vill ha en manuell verifieringschecklista som kan återanvändas vid framtida lanseringar.

**Princip:** Content ska matcha kod. När kod ändras ska content uppdateras -- detta är en recovery-sprint för att synka efter ett par veckors funktionsbyggande.

---

## Sessionstilldelning

En session kör hela sprinten sekventiellt. Alla stories är docs-tunga.

- **Session 1** (Sonnet lämpar sig bra -- mekaniskt content-arbete)

Om parallellt önskas:
- Session 1: S31-1 (hjälpartiklar, `src/lib/help/articles/`)
- Session 2: S31-2 (testing-guide, `docs/testing/`) + S31-3 (release-checklist, `docs/testing/`)

Ingen filöverlapp mellan session 1 och 2.

---

## Stories

### S31-1: Hjälpartiklar-audit och uppdatering

**Prioritet:** 1
**Effort:** 0.5-1 dag
**Domän:** webb (content i `src/lib/help/articles/`)

51 markdown-filer migrerade i S30-5 men innehållet är från S18-2. Sedan dess har vi byggt: återkommande bokningar, onboarding-wizard, MFA för admin, offline PWA, native iOS-vyer, due-for-service, ruttannonser, gruppbokningar.

**Implementation:**

**Steg 1: Inventera befintligt innehåll**
- Lista alla 51 artiklar med titel + sammanfattning (script eller manuell lista)
- Dela in i: leverantör / kund / admin

**Steg 2: Inventera aktuella features**
- Läs `README.md` Implementerade Funktioner
- Läs `docs/guides/feature-docs.md`
- Lista features som saknas i hjälpartiklarna

**Steg 3: Kategorisera gap**
- **Uppdatera befintlig** -- artikel finns men innehåll inaktuellt
- **Skapa ny** -- feature saknas helt i hjälpen
- **Deprecate** -- feature finns inte längre men artikel kvar

**Steg 4: Prioritera och åtgärda**
- Fokusera på leverantör-artiklar (primär målgrupp)
- Kund-artiklar täcker kärnflöden (boka, hantera konto)
- Admin-artiklar (om finns) -- MFA är nytt viktigt ämne

**Scope-begränsning:** Om 1 dag inte räcker -- prioritera uppdateringar av **befintliga** artiklar framför nya. Sätt upp backlog-items för resten.

**Acceptanskriterier:**
- [ ] Inventering-dokument: vad finns, vad saknas
- [ ] Minst uppdaterade: alla leverantör-artiklar som berör ändringar sedan S18-2
- [ ] Minst skapade: MFA-artikel (admin), offline-användning (leverantör)
- [ ] Deprecerade artiklar flaggade eller borttagna
- [ ] Hjälpcentral renderar alla uppdaterade artiklar korrekt
- [ ] `npm run check:all` grön

---

### S31-2: Admin testing-guide uppdatering

**Prioritet:** 2
**Effort:** 2-3h
**Domän:** docs (`docs/testing/` + admin-sidan)

Testing-guide flyttades till markdown i S27-8. Sedan dess har vi inte underhållit innehållet. Nya features saknar test-scenarier.

**Implementation:**

**Steg 1: Läs befintlig guide**
- Identifiera test-scenarier som finns
- Kolla om några är obsoleta (funktioner som ändrats)

**Steg 2: Lägg till saknade scenarier för nya features**
- Onboarding-wizard (ny leverantör → första bokning)
- MFA för admin (enrollment + verifiering)
- Offline-upplevelse (leverantör i simulator eller dev)
- Recurring bookings (serie-skapande, cancel)
- Self-reschedule (kund bokar om)
- Custom insights (AI-genererade)
- Native iOS-flöden

**Steg 3: Markera obsoleta**
- Scenarier som refererar fler-avaktiverade features

**Acceptanskriterier:**
- [ ] Testing-guide reflekterar nuvarande feature-set
- [ ] Nya features har test-scenarier
- [ ] Obsoleta scenarier borttagna eller markerade
- [ ] Admin-sidan renderar korrekt

---

### S31-3: Release-checklista som återanvändbart dokument

**Prioritet:** 3
**Effort:** 1h
**Domän:** docs (`docs/testing/`)

Johan behöver en manuell verifieringschecklista att köra före varje större lansering. Baserat på faktiska features, prioriterad efter risk.

**Implementation:**

Skapa `docs/testing/release-checklist.md` med:

**Sektioner:**
1. **Kritiska flöden** (måste fungera)
   - Registrering → e-post-verifiering → inloggning
   - Provider bokning-cykel (skapa, bekräfta, komplettera, recension)
   - Kund bokar hos provider
   - Admin MFA (enrollment + verifiering)

2. **Feature-specifika flöden**
   - Offline-flöde (iOS + webb PWA)
   - Hjälpcentral (sök, öppna artikel, rollspecifikt innehåll)
   - Ruttplanering (kart-rendering)
   - Onboarding welcome-vy
   - Återkommande bokningar

3. **Säkerhet (automatiserat -- inte manuell check)**
   - Referera till `npm run check:all` för automatiska gates
   - Referera till `scripts/rls-proof-tests.sh` för RLS-verifiering

4. **Pre-launch-blockerare**
   - Apple Developer-konto (för push)
   - Stripe live-mode (för betalning)
   - Vercel Pro (för kommersiellt bruk)

**Format:** Checkbox-lista med "Var att klicka" + "Förväntat resultat" per punkt.

**Acceptanskriterier:**
- [ ] `docs/testing/release-checklist.md` skapad
- [ ] Täcker kritiska flöden + feature-specifika + blockerare
- [ ] Länkad från README.md (Testing-sektion) och/eller CLAUDE.md snabbreferens
- [ ] Format: checkbox per rad, enkelt att bocka av

---

## Exekveringsplan

```
S31-1 (0.5-1 dag, hjälpartiklar) -> S31-2 (2-3h, testing-guide) -> S31-3 (1h, release-checklist)
```

**Total effort:** ~1-1.5 dag.

## Definition of Done (sprintnivå)

- [ ] Hjälpartiklar matchar feature-set (leverantör + admin-MFA + offline som minst)
- [ ] Admin testing-guide uppdaterad
- [ ] `docs/testing/release-checklist.md` finns och är länkad
- [ ] Inga nya hjälpartiklar utan rendering-verifiering
- [ ] `npm run check:all` grön
