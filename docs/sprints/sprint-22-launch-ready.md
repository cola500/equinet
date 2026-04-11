---
title: "Sprint 22: Lanseringsklar"
description: "Sista stegen innan riktig lansering -- onboarding-wizard, branch protection, ops-docs"
category: sprint
status: active
last_updated: 2026-04-11
tags: [sprint, launch, onboarding, ops]
sections:
  - Sprint Overview
  - Bakgrund
  - Stories
  - Exekveringsplan
---

# Sprint 22: Lanseringsklar

## Sprint Overview

**Mål:** En ny leverantör ska kunna registrera sig, sätta upp sin profil och ta emot sin första bokning -- utan seed-data och utan handledning.

**Bakgrund:** Produkten är tekniskt mogen (21 sprintar, 4000+ tester, Supabase Auth, RLS, Stripe, härdning klar). Men idag kan ingen ny leverantör komma igång själv. Registrering fungerar, men efter inloggning är det tomt och otydligt. OnboardingChecklist finns men leder inte genom stegen tillräckligt.

**Princip:** Bygg det minimala som krävs för att en riktig person klarar flödet. Ingen ny infrastruktur -- använd det som finns.

---

## Stories

### S22-1: Onboarding welcome-vy efter första inloggning

**Prioritet:** 1
**Effort:** 0.5 dag
**Roll:** fullstack

Ny leverantör som loggar in första gången (allComplete === false) ska mötas av en tydlig welcome-vy istället för en tom dashboard. Vyn guidar genom de 4 stegen i OnboardingChecklist.

**Befintligt att bygga på:**
- `OnboardingChecklist` (`src/components/provider/OnboardingChecklist.tsx`) -- 4 steg, dismiss-logik, localStorage
- `GET /api/provider/onboarding-status` -- returnerar profileComplete, hasServices, hasAvailability, hasServiceArea, allComplete
- Dashboard (`src/app/provider/dashboard/page.tsx`) -- renderar redan OnboardingChecklist

**Implementation:**
- Ny komponent `OnboardingWelcome` som ersätter dashboardens huvudinnehåll när `allComplete === false`
- Visar: välkomstmeddelande, progress (X av 4 klara), de 4 stegen med status och tydliga CTA-knappar
- När allComplete -> visa vanlig dashboard (ingen redirect, bara villkorlig rendering)
- Återanvänd OnboardingChecklist-logiken (samma API, samma steg-definition)
- Dismiss-knapp: "Visa dashboard ändå" -> sätter localStorage, visar vanlig dashboard med checklistan i sidofältet (befintligt beteende)

**Design:**
- Full-width card centrerat, max-w-lg
- Progress-indikator (t.ex. 2/4 klara med progress-bar)
- Varje steg: ikon + rubrik + kort beskrivning + knapp ("Fyll i profil", "Lägg till tjänst", etc.)
- Klart-steg: grön bock, knappen blir "Redigera"
- Mobil-först: funkar på telefon (vertikalt, knappar full-width)

**Acceptanskriterier:**
- [ ] Ny leverantör ser welcome-vy vid första inloggning
- [ ] Varje steg-knapp navigerar till rätt sida
- [ ] Klara steg visas som gröna bockar
- [ ] "Visa dashboard ändå" visar vanlig dashboard
- [ ] När alla 4 klara -> welcome-vy försvinner automatiskt
- [ ] Mobil-responsiv
- [ ] Tester: rendering med olika onboarding-status-kombinationer

---

### S22-2: Tom-state-förbättringar på nyckel-sidor

**Prioritet:** 2
**Effort:** 0.5 dag
**Roll:** fullstack

När en ny leverantör klickar sig till tjänster, tillgänglighet eller bokningar möts de av tomma sidor. Varje sida behöver en tydlig tom-state med CTA.

**Sidor att förbättra:**

1. **Tjänster** (`/provider/services`) -- "Du har inga tjänster ännu. Lägg till din första tjänst för att börja ta emot bokningar." + knapp "Skapa tjänst"
2. **Bokningar** (`/provider/bookings`) -- "Inga bokningar ännu. När kunder bokar dina tjänster visas de här." (ingen CTA -- kunden bokar)
3. **Tillgänglighet** (availability-sektionen på profil) -- "Ställ in vilka tider du är tillgänglig så att kunder kan boka." + guide-text

**Implementation:**
- Kolla befintliga empty states -- förbättra text och lägg till CTA där det saknas
- Länka tillbaka till onboarding: "Tillbaka till kom igång" om allComplete === false
- Använd EmptyState-mönster som redan finns i dashboarden

