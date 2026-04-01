---
title: "Sprint 3: Launch Readiness"
description: "Kundinbjudningar, demo-polish och push-forberedelse for leverantorsdemo"
category: sprint
status: active
last_updated: 2026-04-01
tags: [sprint, launch, invite, push, demo, activation]
sections:
  - Sprint Overview
  - Blockerare
  - Stories
  - Demo-checklista
  - Sprint Retro Template
---

# Sprint 3: Launch Readiness

**Sprint Duration:** 1 vecka
**Sprint Goal:** Göra appen redo att visa för en riktig leverantör. Kundinbjudningar live, demo polerad, push förberedd.
**Start Date:** 2026-04-01
**Beroende:** Sprint 2 (teknikskuld) kan koras parallellt

---

## Sprint Overview

Fokus: activation-lagret. En leverantör som registrerar sig ska kunna bjuda in sina kunder och få notiser om nya bokningar. Demo-läget ska vara felfritt för en walkthrough.

**Roller denna sprint:**
- Tech lead: Arkitektur, review, sprint-planering
- Fullstack: Implementation (invite-harding, push-forberedelse, demo-polish)
- Johan: Apple Developer-konto (blocker for push-lansering)

---

## Blockerare

### Apple Developer Program (99 USD/ar)

**Status:** Ej kopt
**Paverkan:** Push-notiser kan inte skickas till riktiga enheter utan APNs-credentials
**Atagard:** Johan koper kontot. Nar klart: skapa APNs .p8-nyckel, ge Key ID + Team ID till utvecklare

**Vad som behovs i Vercel env efter kop:**
```
APNS_KEY_ID=<10-teckens key ID>
APNS_TEAM_ID=<10-teckens team ID>
APNS_KEY_P8=<base64-encodad .p8-nyckel>
APNS_BUNDLE_ID=com.equinet.Equinet
APNS_PRODUCTION=false   # true for App Store builds
```

### Resend API-nyckel (for e-post)

**Status:** Okant om konfigurerad
**Paverkan:** Kundinbjudningar skickas via Resend. Utan nyckel loggas e-post till konsol istallet.
**Atagard:** Verifiera att `RESEND_API_KEY` finns i Vercel env. Om inte: skapa konto pa resend.com (gratis 100 mail/dag).

---

## Stories

### S3-1: Kundinbjudningar -- hardening och lansering -- READY

**Prioritet:** Hog (kritisk for demo)
**Typ:** Feature completion
**Beskrivning:** Feature ar ~85% klar. Behover tester, flagg-verifiering och E2E.
**Stationsflode:** Red -> Green -> Review -> Verify -> Merge

**Uppgifter:**

1. **Skriv tester for merge-route** (BLOCKER)
   - `POST /api/provider/customers/[customerId]/merge` har 0 tester
   - Destruktiv operation: tar bort ghost-user, flyttar bokningar/hästar/recensioner över 11 tabeller i en transaktion
   - Testa: auth, IDOR, ghost-validering, real user lookup, transaction atomicity, edge cases (self-merge, redan lankad)

2. **Verifiera clientVisible-flagga**
   - `customer_invite` har `clientVisible: false` men UI:t laser `flags.customer_invite` i CustomerCard.tsx
   - Kontrollera om FeatureFlagProvider serverar icke-clientVisible-flaggor
   - Om inte: andra till `clientVisible: true` (ingen sakerhetspaverkan -- flaggan ar en feature gate, inte en security gate)

3. **E2E-test for invite-flow**
   - Lagg till i `e2e/feature-flag-toggle.spec.ts` eller skapa `e2e/customer-invite.spec.ts`
   - Flow: provider loggar in -> oppnar kund -> klickar "Skicka inbjudan" -> verifiera success-state
   - (Accept-flow svart att E2E-testa utan SMTP -- acceptera att det ar manuellt testat)

4. **Sla pa flaggan**
   - Satt `FEATURE_CUSTOMER_INVITE=true` i `.env` och Vercel env
   - Lagg till i playwright.config.ts webServer.env

**Acceptanskriterier:**
- [ ] Merge-route har >= 8 tester (auth, IDOR, happy path, edge cases)
- [ ] clientVisible verifierad och fixad om nodvandigt
- [ ] E2E-test for invite-knapp
- [ ] `npm run check:all` passerar
- [ ] Flaggan pa i dev-miljo

---

### S3-2: Push-notiser -- kodforberedelse (UTAN APNs) -- READY

**Prioritet:** Hog
**Typ:** Feature completion
**Beskrivning:** Fixa all kod sa att push fungerar direkt nar APNs-credentials pluggas in. Kravs: Apple Developer-konto.
**Stationsflode:** Red -> Green -> Review -> Verify -> Merge

**Uppgifter:**

