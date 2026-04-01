---
title: "Sprint 4: Demo-Ready Production"
description: "Produktionsdeploy, invite live, due-for-service native, UX-polish inför leverantörsdemo"
category: sprint
status: active
last_updated: 2026-04-01
tags: [sprint, production, demo, ios, polish]
sections:
  - Sprint Overview
  - Blockerare
  - Stories
  - Demo-checklista
  - Sprint Retro Template
---

# Sprint 4: Demo-Ready Production

**Sprint Duration:** 2-3 dagar (innan demo)
**Sprint Goal:** Appen körbar i produktion, invite live, en ny native-skärm, UX polerad.
**Start Date:** 2026-04-02

---

## Sprint Overview

Sprint 3 gjorde appen funktionellt redo. Sprint 4 gör den produktionsredo:
equinet-app.vercel.app ska kunna visas live för en leverantör med självförtroende.

**Roller:**
- Lead: Review, merge, produktionsdeploy
- Dev: Implementation
- Johan: Apple Developer-konto (när möjligt), demo-feedback

---

## Blockerare

| Blocker | Påverkar | Ägare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push live | Johan | Ej köpt -- push-kod redo |

---

## Stories

### S4-1: Produktionsdeploy + verifiering -- READY

**Prioritet:** Högst
**Typ:** Operations
**Beskrivning:** Verifiera att equinet-app.vercel.app visar senaste koden. Kör demo-seed på prod-db. Testa login + kärnflöde.

**Uppgifter:**

1. Kör `npm run migrate:status` -- jämför lokalt vs Supabase
2. Applicera eventuella pending migrationer mot Supabase
3. Committa + pusha allt till main
4. Verifiera att Vercel auto-deployar (eller kör `npm run deploy`)
5. Testa på equinet-app.vercel.app:
   - Login med provider@example.com
   - Dashboard, bokningar, kunder, tjänster -- laddar korrekt?
   - Inga 500-fel i nätverksfliken
6. Kör demo-seed på prod (om separat demo-miljö) eller verifiera befintlig data

**Acceptanskriterier:**
- [ ] equinet-app.vercel.app visar senaste koden
- [ ] Login fungerar
- [ ] Kärnflödet (dashboard -> bokningar -> kunder) fungerar utan fel
- [ ] `npm run migrate:status` visar inga pending migrationer

**Stationsflöde:** Förenklat (operations): Verify -> Merge

---

### S4-2: Slå på customer_invite i produktion -- READY

**Prioritet:** Hög
**Typ:** Feature launch
**Beskrivning:** Aktivera invite-flaggan så demon kan visa "bjud in kund" live.

**Uppgifter:**

1. Sätt `FEATURE_CUSTOMER_INVITE=true` i Vercel env (Production + Preview)
2. Verifiera att Resend-email levereras (skicka testinbjudan)
3. Testa accept-invite-flödet i produktion
4. Om email inte levereras: verifiera Resend-domän, DNS, avsändaradress

**Acceptanskriterier:**
- [ ] Invite-knapp synlig i kundkortet
- [ ] Email levereras till mottagaren
- [ ] Accept-invite-sidan fungerar
- [ ] Ghost-kund uppgraderas till riktig kund efter accept

**Stationsflöde:** Förenklat (config): Verify -> Merge

---

### S4-3: Due-for-service native iOS -- READY

**Prioritet:** Medel
**Typ:** iOS-migrering
**Beskrivning:** Migrera due-for-service-skärmen från WebView till native SwiftUI. Visar kunder som behöver nästa besök -- relevant för leverantörsdemon ("se vilka kunder som snart behöver dig").

**Uppgifter:**

1. Feature inventory (obligatoriskt -- läs webbsidans alla komponenter)
2. Skapa `/api/native/due-for-service` med Bearer JWT-auth
3. Codable structs + ViewModel med DI
4. SwiftUI-vy med lista, filtrering, tap-to-navigate
5. Koppla in i NativeMoreView (native routing istället för MoreWebView)
6. Tester: ViewModel + API route

**Acceptanskriterier:**
- [ ] Feature inventory genomförd och granskad
- [ ] Native vy visar kunder med service-intervall och dagar sedan senast
- [ ] Tap navigerar till kunddetalj
- [ ] ViewModel-tester skrivna och gröna
- [ ] API route-tester skrivna och gröna
- [ ] Visuell verifiering med mobile-mcp

**Stationsflöde:** Fullständigt: Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S4-4: UX-polish av befintliga native-skärmar -- READY

**Prioritet:** Medel
**Typ:** Polish
**Beskrivning:** Små förbättringar som gör befintliga native-skärmar mer professionella inför demon.

**Uppgifter (välj de viktigaste, alla behöver inte göras):**

1. Loading states -- säkerställ att alla native-vyer har skeleton/spinner vid laddning
2. Empty states -- bra meddelanden när listor är tomma ("Inga bokningar ännu")
3. Error states -- retry-knapp vid nätverksfel
4. Pull-to-refresh -- verifiera att det fungerar på alla native-vyer
5. Haptic feedback -- konsekvent på alla interaktioner (confirm, delete, refresh)

**Acceptanskriterier:**
- [ ] Minst 3 polish-förbättringar genomförda
- [ ] Visuell verifiering med mobile-mcp
- [ ] iOS-tester gröna

**Stationsflöde:** Förenklat (polish): Green -> Verify -> Merge

---

### S4-5: Säkerställ demo-data i produktion -- BACKLOG

**Prioritet:** Låg
**Typ:** Operations
**Beskrivning:** Om demo körs mot prod-URL behövs realistisk data. Kanske en separat demo-miljö.

**Uppgifter:**

1. Beslut: kör demo lokalt eller på prod-URL?
2. Om prod: verifiera att demo-seed fungerar mot Supabase
3. Om lokal: dokumentera exakt setup-steg

**Acceptanskriterier:**
- [ ] Demo-miljö beslutad och dokumenterad
- [ ] Seed-data verifierad i vald miljö

---

## Prioritetsordning

1. **S4-1** (deploy) -- grund för allt annat
2. **S4-2** (invite live) -- synlig feature för demo
3. **S4-3** (due-for-service) -- ny native-skärm, visar djup
4. **S4-4** (polish) -- professionellt intryck
5. **S4-5** (demo-data) -- backlog, om tid finns

---

## Demo-checklista (uppdaterad)

```bash
# 1. Produktionsstatus
npm run migrate:status          # inga pending
npm run env:status              # rätt databas

# 2. Demo-data (lokal)
npm run db:seed:demo:reset

# 3. Demo-läge
# .env.local: NEXT_PUBLIC_DEMO_MODE=true
# .env.local: FEATURE_CUSTOMER_INVITE=true

# 4. Starta
npm run dev

# 5. Walkthrough
# Login: provider@example.com / ProviderPass123!
# Dashboard -> Bokningar (godkänn en) -> Kunder (bjud in en)
# -> Tjänster -> Recensioner -> Due-for-service (ny!)
# iOS: samma flow i native-appen

# 6. Om prod-URL
# Öppna equinet-app.vercel.app
# Samma walkthrough
```

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Är appen redo att visas? (ja/nej + motivering)

### Feedback från demon?
