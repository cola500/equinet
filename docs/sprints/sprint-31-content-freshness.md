---
title: "Sprint 31: Content Freshness + Agent Efficiency"
description: "Uppdatera hjälpartiklar, admin testing-guide, release-checklista och förbättra agent-effektivitet"
category: sprint
status: active
last_updated: 2026-04-18
tags: [sprint, content, docs, help, testing, agents, efficiency]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 31: Content Freshness + Agent Efficiency

## Sprint Overview

**Mål:** Säkerställ att användarvänd content är aktuell -- hjälpartiklar och admin testing-guide matchar faktiska features. Skapa en release-checklista som Johan kan köra manuellt före varje större lansering. Dessutom: åtgärda tre konkreta effektivitetsproblem i agent-workflow (verifiera aktualitet, arkivera gamla planer, mät docs-användning).

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

---

### S31-4: Tvinga grep-verifiering i plan-mall

**Prioritet:** 4
**Effort:** 30 min
**Domän:** docs (TEMPLATE.md + scripts/)

Bakgrund: S27 (2/8), S29 (2/6) och S30 (2/7) stories var redan lösta när de plockades. ~25% slösad planering per sprint. Regeln "verifiera aktualitet" i Station 1 finns men fångar inte -- 0 plans/*.md innehåller grep-verifiering i praktiken.

**Implementation:**

**Steg 1: Uppdatera `docs/plans/TEMPLATE.md`**
- Lägg till sektion `## Aktualitet verifierad` FÖRST (före Kontext)
- Kräv: kommandon körda, resultat, beslut (fortsätt / redan löst)
- Markera som "OBLIGATORISK för backlog-stories, N/A för nyskrivna sprint-stories"

**Steg 2: Uppdatera `scripts/check-docs-updated.sh`**
- Lägg till check: om `docs/plans/s<N>-*.md` är staged, grep efter `## Aktualitet verifierad`
- Saknar sektionen → blockera commit med tydligt felmeddelande
- Exkludera TEMPLATE.md från check

**Steg 3: Verifiera hook fungerar**
- Skapa test-plan utan sektionen → commit ska blockeras
- Skapa test-plan MED sektionen → commit ska passera
- Ta bort test-filen

**Acceptanskriterier:**
- [ ] `TEMPLATE.md` har `## Aktualitet verifierad` som första sektion
- [ ] `scripts/check-docs-updated.sh` blockerar plan utan sektionen
- [ ] Hook testad lokalt (positivt + negativt fall)
- [ ] `npm run check:all` grön

---

### S31-5: Arkivera gamla planer

**Prioritet:** 5
**Effort:** 15 min
**Domän:** docs (`docs/plans/` + `docs/archive/plans/`)

Bakgrund: 113 plan-filer i `docs/plans/`, de flesta från avslutade sprintar (s2-s28). Brus försvårar navigation och search.

**Implementation:**

**Steg 1: Skapa arkiv-katalog om den inte finns**
- `mkdir -p docs/archive/plans/`

**Steg 2: Flytta gamla planer**
- `git mv docs/plans/s[2-9]-*.md docs/archive/plans/`
- `git mv docs/plans/s1[0-9]-*.md docs/archive/plans/`
- `git mv docs/plans/s2[0-8]-*.md docs/archive/plans/`
- Behåll i `docs/plans/`: TEMPLATE.md, s29-*.md, s30-*.md, s31-*.md, samt icke-sprint-planer (bdd-payment-refactor.md, etc.)

**Steg 3: Om det behövs, skapa `docs/archive/plans/README.md`**
- Frontmatter + en rad: "Planer från avslutade sprintar (S2-S28). Aktuella planer i `docs/plans/`."

**Acceptanskriterier:**
- [ ] `docs/plans/` innehåller max ~20 filer (aktuella sprintar + template + icke-sprint)
- [ ] Arkiverade planer spårbara via `git log --follow`
- [ ] `docs/archive/plans/README.md` finns med kontext

---

### S31-6: Mät agent-användning av docs

**Prioritet:** 6
**Effort:** 20 min
**Domän:** docs (`.claude/rules/auto-assign.md`)

Bakgrund: `patterns.md` har 9 referenser i done-filer, `code-map.md` har 8. Vi vet inte om dessa katalogserier faktiskt används vid planering eller bara är "dokumentation för dokumentationens skull". Utan data kan vi inte förbättra.

**Implementation:**

**Uppdatera `.claude/rules/auto-assign.md`** Steg 9 (done-fil-kraven):

Lägg till ny sektion efter "Docs uppdaterade":

```markdown
- **Verktyg använda** (OBLIGATORISKT -- vi mäter effektivitet av docs-katalogen):
  - Läste patterns.md vid planering: ja / nej / N/A (trivial)
  - Kollade code-map.md för att hitta filer: ja / nej / N/A (visste redan)
  - Hittade matchande pattern? Vilket? (t.ex. "Webhook idempotency") eller "nej"
  - Varför: efter 10 stories utvärderar vi om katalogen faktiskt ger värde.
```

**Acceptanskriterier:**
- [ ] `auto-assign.md` done-fil-kraven har "Verktyg använda"-sektion
- [ ] Instruktionen är tydlig (ja/nej/N/A-format)
- [ ] Utvärderingsvillkor dokumenterat (efter 10 stories)

---

## Exekveringsplan

```
S31-1 (0.5-1 dag, hjälpartiklar) -> S31-2 (2-3h, testing-guide) -> S31-3 (1h, release-checklist)
Parallellt eller efter: S31-4 (30 min) -> S31-5 (15 min) -> S31-6 (20 min)
```

**Total effort:** ~1-1.5 dag + ~1h agent-effektivisering.

**S31-4/5/6 kan köras som egen batch av docs-session** -- de är oberoende av content-audit (rör helt andra filer).

## Definition of Done (sprintnivå)

- [ ] Hjälpartiklar matchar feature-set (leverantör + admin-MFA + offline som minst)
- [ ] Admin testing-guide uppdaterad
- [ ] `docs/testing/release-checklist.md` finns och är länkad
- [ ] Plan-mall kräver aktualitetsverifiering (hook blockerar)
- [ ] `docs/plans/` innehåller bara aktuella planer + template
- [ ] Done-fil-mall kräver verktyg-använda-rapportering
- [ ] `npm run check:all` grön
