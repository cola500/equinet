---
title: "S12-1: Supabase Auth login-sida"
description: "Ny login-sida med Supabase signInWithPassword bakom feature flag"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Sammanfattning
  - Filer som andras eller skapas
  - Approach
  - Risker
---

# S12-1: Supabase Auth login-sida

## Sammanfattning

Skapa en alternativ login-sida pa `/supabase-login` som anvander Supabase Auth
`signInWithPassword` istallet for NextAuth `signIn("credentials")`.
Bakom feature flag `supabase_auth_poc` -- flagga av = redirect till `/login`.
Befintlig NextAuth login pa `/login` ar helt oforandrad.

## Filer som andras eller skapas

| Fil | Andring |
|-----|---------|
| `src/app/(auth)/supabase-login/page.tsx` | **NY** -- Supabase Auth login-sida |
| `src/app/(auth)/supabase-login/page.test.tsx` | **NY** -- Tester |

Inga befintliga filer andras.

## Approach

### UI-design

Kopiera strukturen fran befintliga `/login` (Card, form, error states) men enklare:
- Inga retry-patterns (MVP)
- Inga demo-mode-checks
- Inget web-login pre-check (Supabase hanterar allt i ett steg)
- Samma visuella stil (Card + Input + Button)

### Auth-flode

1. Anvandare fyller i email + losenord
2. `supabase.auth.signInWithPassword({ email, password })` via browser client
3. Success -> `router.push("/dashboard")` + `router.refresh()`
4. Fel -> visa felmeddelandepa svenska

### Feature flag gate

Server Component wrapper kollar `supabase_auth_poc` flaggan:
- Flagga pa: rendera login-formularet
- Flagga av: redirect till `/login`

### Felhantering

| Supabase error | Meddelande |
|----------------|-----------|
| `invalid_credentials` | "Ogiltig email eller losenord" |
| `email_not_confirmed` | "Din e-post ar inte verifierad" + lank |
| Ovrigt | "Nagot gick fel. Forsok igen." |

### TDD (BDD dual-loop)

1. RED (integration): Testa hela sidan -- feature flag gate, form submission, felhantering
2. GREEN: Implementera
3. REVIEW: code-reviewer
4. VERIFY: typecheck + tester

## Risker

- **Lag**: Ny isolerad sida, ror inga befintliga filer
- **Feature flag**: `supabase_auth_poc` default false -- ingen anvandare ser sidan utan explicit toggle
- **Cookie-hantering**: Supabase browser client satter cookies automatiskt via `@supabase/ssr`. `getAuthUser()` i auth-dual.ts laser dessa cookies via server client. Bor fungera out-of-the-box.
