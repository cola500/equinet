---
title: "Sprint 16: Cleanup + Onboarding"
description: "Ta bort NextAuth-rester, uppdatera seed-scripts, förbered för leverantör #2"
category: sprint
status: active
last_updated: 2026-04-04
tags: [sprint, cleanup, onboarding, seed, nextauth]
sections:
  - Sprint Overview
  - Stories
  - Prioritetsordning
  - Sprint Retro Template
---

# Sprint 16: Cleanup + Onboarding

**Status:** AKTIV
**Sprint Goal:** Rensa migreringsskuld, förbereda för leverantör #2.

---

## Sprint Overview

Sprint 13-15 migrerade auth och aktiverade RLS. Men det finns kvarvarande
NextAuth-referenser i 33 filer, seed-scripts som inte skapar Supabase Auth-användare,
och inget sätt för nya leverantörer att registrera sig.

---

## Stories

### S16-1: Ta bort NextAuth-rester -- READY

**Prioritet:** Hög
**Typ:** Cleanup
**Beskrivning:** 33 filer refererar fortfarande till NextAuth (importer, kommentarer,
auth()-anrop). Pentest flaggade kvarvarande NextAuth-endpoint. Rensa allt.

**Uppgifter:**
1. Ta bort `next-auth` och `@auth/prisma-adapter` från dependencies
2. Ta bort `src/app/api/auth/[...nextauth]/` om den finns (pentest-fynd)
3. Migrera kvarvarande `auth()` -> `getAuthUser()` i routes som missades
4. Rensa NextAuth-kommentarer och importer i alla 33 filer
5. Ta bort `NEXTAUTH_SECRET` och `NEXTAUTH_URL` från `.env.example`
6. Ta bort `middleware.ts` NextAuth-logik (om kvar)
7. Verifiera: `npm run check:all` + grep visar 0 NextAuth-träffar i src/

**Effort:** 0.5-1 dag

---

### S16-2: Seed-scripts för Supabase Auth -- READY

**Prioritet:** Hög
**Typ:** DX (Developer Experience)
**Beskrivning:** Sprint 13 retro flaggade: seed-scripts skapar bara `public.User`,
inte `auth.users`. Nya utvecklare måste köra migrationsscriptet manuellt.

**Uppgifter:**
1. Uppdatera `prisma/seed-demo.ts` att använda `admin.createUser()` för varje user
2. `handle_new_user`-trigger skapar `public.User` automatiskt -- seedet behöver bara auth
3. Uppdatera userType/isAdmin/phone via Prisma efter trigger
4. Hantera idempotens (user finns redan -> skippa eller uppdatera lösenord)
5. Dokumentera i README: "seed skapar användare i Supabase Auth automatiskt"
6. Verifiera: `npm run db:nuke && npm run db:up && npx prisma migrate deploy && npx tsx prisma/seed-demo.ts` fungerar end-to-end

**Effort:** 0.5 dag

---

### S16-3: Onboarding-flöde för leverantör #2 -- READY

**Prioritet:** Högst
**Typ:** Feature
**Beskrivning:** Idag finns ingen väg för en ny leverantör att registrera sig och
komma igång utan seed-data. Sprint 9 identifierade 3 blockerare (ingen checklista,
dåligt felmeddelande, tomma tillstånd). Checklista och tomma tillstånd fixades i S9.

**Uppgifter:**
1. Verifiera registreringsflödet end-to-end (Supabase Auth `admin.createUser()`)
2. Verifiera onboarding-checklistan (S9-8) fungerar för ny leverantör
3. Verifiera tomma tillstånd (S9-10) visas korrekt
4. Testa: registrera -> logga in -> skapa profil -> lägg till tjänst -> ta emot bokning
5. Identifiera och fixa eventuella gap i flödet
6. E2E-test för hela onboarding-flödet

**Effort:** 1-2 dagar

---

### S16-4: Admin-härdning -- MFA + audit log -- READY

**Prioritet:** Hög
**Typ:** Säkerhet
**Beskrivning:** Idag är admin en enkel `isAdmin`-boolean. Inför leverantör #2
behöver admin-rollen stärkas. Supabase stödjer MFA (TOTP) redan.

**Uppgifter:**
1. MFA obligatoriskt för admin: enrolla vid första login, verifiera vid varje session
2. Tidbegränsade admin-sessioner (15 min istället för standard 1h)
3. Audit log: `AdminAuditLog`-tabell (vem, vad, när, IP) för admin-operationer
4. Admin-sida för att läsa audit-loggen
5. Tester: MFA-enrollment, session-timeout, audit-loggning

**Effort:** 1-2 dagar
**Detaljer:** Se `docs/ideas/admin-hardening.md`

---

## Prioritetsordning

1. **S16-1** Cleanup (tar bort teknisk skuld)
2. **S16-2** Seed-scripts (förbättrar DX)
3. **S16-3** Onboarding (förbereder för leverantör #2)
4. **S16-4** Admin-härdning (säkerhet inför skalning)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Redo för leverantör #2?
