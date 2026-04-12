---
title: "Sprint 15 Retro: Cutover till produktion"
description: "Supabase Auth + RLS live i produktion. 7 stories, 1 bugg hittad och fixad."
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Levererat
  - Cutover lyckad
  - Vad gick bra
  - Vad gick fel
  - Vad kan forbattras
  - Nyckeltal
  - Nasta steg
---

# Sprint 15 Retro: Cutover till produktion

**Datum:** 2026-04-04
**Duration:** 1 dag (en session)
**Sprint Goal:** Prod-projektet kor Supabase Auth + RLS

---

## Levererat

| Story | Beskrivning | Tid |
|-------|-------------|-----|
| S15-0 | Fixa E2E i CI (lokal Supabase) | (fran tidigare session) |
| S15-1 | Hook + trigger + RLS pa prod (7 migrationer) | (fran tidigare session) |
| S15-2 | Migrera 17 anvandare (14 med lösenord) | ~1h |
| S15-3 | Vercel env -> prod Supabase | ~30min |
| S15-4 | Smoke-test + RLS-bugg fixad | ~30min |
| S15-5 | Pentest: manuellt + OWASP ZAP + security-reviewer | ~1h |
| S15-6 | PoC = staging, env separerade per miljo | ~30min |

---

## Cutover lyckad?

**JA.** Supabase Auth + RLS kor i produktion. Alla sidor fungerar.
Login, bokningar, kunder, tjänster, kalender, recensioner -- verifierat via Playwright.

---

## Vad gick bra

1. **Migreringarna var val testade**: 28 RLS-policies + 24 bevistester fran S14
   innebar att cutover var mestadels smorjt.

2. **Idempotent migrationsscript**: `email_exists`/`user_already_exists` hanterades
   som skip, sa scriptet kunde koras om utan problem.

3. **Smoke-test avslojde RLS-bugg direkt**: Bokningssidan kraschade pga saknad
   User SELECT-policy. Fixades pa <10 minuter med SQL direkt pa prod (ingen redeploy).

4. **OWASP ZAP baseline clean**: 0 FAIL, 61 PASS. Alla 6 WARN ar kanda och dokumenterade.

5. **Rollback-plan aldrig behovdes**: Dual-auth helper finns kvar som fallback,
   men allt fungerade fran forsta deploy.

---

## Vad gick fel

1. **`.env.local` trumfade `.env.supabase`**: Migrationsscriptet laste fran lokala
   Docker-databasen istallet for prod. Ledde till 13 misslyckade user-skapanden
   (fel UUID:n). Lösning: explicit `parseEnvFile()` istallet for `dotenv`.
   **Tid forlorad: ~30 min debugging.**

2. **PoC och prod har olika UUID:n**: Antog att user-ID:n matchade, men PoC
   seedades separat. Byte till email-matchning fixade det.
   **Tid forlorad: ~15 min.**

3. **`passwordHash`-kolumnen redan borttagen pa prod**: S15-1 applicerade
   `remove_password_hash`-migrationen INNAN user-migreringen. Tvingade fram
   PoC -> prod hash-kopiering istallet for direkt lasning.
   **Tid forlorad: 0 (upptacktes fore korning), men kraver mer komplex script.**

4. **Vercel CLI v50.28.0 preview env-hantering**: `vercel env add ... preview`
   kraaver tomt branch-argument (`""`) i non-TTY. Flera forsok innan det fungerade.
   **Tid forlorad: ~15 min.**

---

## Vad kan forbattras vid nasta cutover

1. **Migrera anvandare FORE passwordHash-borttagning**: Deploy-ordningen borde
   vara: users -> remove column. Inte tvartom.

2. **Separera env per miljo fran borjan**: Delade Vercel env-variabler (alla miljoer)
   ar brakiga att separera i efterhand.

3. **Testa RLS-joins explicit**: Unit-tester via Prisma/service_role missar
   RLS-problem. Lagg till bevistester som kor via Supabase-klient (anon key + JWT).

4. **OWASP ZAP i CI**: Automatisera baseline scan i GitHub Actions.

---

## Nyckeltal

| Metrisk | Varde |
|---------|-------|
| Stories | 7/7 (100%) |
| Anvandare migrerade | 17 (14 med lösenord, 3 utan) |
| RLS-policies (totalt) | 30 (28 fran S14 + 2 nya User-policies) |
| Pentest fynd (kritiska) | 0 |
| Pentest fynd (pre-existerande HIGH) | 3 (backloggade) |
| OWASP ZAP | 0 FAIL, 6 WARN, 61 PASS |
| Tester (totalt) | ~3968 (oforandrade, inga regressioner) |
| Downtime | 0 (live cutover, ingen nertid) |

---

## Nasta steg

1. **Fixa backlogg fran pentest** (3 HIGH):
   - Ta bort NextAuth-endpoint
   - Auth pa /api/geocode
   - Granska user_metadata-anvandning

2. **Sprint 16 planering**: Fokus TBD -- iOS native auth? Stripe live? Features?

3. **PoC-projektet som staging**: Borja använde for preview-deployer,
   verifiera att migrationer appliceras pa bada miljoerna.