**Acceptanskriterier:**
- [ ] Alla 3 sidor har tydlig tom-state med relevant CTA
- [ ] "Tillbaka till kom igång"-länk under onboarding
- [ ] Konsekvent design (samma EmptyState-mönster)
- [ ] Tester: tom-state renderas korrekt

---

### S22-3: E-postverifiering Resend-verifiering

**Prioritet:** 3
**Effort:** 0.5 dag
**Roll:** fullstack

Registreringsflödet kräver e-postverifiering via Supabase som skickar mail via Resend. Vi behöver verifiera att hela kedjan fungerar i produktion (inte bara lokalt).

**Implementation:**
- Testa registreringsflödet end-to-end i produktionsmiljön (Supabase + Resend)
- Verifiera: mail levereras, verifieringslänk fungerar, redirect efter verifiering
- Om problem: felsök Resend-konfigurationen i Supabase
- Dokumentera resultatet

**Acceptanskriterier:**
- [ ] Registreringsmail levereras i produktion
- [ ] Verifieringslänk fungerar och redirectar korrekt
- [ ] Dokumenterat i ops-docs

---

### S22-4: Branch protection + ops-docs

**Prioritet:** 4
**Effort:** 1h
**Roll:** fullstack

Tre korta ops-uppgifter som behövs för lansering:

1. **Branch protection på GitHub** (30 min)
   - Kräv PR för merge till main
   - Kräv att CI passerar (quality gates)
   - Ingen force push

2. **Backup RPO/RTO-dokumentation** (15 min)
   - Dokumentera Supabase automatisk backup (daily, 7 dagars retention på free tier)
   - RPO: 24h, RTO: beror på Supabase restore-tid
   - Dokumentera i `docs/operations/backup-policy.md`

3. **Incident response-plan** (15 min)
   - Enkel one-pager: vem gör vad vid Stripe-avbrott, Supabase-avbrott, dataintrång
   - Kontaktinfo, eskaleringsordning
   - Dokumentera i `docs/operations/incident-response.md`

**Acceptanskriterier:**
- [ ] Branch protection aktiverat på main
- [ ] Backup-policy dokumenterad
- [ ] Incident response-plan skriven
- [ ] Ingen kan pusha direkt till main

---

### S22-5: Smoke-test hela registreringsflödet

**Prioritet:** 5
**Effort:** 1h
**Roll:** fullstack

Manuellt end-to-end-test av hela flödet: registrering -> verifiering -> inloggning -> onboarding -> första tjänst -> första bokning. Dokumentera problem.

**Implementation:**
- Starta lokal dev-server med ren databas
- Gå igenom flödet som en helt ny användare
- Dokumentera varje steg: fungerar / problem / UX-friktion
- Fixa eventuella blockerande buggar direkt
- Skriv E2E-spec för smoke-test av registreringsflödet (om tid finns)

**Acceptanskriterier:**
- [ ] Hela flödet testat manuellt
- [ ] Alla blockerande buggar fixade
- [ ] Resultat dokumenterat i done-filen

---

### S22-6: Dokumentera och stäm av

**Prioritet:** 6 (sist)
**Effort:** 30 min
**Roll:** fullstack

- Uppdatera backlog.md: flytta åtgärdade items till Genomfört
- Uppdatera README om registreringsflödet
- Kör `npm run check:all`

**Acceptanskriterier:**
- [ ] Backlog uppdaterad
- [ ] README uppdaterad om det behövs
- [ ] `npm run check:all` grön

---

## Exekveringsplan

```
S22-1 (0.5d, welcome-vy) -> S22-2 (0.5d, tom-states) -> S22-3 (0.5d, e-post) -> S22-4 (1h, ops) -> S22-5 (1h, smoke) -> S22-6 (30m, docs)
```

**Total effort:** ~2 dagar

S22-1 och S22-2 är kärnarbetet (UI). S22-3 är verifiering. S22-4 och S22-5 är ops/kvalitet.

## Definition of Done (sprintnivå)

- [ ] Ny leverantör kan registrera sig och guidas genom setup
- [ ] Tom-states tydliga på alla nyckel-sidor
- [ ] E-postverifiering fungerar i produktion
- [ ] Branch protection aktiverat
- [ ] Backup och incident response dokumenterade
- [ ] Hela registreringsflödet testat manuellt
- [ ] `npm run check:all` grön

## Blockerare (utanför sprint-scope)

Dessa krävs för full lansering men kan inte lösas i kod:
- Apple Developer Program ($99) -- push-notiser
- Stripe företagsverifiering -- live-betalningar + Swish
- Vercel Pro ($20/mån) -- kommersiellt bruk
