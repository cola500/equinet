---
title: "Sprint 15: Cutover till produktion (UTKAST)"
description: "Applicera Supabase Auth + RLS på prod-projektet, byt Vercel env"
category: sprint
status: draft
last_updated: 2026-04-04
tags: [sprint, production, cutover, supabase, auth, rls]
sections:
  - Sprint Overview
  - Förutsättningar
  - Stories
  - Rollback-plan
  - Sprint Retro Template
---

# Sprint 15: Cutover till produktion (UTKAST)

**Status:** UTKAST -- aktiveras efter sprint 14 (RLS Live testad mot PoC)
**Sprint Duration:** 1 dag (planerad som en koordinerad cutover)
**Sprint Goal:** Prod-projektet kör Supabase Auth + RLS. PoC-projektet blir staging.

---

## Sprint Overview

Sprint 13 migrerade all kod. Sprint 14 aktiverade RLS. Sprint 15 applicerar
allt på det riktiga prod-projektet (`xybyzflfxnqqyxnvjklv`).

**Princip:** Inget nytt byggs -- bara konfiguration och data-migrering.

---

## Förutsättningar

- [ ] Sprint 13 klar (NextAuth borta, all kod via Supabase Auth)
- [ ] Sprint 14 klar (RLS policies testade mot PoC)
- [ ] iOS-app uppdaterad med Supabase Swift SDK (S13-4)
- [ ] Alla användare migrerade till PoC auth.users (S11-2) -- bevisat att scriptet fungerar

---

## Stories

### S15-1: Applicera hook + trigger + RLS på prod -- READY

**Prioritet:** Högst
**Typ:** Operations
**Beskrivning:** Kör samma migrationer som testats mot PoC på prod-projektet.

**Uppgifter:**
1. `prisma migrate deploy` mot prod (applicerar hook + trigger + RLS-migrationer)
2. Aktivera Custom Access Token Hook i prod Supabase Dashboard
3. Verifiera: hook returnerar claims korrekt

**Effort:** 1h

---

### S15-2: Migrera prod-användare till auth.users -- READY

**Prioritet:** Hög
**Typ:** Data-migrering
**Beskrivning:** Kör user-migration scriptet (S11-2) mot prod.

**Uppgifter:**
1. Dry-run: `npx tsx scripts/migrate-users-to-supabase-auth.ts --dry-run`
2. Live: kör mot prod Supabase
3. Verifiera: befintlig användare kan logga in via Supabase Auth

**Effort:** 30 min

---

### S15-3: Byt Vercel env -- READY

**Prioritet:** Hög
**Typ:** Config
**Beskrivning:** Peka Vercel Production env mot prod-projektet med Supabase Auth.

**Uppgifter:**
1. Sätt `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` till prod-projektets värden
2. Sätt `SUPABASE_SERVICE_ROLE_KEY` till prod-projektets service role
3. Behåll `DATABASE_URL` + `DIRECT_DATABASE_URL` (redan prod)
4. Trigga redeploy
5. Verifiera: login fungerar på equinet-app.vercel.app

**Effort:** 30 min

---

### S15-4: Smoke-test produktion -- READY

**Prioritet:** Högst
**Typ:** Verifiering
**Beskrivning:** Manuell walkthrough av hela appen i produktion.

**Uppgifter:**
1. Login med befintligt konto (Supabase Auth)
2. Dashboard, bokningar, kunder, tjänster -- laddar?
3. Skapa en bokning -- fungerar?
4. iOS-appen: login + navigation
5. RLS: provider ser bara sin data?

**Effort:** 30 min

---

### S15-5: Penetrationstest av nya auth-flödet -- READY

**Prioritet:** Hög
**Typ:** Säkerhet
**Beskrivning:** Pentest av det kompletta Supabase Auth + RLS-flödet i produktion. Föregående pentest (feb 2026) kördes innan auth-migreringen.

**Uppgifter:**
1. Kör security-reviewer på alla auth-relaterade routes (login, registration, session-exchange, dual-auth)
2. Testa IDOR: kan en provider nå en annans data trots RLS?
3. Testa privilege escalation: kan en customer bli provider/admin via manipulerade claims?
4. Testa JWT-manipulation: funkar det att ändra providerId i token?
5. Testa rate limiting: login brute force, API-bombardering
6. Testa session-hantering: cookie-stöld, session fixation, replay
7. Dokumentera resultat i `docs/security/pentest-2026-04-post-migration.md`

**Effort:** 2-3h

---

### S15-6: PoC-projektet blir staging -- READY

**Prioritet:** Medel
**Typ:** Config
**Beskrivning:** Dokumentera att `zzdamokfeenencuggjjp` är staging-miljön.

**Uppgifter:**
1. Uppdatera `docs/operations/environments.md`
2. Sätt Vercel Preview env att peka på PoC-projektet
3. Uppdatera `.env.example`

**Effort:** 30 min

---

## Rollback-plan

Om cutover misslyckas:

1. Byt tillbaka Vercel env till gamla värden (inga Supabase Auth env-vars)
2. Deploy -- appen faller tillbaka till NextAuth (koden har dual-auth helper)
3. Undersök vad som gick fel

**Rollback-tid:** ~5 minuter (env-byte + deploy)

---

## Prioritetsordning

1. **S15-1** Hook + trigger + RLS på prod
2. **S15-2** Migrera användare
3. **S15-3** Byt Vercel env
4. **S15-4** Smoke-test
5. **S15-5** Penetrationstest av nya auth-flödet
6. **S15-6** PoC = staging

---

## Sprint Retro Template

### Cutover lyckad?

### Vad gick bra?

### Vad kan förbättras vid nästa cutover?

### Auth-migrering komplett?
