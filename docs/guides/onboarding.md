---
title: "Onboarding -- Kom igång med Equinet"
description: "Steg-för-steg guide för att sätta upp utvecklingsmiljön: Supabase CLI, migrationer, seed och tester"
category: guide
tags: [onboarding, setup, supabase, prisma, testing]
status: active
last_updated: 2026-06-11
related:
  - gotchas.md
  - ../operations/environments.md
  - ../INDEX.md
  - ../../CLAUDE.md
sections:
  - Förutsättningar
  - 1. Klona och installera
  - 2. Konfigurera miljövariabler
  - 3. Starta lokal Supabase-stack
  - 4. Kör migrationer och auth-triggers
  - 5. Seed-data
  - 6. Starta dev-server
  - 7. Kör tester
  - 8. Typkontroll och kvalitetsgates
  - Vanliga problem
  - Nyttiga kommandon
  - Nästa steg
---

# Onboarding -- Kom igång med Equinet

Steg-för-steg guide för att sätta upp utvecklingsmiljön. Lokal stack är
**Supabase CLI** (PostgreSQL + Auth + RLS lokalt) -- inte ren Docker Compose.

---

## Förutsättningar

| Verktyg | Version | Installation |
|---------|---------|-------------|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org) |
| npm | >= 10 | Följer med Node.js |
| Docker Desktop | Senaste | [docker.com](https://www.docker.com) (krävs av Supabase CLI) |
| Supabase CLI | Senaste | `brew install supabase/tap/supabase` |
| Git | Senaste | [git-scm.com](https://git-scm.com) |

VS Code rekommenderas, med extensions: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense.

---

## 1. Klona och installera

```bash
git clone <repo-url>
cd equinet
npm install
```

`npm install` kör automatiskt `prisma generate` via `postinstall`-scriptet.

---

## 2. Konfigurera miljövariabler

```bash
cp .env.example .env
```

Standardvärdena i `.env.example` pekar redan på den lokala Supabase-stacken
(databas på port 54322, API på 54321) med standardnycklar -- **inga ändringar krävs**
för lokal utveckling.

Externa tjänster (Resend, Upstash, Stripe, Sentry, Anthropic) är valfria lokalt --
funktionerna degraderar snällt: e-post loggas till konsolen, rate limiting kör
in-memory och betalningar använder mock-gateway.

> **Viktigt:** `.env.local` trumfar `.env`. Om Vercel CLI har skapat `.env.local`
> med remote-credentials -- kommentera bort dem. Se [gotchas.md #23](gotchas.md).
> Verifiera aktiv databas med `npm run env:status`.

---

## 3. Starta lokal Supabase-stack

```bash
npm run db:up      # supabase start
```

Detta startar PostgreSQL (`127.0.0.1:54322`), Supabase Auth och Studio lokalt
via Docker. Auth är **Supabase Auth** -- ingen `NEXTAUTH_SECRET` behövs.

**Verifiering:**
```bash
npm run db:status   # supabase status -- visar URL:er och nycklar
```

---

## 4. Kör migrationer och auth-triggers

```bash
npm run setup
```

Kör `prisma generate` + `prisma migrate deploy` + installerar auth-triggers
(`supabase/auth-triggers.sql`). Första gången tar det några sekunder.

---

## 5. Seed-data

```bash
npm run db:seed
```

Skapar testdata (leverantörer, tjänster, hästar, bokningar).

**Testanvändare efter seedning:**

| Roll | E-post | Lösenord |
|------|--------|----------|
| Kund | `test@example.com` | `TestPassword123!` |
| Leverantör | `provider@example.com` | `ProviderPass123!` |

```bash
npm run db:seed:force            # Tvinga om-seedning (rensar befintlig data)
npm run db:seed:demo-provider    # Demo-personan Erik Järnfot (för demo-läge/Dagens rutt)
```

Se [docs/operations/demo-setup.md](../operations/demo-setup.md) för demo-data-detaljer.

---

## 6. Starta dev-server

```bash
npm run dev
```

Öppna `http://localhost:3000` i din webbläsare.

**Alternativa startkommandon:**

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Standard dev-server (Service Worker avaktiverad) |
| `npm run dev:offline` | Dev med offline/PWA-stöd (webpack) |
| `npm run db:studio` | Prisma Studio (databas-UI på port 5555) |

---

## 7. Kör tester

```bash
# Unit-tester
npm run test:run          # Kör alla tester en gång
npm test                  # Watch mode
npm run test:ui           # Vitest UI
npm run test:coverage     # Med coverage-rapport

# E2E-tester (kräver seedat data -- kör npm run test:e2e:bootstrap först)
npm run test:e2e          # Headless
npm run test:e2e:smoke    # Snabb smoke (auth + baseline)
npm run test:e2e:ui       # Playwright UI mode
```

---

## 8. Typkontroll och kvalitetsgates

```bash
npm run typecheck   # TypeScript (använd INTE npx tsc --noEmit -- risk för OOM)
npm run lint        # ESLint
npm run check:all   # Alla 4 gates: svenska-check + tester + typecheck + lint
```

`check:all` måste vara grön innan PR -- pre-push-hooken kör samma kontroller.

---

## Vanliga problem

### Supabase startar inte / port upptagen

```
Error: port 54322 already in use
```
En gammal Supabase-stack kör fortfarande. Kör `npm run db:down` (eller
`supabase stop`) och starta om. Kontrollera även att Docker Desktop kör.

### Prisma migrate failar

```
Error: P1001 Can't reach database server
```
Kontrollera att stacken kör (`npm run db:status`) och att `DATABASE_URL` i `.env`
pekar på `127.0.0.1:54322`.

### "Module not found" efter install

Kör `prisma generate` manuellt:
```bash
npx prisma generate
```

### `.env.local` överrider `.env`

Next.js prioriterar `.env.local` över `.env`. Om du får konstiga
databasanslutningar: kontrollera att `.env.local` inte innehåller
remote-credentials. `npm run env:status` visar vad som faktiskt är aktivt.

### Tester failar med "table does not exist"

Kör migrationerna:
```bash
npm run setup
```

---

## Nyttiga kommandon

| Kommando | Beskrivning |
|----------|-------------|
| `npm run db:up` / `db:down` | Starta/stoppa lokal Supabase (data bevaras) |
| `npm run db:nuke` | Återställ databasen från scratch (`supabase db reset`) |
| `npm run db:status` | Supabase-status (URL:er, nycklar) |
| `npm run env:status` | Visa aktiv databas (lokal/remote) |
| `npm run db:studio` | Öppna Prisma Studio |
| `npm run migrate:status` | Migrationsstatus lokalt vs Supabase |
| `npm run check:swedish` | Kontrollera svenska tecken |

---

## Nästa steg

- Läs [CLAUDE.md](../../CLAUDE.md) för projektkonventioner och arbetsflöde
- Läs [docs/guides/gotchas.md](gotchas.md) för vanliga fallgropar
- Läs [docs/operations/environments.md](../operations/environments.md) för lokal/staging/prod-skillnader
- Läs [docs/INDEX.md](../INDEX.md) för en översikt av all dokumentation
