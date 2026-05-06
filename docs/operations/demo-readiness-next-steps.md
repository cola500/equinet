---
title: "Demo Readiness — Next Steps"
description: "Post-incident plan för konsekvent demo-läge i lokal och produktion. Kort, hårt prioriterad — incident mode avslutad."
category: operations
status: active
last_updated: 2026-05-02
tags: [demo-mode, production-readiness, checklist, post-incident]
sections:
  - 1. Current verified status
  - 2. What is no longer an active incident
  - 3. Remaining risks
  - 4. Demo-ready checklist — local
  - 5. Demo-ready checklist — production
  - 6. Recommended next slice
  - 7. Do not change yet
---

# Demo Readiness — Next Steps

> Lämnar incident mode. Mål: **verifierad demo-ready** — lokal demo + produktionsdemo beter sig konsekvent. Refererar `docs/equinet-technical-reset.md` (superseded) för bakgrundsanalys.

---

## 1. Current verified status

- **Login i produktion fungerar** (manuellt verifierat av Johan 2026-05-02).
- Sprint 64-hotfixarna (APP_URL, Supabase URL Configuration, CSP-läs-från-env, env-värden utan `\n`) håller i prod.
- `/auth/callback` är **inte** aktiv i Supabase Redirect URLs — open-redirect-risken är därmed inert.
- Demo-läget styrs av `NEXT_PUBLIC_DEMO_MODE` (env) eller DB-flaggan `demo_mode` (default `false`). UI-only.
- Demo-seed (`npm run db:seed:demo:reset`) fungerar lokalt mot Supabase CLI.

## 2. What is no longer an active incident

- Login-felsökningen i prod. **Avslutad.**
- Akut åtgärd på `/auth/callback`. Routen är passiv så länge Supabase Redirect URLs inte tillåter den. Hotfix S65-1 förblir städning, inte incident.
- "Top 5 next actions" i reset-rapporten — de fyra första (verifiera prod-domän, env, Redirect URLs) är genomförda eller obsoleta.

## 3. Remaining risks

| # | Risk | Allvar | Var fixas |
|---|------|--------|-----------|
| 1 | `/auth/callback` 3 BLOCKERS — om någon aktiverar den i Supabase blir det open redirect + fel userType-routing | Hög om aktiverad, låg vid status quo | Sprint 65 S65-1 |
| 2 | Fire-and-forget i AuthService → "mail skickat"-success även vid Resend-timeout. Drabbar registrering + password reset | Medel — drabbar tysta användare, inte demo-flöde | Sprint 65 S65-2 |
| 3 | Fire-and-forget kvar i reschedule, invites, booking-series, customers/invite | Medel — kan tappa demo-mail | Sprint 65 S65-3 |
| 4 | Domän-/URL-konsistens (APP_URL vs Supabase Site URL vs Vercel hostname) — bevisat ömtåligt | Medel | URL-matrisen i `docs/operations/url-configuration.md` (S64-7) |
| 5 | Inget E2E som verifierar demo-flödet eller smoke-testar prod-login efter deploy | Medel | Ny story (sektion 6) |
| 6 | `provider@example.com` är single-point-of-failure för demo-seed; kan raderas av `data_retention`-cron eller manuell rensning | Låg — flagga är default off | Validering i seed-script |
| 7 | `STRIPE_WEBHOOK_SECRET` saknas i prebuild-guard | Låg under demo (subscription off) | Sprint 65 S65-4 |

## 4. Demo-ready checklist — local

- [ ] `supabase status` → kör. Annars `npm run db:up`.
- [ ] `.env.local` innehåller `NEXT_PUBLIC_DEMO_MODE=true` och `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- [ ] `.env.local` har **inga** kvarliggande prod-Supabase-credentials (Vercel CLI-fälla — kommentera bort).
- [ ] `npm run db:seed` (skapar `provider@example.com` om saknad).
- [ ] `npm run db:seed:demo:reset` (Maria Lindgren + 4 tjänster + 4 kunder + 3 hästar + 7 bokningar + 3 reviews).
- [ ] `npm run dev` → `http://localhost:3000/login`.
- [ ] Logga in som `provider@example.com` / `ProviderPass123!`.
- [ ] Verifiera: 5 nav-flikar, ingen Registrera-knapp, ingen NotificationBell, ingen "Test Testsson" eller "DEMO-SEED" synlig i UI.
- [ ] Klicka igenom: Översikt → Kalender → Bokningar → Kunder → Tjänster.

