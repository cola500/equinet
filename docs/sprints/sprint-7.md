---
title: "Sprint 7: RLS Fas 1 + lansering"
description: "Stärk app-lagret (RLS fas 1), push live, Stripe live-mode. Demo-feedback stories läggs till löpande."
category: sprint
status: active
last_updated: 2026-04-01
tags: [sprint, rls, security, push, stripe, launch]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 7: RLS Fas 1 + lansering

**Sprint Duration:** 1 vecka
**Sprint Goal:** Säkra dataåtkomst med ownership-guards i repositories, slå på push och betalning.

---

## Sprint Overview

Fas 1 RLS stärker app-lagret: `findById()` ersätts med `findByIdForProvider()`/`findByIdForCustomer()`.
ESLint-regel varnar vid direkt Prisma-access utanför repositories.
Push och Stripe aktiveras när blockerare löses.

---

## Stories

### S7-1: Fas 1 RLS -- ownership-guards i repositories -- READY

**Prioritet:** Högst
**Typ:** Säkerhet
**Beskrivning:** Ersätt generiska `findById()` med ownership-scoped metoder i alla kärndomäners repositories. Lägg till ESLint-regel som varnar vid direkt `prisma.booking.find*` utanför `src/infrastructure/`.

**Uppgifter:**

1. **BookingRepository:**
   - `findById(id)` -> `findByIdForProvider(id, providerId)` + `findByIdForCustomer(id, customerId)`
   - Atomic WHERE: ownership ALLTID i query, inte i efterhand
   - Behåll `findById()` som `@deprecated` med admin-guard tills alla anropare migrerade

2. **Samma mönster i övriga kärndomäner:**
   - ReviewRepository
   - HorseRepository
   - ServiceRepository
   - CustomerReviewRepository

3. **ESLint-regel:**
   - `no-restricted-syntax` för `prisma.booking.find*` utanför `src/infrastructure/`
   - Eller custom regel som varnar vid direkt Prisma-access i routes

4. **Uppdatera code review-checklista:**
   - "Ny query? Ownership i WHERE?"

5. **Migrera anropare:** Uppdatera alla routes som anropar `findById()` till scoped version

**Acceptanskriterier:**
- [ ] `findByIdForProvider()` och `findByIdForCustomer()` finns i BookingRepository
- [ ] Samma mönster i Review, Horse, Service, CustomerReview repositories
- [ ] Alla routes migrerade till scoped metoder
- [ ] ESLint-regel aktiv
- [ ] Alla tester gröna
- [ ] `npm run check:all` passerar

**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S7-2: Push live -- PENDING (blockerare: Apple Developer)

**Prioritet:** Hög
**Typ:** Config
**Beskrivning:** Plugga in APNs-credentials. Koden är klar sedan sprint 3.

**Uppgifter:**
1. Johan skapar APNs .p8-nyckel (se `docs/operations/apns-setup.md`)
2. Sätt env-variabler i Vercel: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`, `APNS_BUNDLE_ID`
3. Slå på `push_notifications` flaggan via admin
4. Testa: skapa bokning -> leverantör får push

**Acceptanskriterier:**
- [ ] Push-notis levereras till iOS-simulator/enhet
- [ ] Booking-created notification med confirm/decline actions

**Blocker:** Apple Developer-konto

---

### S7-3: Stripe live-mode + slå på betalning -- PENDING (blockerare: Stripe verifiering)

**Prioritet:** Hög
**Typ:** Config
**Beskrivning:** Byt Stripe test-nycklar till live-nycklar. Slå på `stripe_payments` flaggan.

**Uppgifter:**
1. Stripe företagsverifiering klar
2. Kopiera live-nycklar (`sk_live_...`, `pk_live_...`) till Vercel env
3. Sätt `PAYMENT_PROVIDER=stripe` i Vercel env (redan satt)
4. Slå på `stripe_payments` flaggan via admin
5. Testa: boka -> betala med riktigt kort -> webhook -> status uppdaterad
6. Aktivera Swish om tillgängligt efter verifiering

**Acceptanskriterier:**
- [ ] Betalning med riktigt kort fungerar i produktion
- [ ] Webhook uppdaterar betalningsstatus

**Blocker:** Stripe företagsverifiering

---

### S7-4: Voice logging AI-spike -- READY

**Prioritet:** Hög
**Typ:** Research/spike
**Beskrivning:** `voice_logging` är default on men det är oklart om server-side AI-tolkning faktiskt fungerar. SpeechRecognizer finns på iOS och VoiceInterpretationService finns server-side, men alla tester mockar AI-anropet. Spike: ta reda på om det fungerar, vad som saknas, och om vi ska stänga av flaggan tills det är fixat.

**Frågor att besvara:**
1. Vad gör VoiceInterpretationService? Vilken AI-provider anropas (OpenAI, Anthropic, annat)?
2. Finns det en riktig API-nyckel konfigurerad (env-var)?
3. Fungerar det end-to-end (tal -> transkribering -> AI-tolkning -> strukturerad data)?
4. Om det inte fungerar: vad saknas? Hur stort arbete?
5. Ska flaggan stängas av tills det är fixat?

**Leverans:**
- Dokument: `docs/research/voice-logging-spike.md`
- Beslut: flaggan på eller av i produktion
- Ingen kodändring (research only)

**Stationsflöde:** Förenklat (research): Plan -> Research -> Dokumentera -> Review

**Tidbox:** Max 1 session.

---

### S7-5 -- S7-N: Demo-feedback stories -- TBD

> Läggs till efter leverantörsdemon.

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Demo-feedback som påverkade sprinten?
