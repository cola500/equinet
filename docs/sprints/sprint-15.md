---
title: "Sprint 15: Cutover till produktion (UTKAST)"
description: "Applicera Supabase Auth + RLS på prod-projektet, byt Vercel env"
category: sprint
status: active
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

**Status:** AKTIV
**Sprint Duration:** 1 dag (planerad som en koordinerad cutover)
**Sprint Goal:** Prod-projektet kör Supabase Auth + RLS. PoC-projektet blir staging.

---

## Sprint Overview

Sprint 13 migrerade all kod. Sprint 14 aktiverade RLS. Sprint 15 applicerar
allt på det riktiga prod-projektet (`xybyzflfxnqqyxnvjklv`).

**Princip:** Inget nytt byggs -- bara konfiguration och data-migrering.

---

## Förutsättningar

- [x] Sprint 13 klar (NextAuth borta, all kod via Supabase Auth)
- [x] Sprint 14 klar (RLS policies testade mot PoC -- 28 policies, 24 bevistester)
- [x] iOS-app uppdaterad med Supabase Swift SDK (S13-4, verifierad i S14-0)
- [x] Alla användare migrerade till PoC auth.users (S11-2) -- bevisat att scriptet fungerar

---

## Läget vid sprintstart (Lead-bedömning från sprint 14 review)

**Vad som är klart:**
- Auth: Supabase Auth är enda källan. NextAuth, MobileTokenService och bcrypt borta.
- RLS: 28 policies (13 read + 15 write) på 7 kärndomäner. Bevisat med 24 integrationstester.
- iOS: Supabase Swift SDK verifierad (S14-0, 2 buggar fixade).
- 3 routes (bookings, services, notifications) migrerade till Supabase-klient.
- 3 968 tester gröna, 0 regressioner genom hela sprint 13-14.

**Kända problem att adressera:**
- **19 E2E-tester failar i CI** (S14-6, ej tagen): Login kräver Supabase Auth men CI har bara dummy-env. Behöver `supabase start` i GitHub Actions eller E2E auth-bypass.
- **Migration-deployment är manuellt**: S14-1 var mergad men aldrig applicerad på Supabase -- upptäcktes bara pga bevistester. Bör verifieras i deploy-checklistan.
- **`ENABLE ROW LEVEL SECURITY` kan missas**: Policies utan ENABLE har ingen effekt. Gotcha dokumenterad i CLAUDE.md.
- **Rollback fungerar**: dual-auth helper (`getAuthUser()`) finns kvar. Om cutover failar: byt Vercel env -> appen faller tillbaka. ~5 min.

**Risker för denna sprint:**
- Prod-databasen rörs på riktigt (hook, trigger, RLS, user-migrering)
- Felaktig hook = ingen kan logga in
- Felaktig user-migrering = lösenord fungerar inte
- Alla har testats mot PoC -- men prod kan ha data-skillnader

---

## Stories

### S15-0: Fixa E2E i CI -- lokal Supabase Auth -- READY

**Prioritet:** Hög (bör fixas före cutover så CI är grön)
**Typ:** Infrastruktur
**Beskrivning:** 19 E2E-tester failar i CI sedan S13. Login når aldrig dashboard
pga saknad Supabase Auth-instans. Överflytt från S14-6 (ej tagen).

**Approach:** `supabase start` i GitHub Actions E2E-jobb, eller auth-bypass i E2E.

**Effort:** 0.5-1 dag

---

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

0. **S15-0** Fixa E2E i CI (grön CI före cutover)
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
