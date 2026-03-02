# Onboarding -- Kom igang med Equinet

Steg-for-steg guide for att satta upp utvecklingsmiljon.

---

## Forutsattningar

| Verktyg | Version | Installation |
|---------|---------|-------------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| Docker | Senaste | [docker.com](https://www.docker.com) |
| Git | Senaste | [git-scm.com](https://git-scm.com) |
| npm | Foljer med Node.js | -- |

---

## 1. Klona och installera

```bash
git clone <repo-url>
cd equinet
npm install
```

`npm install` kor automatiskt `prisma generate` via `postinstall`-scriptet.

---

## 2. Starta lokal databas

Projektet anvander Docker for en lokal PostgreSQL-databas.

```bash
npm run db:up
```

Detta startar en `postgres:17-alpine` container pa `localhost:5432`.

**Verifiering:**
```bash
docker ps  # Ska visa equinet-db (healthy)
```

---

## 3. Konfigurera miljovariabler

```bash
cp .env.example .env
```

Standard-vardena i `.env.example` ar redan konfigurerade for lokal utveckling med Docker-databasen. Du behover bara andra:

- **`NEXTAUTH_SECRET`**: Generera med `openssl rand -base64 32`

Ovriga variabler (Stripe, Resend, Fortnox, etc.) ar valfria for lokal utveckling -- funktioner degraderar gracefullt utan dem.

> **Viktigt:** `.env.local` trumfar `.env`. Om Vercel CLI har skapat `.env.local` med Supabase-credentials, ta bort den eller uppdatera `DATABASE_URL` dar ocksa.

---

## 4. Kor databasmigrationer

```bash
npx prisma migrate dev
```

Detta skapar alla tabeller och kor migrationer. Forsta gangen kan det ta nagra sekunder.

---

## 5. Seed-data (valfritt)

```bash
npm run db:seed
```

Skapar testdata (leverantorer, tjanster, hastar, bokningar) for att komma igang snabbare.

```bash
npm run db:seed:force  # Tvinga om-seedning (rensar befintlig data)
```

---

## 6. Starta dev-server

```bash
npm run dev
```

Oppen `http://localhost:3000` i din webblasare.

**Alternativa startkommandon:**

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Standard dev-server (SW avaktiverad) |
| `npm run dev:offline` | Dev med offline/PWA-stod |
| `npm run db:studio` | Prisma Studio (databas-UI pa port 5555) |

---

## 7. Kor tester

```bash
# Unit-tester
npm run test:run          # Kor alla tester en gang
npm test                  # Watch mode
npm run test:ui           # Vitest UI
npm run test:coverage     # Med coverage-rapport

# E2E-tester
npm run test:e2e          # Headless
npm run test:e2e:headed   # Med weblasarfonster
npm run test:e2e:ui       # Playwright UI mode
```

---

## 8. Typkontroll och lint

```bash
npm run typecheck   # TypeScript-kontroll (anvand INTE npx tsc --noEmit, risk for OOM)
npm run lint        # ESLint
```

---

## Vanliga problem

### Docker startar inte

```
Error: port 5432 already in use
```
En annan PostgreSQL-process kor pa port 5432. Stoppa den eller andra porten i `docker-compose.yml`.

### Prisma migrate failar

```
Error: P1001 Can't reach database server
```
Kontrollera att Docker-containern kor (`docker ps`) och att `DATABASE_URL` i `.env` pekar pa `localhost:5432`.

### "Module not found" efter install

Kor `prisma generate` manuellt:
```bash
npx prisma generate
```

### `.env.local` overrider `.env`

Next.js prioriterar `.env.local` over `.env`. Om du far konstiga databas-anslutningar, kontrollera att `.env.local` inte innehaller gamla Supabase-credentials.

### Tester failar med "table does not exist"

Kor migrationer:
```bash
npx prisma migrate dev
```

---

## Nyttiga kommandon

| Kommando | Beskrivning |
|----------|-------------|
| `npm run db:up` | Starta databas |
| `npm run db:down` | Stoppa databas |
| `npm run db:nuke` | Radera all data och borja om |
| `npm run db:studio` | Oppna Prisma Studio |
| `npm run env:status` | Visa aktiv databas |
| `npm run migrate:check` | Visa migrationsstatus |
| `npm run check:swedish` | Kontrollera svenska tecken |

---

## Nasta steg

- Las [CLAUDE.md](../../CLAUDE.md) for projektkonventioner och arbetsflode
- Las [docs/guides/gotchas.md](gotchas.md) for vanliga fallgropar
- Las [docs/INDEX.md](../INDEX.md) for en oversikt av all dokumentation

---

*Senast uppdaterad: 2026-02-28*
