---
title: "Executive Summary -- 4 april 2026"
description: "Dag 5: Cutover till produktion. Supabase Auth + RLS live. 7 stories, 0 downtime."
category: guide
status: active
last_updated: 2026-04-04
sections:
  - Sammanfattning
  - Outcome
  - Hard data
  - Arkitekturbeslut
  - Processforbattringar
  - Nasta steg
---

# Executive Summary -- 4 april 2026

## Sammanfattning

Dag 5 var cutover-dagen. Sprint 15 (7 stories) tog Supabase Auth + RLS fran
testat-pa-PoC till live-i-produktion. Anvandare migrerade, Vercel env bytt,
smoke-testat via Playwright, penetrationstestat med OWASP ZAP.
En RLS-bugg hittades och fixades pa <10 minuter.

**Uppskattad traditionell utvecklingstid: 2-3 veckor.**

---

## Outcome: Vad har forandrats?

### Produktion kor Supabase Auth

| Fore dag 5 | Efter dag 5 |
|-----------|-------------|
| Auth testat mot PoC-projekt | Auth live pa prod-projekt (`xybyzflfxnqqyxnvjklv`) |
| Anvandare bara i public.User | 17 anvandare i auth.users (14 med lösenord) |
| Vercel env pekade pa PoC | Vercel Production -> prod, Preview -> staging |
| RLS otestat i prod | 30 policies, smoke-testat, pentestat |
| Ingen staging-miljo | PoC-projektet = staging (Vercel Preview) |

### Migrerade anvandare

| Typ | Antal | Lösenord |
|-----|-------|----------|
| Providers | 6 | Alla med hash fran PoC |
| Customers | 8 | 5 med hash, 3 utan (behover "Glomt lösenord") |
| Admins | 3 | Alla med hash |
| **Totalt** | **17** | **14 med, 3 utan** |

### Sakerhet (pentest-resultat)

| Test | Resultat |
|------|---------|
| IDOR via RLS (cross-tenant) | PASS -- blockerat |
| JWT manipulation | PASS -- Supabase avvisar |
| Privilege escalation (customer -> provider) | PASS -- blockerat |
| Anonym access | PASS -- 0 data |
| Supabase Auth rate limiting | PASS -- 429 efter ~34 forsok |
| Service role key exponering | PASS -- inte i klient-JS |
| OWASP ZAP baseline | 0 FAIL, 6 WARN (kanda), 61 PASS |
| Security reviewer (kodanalys) | 0 kritiska, 3 pre-existerande HIGH |

### Bugg hittad och fixad

**Bokningssidan kraschade** (`Cannot read properties of null (reading 'firstName')`).
Orsak: `User`-tabellen saknade SELECT-policy for `authenticated`-rollen.
Supabase LEFT JOIN returnerade null istallet for kunddata.
Fix: 2 nya RLS-policies (`user_provider_read`, `user_self_read`), applicerade
direkt pa prod via SQL -- ingen redeploy behovdes.

---

## Hard data

| Matt | Dag 1 | Dag 2 | Dag 3 | Dag 4 | Dag 5 | Totalt |
|------|-------|-------|-------|-------|-------|--------|
| Commits | 125 | 83 | 74 | ~40 | ~20 | ~342 |
| Filer andrade | 181 | 70 | 169 | ~50 | ~20 | ~490 |
| Kodrader tillagda | 12 119 | 5 762 | 8 378 | ~3 500 | ~1 000 | ~30 759 |
| Kodrader borttagna | 1 144 | 172 | 1 559 | ~1 200 | ~500 | ~4 575 |
| Netto | +10 975 | +5 590 | +6 819 | +2 300 | +500 | ~+26 184 |
| Tester | 3 755 | 3 876 | 3 982 | 3 968 | ~3 968 | +213 |
| Stories done | 21 | 12 | 16 | 6 | 7 | 62 |
| Sprintar | 5 | 3 | 4 | 1 | 1 | 14 |

---

## Arkitekturbeslut fattade dag 5

| Beslut | Motivering |
|--------|-----------|
| Email-matchning for user-migrering | PoC och prod har olika UUID:n |
| Explicit env-parsing (inte dotenv) | .env.local trumfar dotenv i tsx-runtime |
| User RLS-policies (provider_read + self_read) | LEFT JOIN mot User kravde SELECT-policy |
| Separerade Vercel env per miljo | Production -> prod, Preview -> PoC (staging) |
| Pentest med OWASP ZAP Docker | Automatiserad baseline scan, 0 installationskrav |

---

## Processforbattringar dag 5

| Forbattring | Effekt |
|-------------|--------|
| Smoke-test via Playwright MCP | Visuell verifiering av alla sidor i prod |
| OWASP ZAP i Docker | Snabb baseline scan utan installation |
| Security reviewer + manuella API-tester | Kompletterande: kodanalys + runtime-tester |
| Direkt SQL-fix pa prod (RLS-policy) | Ingen redeploy for database-niva ändringar |
| Backlogg i status.md | Pre-existerande fynd sparas utan att blockera sprint |

---

## Nasta steg

### Backlogg fran pentest (3 HIGH, pre-existerande)

| Item | Risk |
|------|------|
| Ta bort NextAuth `/api/auth/[...nextauth]` | Credential stuffing |
| Auth pa `/api/geocode` | Kostnadsinjektion |
| Granska user_metadata-anvandning | Privilege escalation |

### Sprint 16 (TBD)

Fokus att bestamma:
- Fixa pentest-backlogg (3 HIGH)
- iOS native auth-lansering
- Stripe live-mode
- Nya features

### Blockerare kvar

| Blocker | Paverkar |
|---------|---------|
| Apple Developer (99 USD) | Push live, App Store |
| Stripe foretagsverifiering | Live-betalningar |

---

## 5-dagars sammanfattning

| Dag | Fokus | Stories | Netto LOC |
|-----|-------|---------|-----------|
| 1 | Teamworkflow + produktfeatures | 21 | +10 975 |
| 2 | iOS-migrering + produktionshardning | 12 | +5 590 |
| 3 | Auth-migrering (NextAuth -> Supabase) | 16 | +6 819 |
| 4 | RLS live + bevistester | 6 | +2 300 |
| 5 | **Cutover till produktion** | 7 | +500 |
| **Totalt** | | **62 stories** | **~+26 184** |

**62 stories, ~342 commits, ~490 filer, ~26 000 rader netto.**
**Supabase Auth + RLS live i produktion med 0 downtime.**
**Uppskattad traditionell utvecklingstid: ~20-30 veckor (5-7 manader) pa 5 dagar.**