## 5. Demo-ready checklist — production

- [ ] Vercel prod-hostname dokumenterad i URL-matrisen och oförändrad sedan senaste verifierad login.
- [ ] `APP_URL` i Vercel prod = exakt prod-hostname (HTTPS, ingen trailing slash, inget `\n`).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` rena från literal `\n` i prod, preview, development.
- [ ] Supabase Site URL = prod-hostname. Redirect URLs allowlist innehåller **inte** `/auth/callback`.
- [ ] Custom Access Token Hook installerad och aktiv i Supabase.
- [ ] `provider@example.com` finns i prod-DB (SQL-check).
- [ ] `demo_mode`-flaggan satt enligt önskat demo-läge i `/admin/system` (eller `NEXT_PUBLIC_DEMO_MODE` i Vercel).
- [ ] Seed mot prod körd manuellt minst en gång efter senaste schema-ändring; demo-data verifierad i `/provider/dashboard`.
- [ ] `data_retention`-flaggan **off** i prod (annars riskerar demo-användare raderas).
- [ ] Senaste Resend-leverans inom 24h verifierad i Resend dashboard.
- [ ] Sentry visar inga auth- eller email-fel senaste 24h.
- [ ] Smoke: GET prod-`/login` → 200 + förväntad text. Login med demo-konto → dashboard renderas.

## 6. Recommended next slice

**Slice: Demo-konsistens-smoke** (1 story, ~0.5 dag, ingen kodändring i auth-lager)

Mål: gör checklistorna ovan körbara och fångningsbara automatiskt — inte bara muntliga.

Innehåll:
1. Lägg till `npm run demo:check:local` — kör `supabase status` + verifierar `provider@example.com` + tellar antal demo-bokningar. Fail tydligt om något saknas.
2. Lägg till `npm run demo:check:prod` — read-only. Pingar `/login` (förväntat 200), pingar `/api/feature-flags` (verifierar `demo_mode`-läge), validerar APP_URL-matchning.
3. Tunn Playwright-spec `e2e/demo-flow.spec.ts` — login som demo-provider, navigera 5 flikar, assertera frånvaro av "DEMO-SEED"/"Test Testsson"/Registrera-knapp.
4. Dokumentera körning i `docs/demo-mode.md` (länk från `docs/INDEX.md`).

**Inte i denna slice:** S65-1..S65-7 (separat sprint), URL-matris-konsolidering (klar i S64-7), demo-data-anrikning (post-launch).

## 7. Do not change yet

1. **`src/app/auth/callback/route.ts`** — passiv route, vänta på S65-1 hotfix-story med tester.
2. **`middleware.ts`** — fungerar i prod just nu.
3. **`src/lib/auth-dual.ts`** — DB-lookup-mönstret är medvetet.
4. **`src/lib/feature-flags.ts`** — special-case för `NEXT_PUBLIC_DEMO_MODE` är medveten; normalisering bryter klient-bundle-injektionen.
5. **`vercel.json`** — region `fra1` är medvetet vald för Supabase `eu-central-2`.
6. **`prisma/seed-demo.ts`** — koordinera ändringar; bryter `db:seed:demo:reset` lokalt om idempotensen rörs.
7. **Supabase URL Configuration** — Site URL och Redirect URLs ska inte röras innan S65-1 mergad. Lägg INTE till `/auth/callback`.
8. **CSP `connect-src` i `next.config.ts`** — hotfix `9410dd21` läser från env. Behåll.
9. **`scripts/check-prod-env.ts`** — utöka via S65-4, inte ad hoc.
10. **`.env`/`.env.local` på dev-maskiner** — fortsätt kommentera bort Vercel-CLI-injicerade prod-credentials. Rör inte schemat.

---

**Nästa beslut:** Godkänn Slice (sektion 6) eller pausa demo-arbetet och starta Sprint 65 S65-1..S65-3 först.