1. **Trigga push-permission vid login**
   - iOS-appen vantar pa `requestPush` bridge-meddelande som ingen webbsida skickar
   - Alternativ A: Anropa `PushManager.shared.requestPermission()` direkt efter lyckad login i AppCoordinator
   - Alternativ B: Lagga till i provider-installningar (mer kontroll for anvandaren)
   - **Rekommendation:** Alternativ A for demo-enkelhet, med opt-out i installningar senare

2. **Token cleanup vid logout**
   - `APIClient.unregisterDeviceToken()` existerar men anropas aldrig vid logout
   - Lagg till i AuthManager.logout() -- anropa unregister FORE token-radering

3. **Testa med simulerad push (utan APNs)**
   - Skriv unit-test for PushDeliveryService som mockar apns2
   - Verifiera att BookingCreatedPushHandler och StatusChangedPushHandler triggas korrekt
   - Testa token-registrering och avregistrering

4. **Dokumentera APNs-setup for Johan**
   - Steg-for-steg: Apple Developer -> Keys -> APNs -> ladda ner .p8
   - Vilka env-variabler som behoves (se Blockerare ovan)

**Acceptanskriterier:**
- [ ] Permission request triggas automatiskt vid login
- [ ] Token cleanup vid logout
- [ ] Unit-tester for push delivery + event handlers
- [ ] APNs-setup-guide i docs/
- [ ] `npm run check:all` passerar
- [ ] iOS-tester grona

**NOT in scope:** Faktisk push-leverans (kraver APNs-credentials)

---

### S3-3: Demo-polish -- READY

**Prioritet:** Medel
**Typ:** Polish
**Beskrivning:** 3 sma UX-fixar identifierade i demo-go-no-go + produktionsdeploy-verifiering.
**Stationsflode:** Forenklat (mekanisk): Green -> Verify -> Merge

**Uppgifter:**

1. **Dölj "Glömt lösenord?" och "Registrera dig här" i demo-läge**
   - Login-sidan visar dessa lankar som leder till ofardiga flooden
   - Gata pa `NEXT_PUBLIC_DEMO_MODE`

2. **Dolj versionsnummer i footer**
   - "v0.2.0" i footern ser inte professionellt ut for en demo
   - Dolj i demo-lage eller flytta till admin

3. **Dolj "Ta bort"-knappar pa tjanster i demo-lage**
   - Roda delete-knappar pa servicekort ar en riskabel klick-target vid demo
   - Dolj i demo-lage

4. **Verifiera produktionsdeploy**
   - Kor `npm run deploy` (kvalitetscheckar + push)
   - Verifiera att equinet-app.vercel.app visar senaste koden
   - Kor demo-seed pa prod-databasen (om separat demo-miljo)

**Acceptanskriterier:**
- [ ] Login-sidan ren i demo-lage
- [ ] Ingen synlig version i demo-lage
- [ ] Inga delete-knappar i demo-lage
- [ ] Produktion deployad och verifierad

---

### S3-4: Seed-data for recensioner -- BACKLOG

**Prioritet:** Lag
**Typ:** Polish
**Beskrivning:** Demo-seeden saknar recensioner. Lagga till 3-4 realistiska recensioner fran demo-kunder.
**Stationsflode:** Green -> Verify -> Merge

**Acceptanskriterier:**
- [ ] 3-4 recensioner med varierande betyg (3-5 stjarnor)
- [ ] Realistiska kommentarer pa svenska
- [ ] `npm run db:seed:demo:reset` inkluderar recensioner

---

## Demo-checklista (kor innan visning)

```bash
# 1. Verifiera miljo
npm run env:status
npm run migrate:status

# 2. Frash demo-data
npm run db:seed:demo:reset

# 3. Satt demo-lage
# I .env.local: NEXT_PUBLIC_DEMO_MODE=true
# I .env.local: FEATURE_CUSTOMER_INVITE=true

# 4. Starta app
npm run dev

# 5. Walkthrough (15 min)
# Login: provider@example.com / ProviderPass123!
# Dashboard -> Kalender -> Bokningar -> Kunder -> Tjanster
# Visa: godkänn bokning, öppna kund, bjud in kund (om live)

# 6. iOS-demo (om relevant)
# Öppna Equinet på simulator/enhet
# Samma login-credentials
# Visa native-vyer: Dashboard, Kalender, Bokningar, Kunder
```

**VIKTIGT:** Borja alltid pa `/login`, visa ALDRIG landningssidan (marknadsforer features som inte funkar an).

---

## Prioritetsordning for utvecklare

1. **S3-1** (invite) -- storst produktvarde, oberoende av Apple
2. **S3-3** (demo-polish) -- snabba vinster, kan koras parallellt
3. **S3-2** (push-kod) -- viktigt men inte synligt utan APNs
4. **S3-4** (recensioner) -- nice-to-have

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.
> Om inget behöver ändras -- ifrågasätt hårdare.

### Är appen redo att visas? (ja/nej + motivering)

### Vad är nästa steg efter demo?
