---
title: Pre-commit Secret Scan & Seed Prod-Guard
description: Operativ guide för säkerhetsguarderna live på staging sedan 2026-05-19. assertSeedSafe() blockerar oavsiktlig seed mot hosted Supabase. scripts/check-no-secrets.sh blockerar secret-format-strängar i staged content.
category: security
status: active
last_updated: 2026-05-19
tags:
  - security
  - pre-commit
  - secret-scan
  - seed-guard
  - operations
related:
  - security-sprint-continuity-2026-05.md
  - remediation-backlog-fixes-txt-2026-05.md
sections:
  - Översikt
  - Seed prod-guard
  - Pre-commit secret-scan
  - Allow-mekanism
  - False-positive verifiering
  - GitHub push-protection lessons learned
  - Operativ guidance för utvecklare
  - Maturity-uppdatering
---

## Översikt

Två defense-in-depth-skydd live på `staging` sedan 2026-05-19 (commit `48c42728`, merge `58379d3f` via PR #340). Båda är operativa skydd som komplettar Sprint 3-A:s applikations-säkerhetsfixar med data-integritets- och commit-hygien-skydd.

| Skydd | Vad det stoppar | Var det körs |
|-------|-----------------|--------------|
| **`assertSeedSafe()`** | `prisma/seed.ts` mot hosted Supabase (skulle annars överskriva riktiga konton med `test123`) | Vid varje `npm run seed`-anrop |
| **`scripts/check-no-secrets.sh`** | Provider-keys, private keys, service_role JWTs, DB-credentials i staged content | Pre-commit hook via `.husky/pre-commit` |

## Seed prod-guard

### Vad `assertSeedSafe()` skyddar mot

`prisma/seed.ts` skapar och uppdaterar test-användare (Erik Järnfot m.fl.) med hårdkodade lösenord (`test123`). Om någon utvecklare har `DATABASE_URL` pekande på prod-Supabase och kör `npm run seed`:

- Befintliga riktiga användare med samma email skulle få sina lösenord överskrivna med `test123`
- Riktig kundata för matchande email-adresser skulle förvrängas
- Account takeover skulle kunna uppstå

`assertSeedSafe()` kontrollerar `DATABASE_URL` mot kända hosted-Supabase-mönster (innehåller `supabase.co`, `pooler.supabase.com`, etc.) och kastar `SeedRefusedError` om träff.

### Varför `ALLOW_SEED_PROD=true` krävs

Defaultbeteende är **fail-closed**. Om utvecklare har legitim anledning att köra seed mot hosted Supabase (t.ex. populera färsk staging-Supabase efter rebuild), krävs explicit override:

```bash
ALLOW_SEED_PROD=true npm run seed
```

Detta tvingar fram en medveten handling — inget "råkar köra" kan ske. Bypassen är synlig i `.bash_history` och kräver fingrarna att skriva flag:en, vilket ger en extra kognitiv barriär.

### Risk reducerad

| Före | Efter |
|------|-------|
| Felaktigt satt `DATABASE_URL` i shell → `npm run seed` → riktiga konton överskrivs tyst | `SeedRefusedError` med tydlig instruktion → ingen DB-skrivning sker |
| Hög risk vid utvecklarbyte / context-switch mellan miljöer | Låg risk — explicit-flagga krävs |

## Pre-commit secret-scan

### Vilka typer av secrets blockeras

Scannern (`scripts/check-no-secrets.sh`) körs som del av `.husky/pre-commit` och scannar **endast staged content** (`git diff --cached`) på added lines. Patterns valda för **high signal / low noise**:

| Kategori | Patterns |
|----------|----------|
| **Provider API-keys** | `sk-ant-…` (Anthropic), `sk-proj-…` / `sk-…` (OpenAI), `AIza…` (Google), `AKIA…` (AWS), `gh[pousr]_…` + `github_pat_…` (GitHub), `xox[baprs]-…` (Slack) |
| **Stripe** | `sk_live_…`, `rk_live_…`, `whsec_…`, `sk_test_…` |
| **Private keys** | `BEGIN RSA PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`, `BEGIN PRIVATE KEY`, `BEGIN EC PRIVATE KEY`, `BEGIN PGP PRIVATE KEY` |
| **Supabase service_role JWT** | `eyJ…`-format + base64-decode + payload-check på `"role":"service_role"` (inte bara format) |
| **DB connection strings** | `postgres://user:pass@host`, `mysql://`, `mongodb://`, `redis://` — utom `postgres:postgres@localhost\|127.0.0.1` för lokal dev |

Patterns kräver **både** prefix **och** minimum-längd för match. UUID-format som `a0000000-0000-4000-…` matchar **inget** mönster.

### Skip-list philosophy

Vissa filer förväntas innehålla pattern-shaped strängar och hoppas över automatiskt:

| Path-mönster | Skäl |
|--------------|------|
| `**/.env.example`, `**/*.example`, `**/*.template`, `**/*.sample` | Avsiktliga placeholder-värden |
| `scripts/check-no-secrets.{sh,test.ts}` | Scannerns egen testfil med fixture-strängar |
| `.husky/pre-commit` | Anropar scannern |
| `prisma/seed-guard.test.ts` | Innehåller pattern-strängar för guard-tester |
| `docs/**.md`, `.claude/**.md` | Dokumentation refererar patterns by name |

Skip-listan är **konservativ** — bara filer där pattern-shape är förväntad enligt designen. Inget "ignorera test-mappar generellt" eftersom test-fixturer kan smyga in legitima secrets.

## Allow-mekanism

För enskilda rader där en match är medveten (t.ex. en URL i dokumentation som råkar matcha JWT-format), använd suffix-markör på samma rad:

```typescript
const placeholder = "sk_live_…"  // secret-scan:allow this is a fixture (trunc.)
```

Scannern hoppar över rader som innehåller `secret-scan:allow`. Använd sparsamt och kommentera **varför**.

**Använd ALDRIG `secret-scan:allow` för riktiga secrets.** Markören är endast för:
- Test-fixturer (helst använd skip-list istället)
- Dokumentation som inkluderar patterns by name
- Verifierade public-keys (sällsynt)

Riktiga API-keys hör hemma i `.env` (gitignored), inte i committad kod oavsett markör.

## False-positive verifiering

### Smoke-test mot Sprint 3-A fixtures

Före merge till staging kördes direct pattern-grep mot 19 filer från Sprint 3-A + 3-A follow-up:

```
src/app/api/upload/*                  (C3 + 3B.3 + 3A.fu.4 + 3A.fu.3)
src/app/api/native/provider/upload/*  (3A.fu.4)
src/app/api/bookings/[id]/messages/*  (3A.fu.2)
src/app/api/device-tokens/*           (C4)
src/app/api/push-subscriptions/*      (C4)
src/domain/booking/BookingService.*   (C1, C2)
src/lib/{sanitize,supabase-storage,ghost-user}.*  (3A.fu.4 + C3 + C1)
```

**Resultat:** 0 träffar mot alla patterns. UUID-fixturer (`a0000000-0000-4000-a000-…`, `b0000000-0000-4000-b000-…`), Booking-IDs, mock push-tokens, MIME-strängar — inget matchar.

Pre-commit hook-simulering på en representativ fil (`upload/route.test.ts` med benign whitespace-diff) → scanner exit 0.

### Canary-test (sanity-check)

För att verifiera att scannern **faktiskt** flaggar riktiga secrets (inte bara är passiv) skapas en mock-fil med tre format-korrekta secrets:

```typescript
// Strängarna trunkerade i docs så GitHub push-protection inte triggar
// på själva dokumentationen. Faktiska canary använder full minimum-längd
// (>=20 chars efter prefix för Stripe-/OpenAI-mönster).
const KEY = "sk-ant-api03-…"
const PROJ = "sk-proj-…"
const STRIPE = "sk_live_…"
```

Stage-test:

```
[Anthropic API key] in tmp-canary/canary.ts
[OpenAI project key] in tmp-canary/canary.ts
[Stripe live secret] in tmp-canary/canary.ts
3 likely secret(s) found in staged content.
Exit code: 1
```

Scannern blockerar alla tre. Verifierar att passive-by-skip-list inte är hela beteendet.

## GitHub push-protection lessons learned

### Vad som hände

Vid push till `feature/security-hardening-seed-guard-and-secret-scan` (rebased commit `f3a58fac`) avvisade **GitHub:s egen secret-scanner** pushen pga `scripts/check-no-secrets.test.ts:177`:

```typescript
'const k = "sk_live_…" // secret-scan:allow test fixture (trunc.)\n'
```

Strängen är ett **uppenbart fake test-fixture** (alla A:n) men matchar Stripe live-key-format. GitHub-scanner gör inte semantisk analys — bara pattern-match.

### Varför vår egen scanner inte fångade det själv

Vår scanner kör mot **staged content** vid pre-commit. Test-fixturen är i scriptets egen test-fil, som är på **skip-listan**. Vår scanner respekterade skip-listan. GitHub:s scanner gör det inte — den scannar all diff utan undantag.

Det är **två komplementära lager:**
- **Vår pre-commit** stoppar secrets innan de når git-historiken (egen kontroll, snabb feedback, override-mekanism)
- **GitHub push-protection** stoppar secrets från att nå remote (centralt, ingen override per default)

### Lösning: runtime string assembly

Fix:en var att splitta prefix i källfilen så GitHub-scanner inte matchar mönstret:

```typescript
// Före (GitHub blockerade):
stageFile(r, "bad.ts", 'const k = "sk_live_…"\n')  // suffix trunc. in docs

// Efter:
stageFile(r, "bad.ts", 'const k = "sk_' + 'live_AAAAAAAAAAAAAAAAAAAAAAAA"\n')
```

Vid **runtime** är strängarna identiska — JavaScript concat:ar `'sk_' + 'live_…'` till `'sk_live_…'` innan den stagas till `bad.ts` i tmpdir. Vår scanner ser sedan den fulla strängen i `bad.ts` och flaggar korrekt.

**Källfilen** (`check-no-secrets.test.ts`) innehåller dock aldrig `"sk_live_…"` som intakt prefix-string → GitHub:s pattern-scanner triggar inte.

### Varför detta fortfarande verifierar scannern korrekt

Scanner-testet verifierar **scannerns beteende mot staged file content**, inte mot scriptets egen test-källkod. Eftersom `stageFile()` skriver den fullt sammansatta strängen till en tmpfil och scannern sedan kör mot den tmpfilen, är scanner-pathen identisk:

| Steg | Före fix | Efter fix |
|------|----------|-----------|
| Test-källkod innehåller | `"sk_live_AAAA..."` | `'sk_' + 'live_AAAA...'` |
| Runtime-sträng som skrivs till `bad.ts` | `sk_live_AAAA...` | `sk_live_AAAA...` (identisk) |
| Vad scannern ser | `sk_live_AAAA...` | `sk_live_AAAA...` (identisk) |
| Test passerar | ✓ | ✓ |
| GitHub push-protection triggar | ❌ blockerar | ✓ släpper igenom |

Sju fixturer i scriptets testfil splittades på samma sätt (rad 76, 84, 92, 100, 108, 168, 178).

## Operativ guidance för utvecklare

### Pre-commit blockerade min commit. Vad gör jag?

1. **Läs scanner-output noga.** Den visar fil + rad + label (vilken pattern som triggade).
2. **Verifiera om det är en riktig secret.**
   - **Ja** → flytta till `.env` (gitignored), commit utan secret-värdet. Använd referens via `process.env.VAR_NAME`.
   - **Nej, det är en placeholder/fixture** → fortsätt till nästa steg.
3. **Om placeholder/fixture:**
   - **Bör filen vara på skip-listan?** (t.ex. en ny `.template`-fil) — diskutera med tech-lead innan utökning av skip-listan.
   - **Är det en testfixture som måste ha riktig pattern-format?** Använd `secret-scan:allow`-markör på samma rad med tydlig kommentar om varför.
   - **Är det en hard-coded sträng som ändå borde vara i env?** Refaktorera, även om den är "bara test".

### Mitt PR avvisades av GitHub push-protection efter att jag passerade pre-commit. Varför?

Vår pre-commit respekterar skip-listan; GitHub:s gör det inte. Om en fil är skip-listad men ändå innehåller match-bar pattern (t.ex. en testfixture i en testfil för scannern själv), måste pattern-strängen brytas i källfilen så GitHub-scanner inte matchar.

Använd **runtime string assembly**:
```typescript
const fixture = 'sk_' + 'live_PLACEHOLDER...'
```

Eller URL-encoding/escape-sekvenser där det är acceptabelt. **Aldrig** klicka allow-URL för riktiga secrets — GitHub:s scanner är sista linjen.

### Hur lägger jag medvetet allowlistar test-fixtures?

För enskilda rader: använd `secret-scan:allow`-suffix. För hela filer: lägg till i `SKIP_REGEX` i `scripts/check-no-secrets.sh` (kräver review — diskutera först).

**Test-fixturer som måste se ut som riktiga secrets:**
- Använd skip-list för filen om den är dedikerad till sådana tester
- Annars: runtime-concat + `secret-scan:allow`-markör
- Använd alla-A-mönster (`AAAAAAAA...`) snarare än slumpmässiga tecken för att tydliggöra fixture-status

### Riktiga secrets ska aldrig allowlistas

**Regel:** Om en commit-blockering känns som ett hinder mot en riktig API-key — STOPP och fixa rotorsaken (`.env`, secrets manager, deploy-time injection). Använd aldrig `secret-scan:allow` för att kringgå skydd mot riktiga secrets.

Allowlistade riktiga secrets är en av de vanligaste vägarna in i incidenter:
1. Utvecklare lägger `secret-scan:allow` "tillfälligt"
2. Glömmer bort
3. Riktig secret når git-historiken
4. Roteras inte
5. Branch glöms bort → secret finns kvar för alltid i historiken
6. Repo blir publikt eller delat → läckage

## Maturity-uppdatering

### Staging security posture (efter 2026-05-19)

| Kategori | Status | Skydd |
|----------|--------|-------|
| **CRITICAL exploit-paths** | ✅ stängda | Sprint 3-A (C1-C4) live |
| **Defense-in-depth uploads** | ✅ stängda | Sprint 3-A follow-up (3A.fu.1-4) live |
| **Data-integritet vid seed** | ✅ skyddad | `assertSeedSafe()` live |
| **Secret-läckage vid commit** | ✅ skyddad | Pre-commit secret-scan live |
| **Demo-bypass-ytor** | ✅ stängda | Slice 1+2 live |
| **AI cost-control** | ⏸ kvar | Sprint 3-D pending |
| **HIGH fixes.txt-fynd (H1-H10)** | ⏸ kvar | Sprint 3-B + 3-C pending |

### Security hygiene improvements

- **Två-lagers secret-skydd** — vår pre-commit scanner (med override-mekanism för fixturer) + GitHub:s push-protection (utan override). Defense-in-depth även på commit-vägen.
- **Fail-closed seed-flöde** — explicit override krävs för att köra seed mot hosted Supabase.
- **Operational documentation** — denna fil. Tydliggör hur skydden ska underhållas.

### Production status

**Main/prod är fortfarande oberörda.** Inga säkerhetsfixar mergade till `main`, ingen prod-deploy utfärdad. Staging är säkrad testbädd för verifiering före prod-merge.

`staging → main` merge är en separat beslut som inte är aktuell utan:
1. OWASP ZAP regression mot staging
2. Manuell verifiering (admin flow, MFA timeout, Stripe live-test)
3. Sprint 3-B (H1-H10 från fixes.txt)
4. Pre-prod-hardening checklista
