# Equinet - Bokningsplattform för Hästtjänster

Equinet är en modern bokningsplattform som kopplar samman hästägare med tjänsteleverantörer som hovslagare, veterinärer och andra hästspecialister.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.17 eller senare
- **npm**: v9 eller senare
- **Git**: För version control

### Initial Setup

1. **Klona projektet**
   ```bash
   git clone <repository-url>
   cd equinet
   ```

2. **Installera beroenden**
   ```bash
   npm install
   ```

3. **Sätt upp environment variables**
   ```bash
   # Kopiera example-fil till .env
   cp .env.example .env

   # Generera NEXTAUTH_SECRET
   openssl rand -base64 32

   # Öppna .env och ersätt your-secret-here-min-32-chars med genererat värde
   ```

   **Viktiga environment variables:**
   - `DATABASE_URL`: PostgreSQL connection string (Supabase)
   - `NEXTAUTH_SECRET`: Secret för NextAuth (generera med kommandot ovan)
   - `NEXTAUTH_URL`: App URL (default: `http://localhost:3000`)

   > **Supabase Setup:** Skapa ett gratis projekt på [supabase.com](https://supabase.com),
   > gå till Project Settings → Database → Connection string → Session Pooler (IPv4).

4. **Skapa och seeda databasen**
   ```bash
   # Skapa databas från schema
   npx prisma db push

   # Seeda med testdata (valfritt för utveckling)
   npx tsx prisma/seed-test-users.ts
   ```

5. **Starta utvecklingsservern**
   ```bash
   npm run dev
   ```

   Öppna [http://localhost:3000](http://localhost:3000) i din browser.

6. **Verifiera installation**
   ```bash
   # Kör tester för att säkerställa allt fungerar
   npm run test:run        # Unit tests
   npm run test:e2e        # E2E tests (kräver seedat data)
   npx tsc --noEmit        # TypeScript check
   ```

### Snabbstart (om du redan har setup)

```bash
npm run dev              # Starta utvecklingsserver
```

**Stoppa server:** `Ctrl + C`

### Testanvändare (efter seeding)

- **Kund**: test@example.com / TestPassword123!
- **Provider**: provider@example.com / ProviderPass123!

## 📋 Viktiga Kommandon

Se `package.json` för alla tillgängliga scripts. De vanligaste:

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Utvecklingsserver (port 3000) |
| `npm run db:studio` | Prisma Studio för databasinspektering |
| `npm run db:reset` | Återställ databas ⚠️ Raderar all data! |
| `npm test` | Unit/integration tester (watch mode) |
| `npm run test:e2e` | E2E-tester med Playwright |
| `npm run test:coverage` | Coverage report |

## 🔒 Branch Protection & Quality Gates

Main-branchen är skyddad med automatiserade quality gates för att säkerställa kodkvalitet:

**Required Checks (måste passa innan merge):**
- ✅ Unit Tests & Coverage
- ✅ E2E Tests
- ✅ TypeScript Check
- ✅ Build Check

**Workflow:**
1. Skapa feature branch från main
2. Gör dina ändringar och commits
3. Push till remote och skapa Pull Request
4. CI kör alla checks automatiskt
5. Merge är blockerad tills alla checks är gröna
6. När checks passar → merge till main

Detta säkerställer att broken code aldrig når main-branchen! 🎯

## 🛠️ Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **Språk**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI**: shadcn/ui + Radix UI
- **Databas**: PostgreSQL (Supabase) via Prisma ORM
- **Autentisering**: NextAuth.js v5
- **Validering**: Zod + React Hook Form
- **Testning**: Vitest (326 unit/integration) + Playwright (62 E2E) = 70% coverage
- **CI/CD**: GitHub Actions (quality gates, E2E tests)
- **Säkerhet**: bcrypt, Upstash Redis rate limiting, input sanitization, Sentry monitoring

## 📁 Projektstruktur

```
equinet/
├── prisma/
│   ├── schema.prisma          # Databasschema (source of truth)
│   └── seed-test-users.ts     # Testdata seeding script
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # Login, registrering
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # NextAuth & registrering
│   │   │   ├── bookings/     # Boknings-API
│   │   │   ├── providers/    # Leverantörs-API
│   │   │   │   └── [id]/availability/  # Tillgänglighetskontroll
│   │   │   ├── services/     # Tjänste-API
│   │   │   ├── route-orders/ # Rutt-beställningar API
│   │   │   └── routes/       # Rutt-planering API
│   │   ├── customer/         # Kundsidor (dashboard, bookings, profile)
│   │   ├── provider/         # Leverantörssidor (dashboard, services, bookings, routes)
│   │   └── providers/        # Publika leverantörssidor
│   ├── components/
│   │   ├── layout/           # Header, navigation, layouts
│   │   ├── provider/         # Provider-specifika komponenter
│   │   └── ui/               # shadcn/ui komponenter
│   ├── hooks/
│   │   └── useAuth.ts        # Custom auth hook
│   ├── lib/
│   │   ├── auth.ts           # NextAuth konfiguration
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── rate-limit.ts     # Rate limiting
│   │   ├── sanitize.ts       # Input sanitization
│   │   └── validations/      # Delade Zod-schemas
│   └── types/
└── .env                      # Environment variables (NOT committed)
```

## 👥 Användarroller

### 🐴 Kunder (Hästägare)
- Bläddra och filtrera leverantörer
- Boka tjänster med datum, tid och hästinformation
- Hantera bokningar (visa, avboka)
- **Flexibla rutt-beställningar**: Boka utan fast tid, ange datum-spann, markera som akut

### 🔨 Tjänsteleverantörer
- Dashboard med statistik och onboarding
- Hantera tjänster (CRUD, aktivera/inaktivera)
- Öppettider per veckodag
- Bokningshantering (acceptera, avvisa, markera klara)
- **Rutt-planering**: Skapa optimerade rutter från flexibla beställningar, köra stopp-för-stopp

## 🗄️ Databasschema

**Huvudmodeller:**
- **User** - Användarkonton (kunder + leverantörer)
- **Provider** - Leverantörsprofiler med företagsinformation
- **Service** - Tjänster som leverantörer erbjuder
- **Availability** - Öppettider per veckodag
- **Booking** - Traditionella bokningar med fast tid
- **RouteOrder** - Flexibla beställningar utan fast tid
- **Route** - Leverantörers planerade rutter
- **RouteStop** - Enskilda stopp i en rutt

Se `prisma/schema.prisma` för fullständig definition.

## ✨ Implementerade Funktioner

### Autentisering
- Registrering med rollval (kund/leverantör)
- Lösenordsstyrkeindikator med real-time feedback
- Session-baserad autentisering
- Rollbaserad access control

### Leverantörsfunktioner
- Dashboard med statistik och onboarding-checklista
- Tjänstehantering (CRUD)
- Öppettider & tillgänglighetskontroll
- Bokningshantering med filter och automatisk tab-växling
- Profilkompletteringsindikator
- **Rutt-planering**:
  - Visa tillgängliga flexibla beställningar sorterade efter avstånd
  - Skapa optimerade rutter (Haversine + Nearest Neighbor)
  - Köra rutter stopp-för-stopp med statusuppdateringar
  - Automatisk ETA-beräkning

### Kundfunktioner
- Leverantörsgalleri med sökning och filtrera
- Traditionella bokningar med tillgänglighetskontroll
- Flexibla rutt-beställningar (datum-spann, prioritet)
- Avboka bokningar
- Kundprofil

### UI/UX
- Responsiv design
- Svenska lokaliseringen (datum, språk)
- Toast-notifikationer
- Loading states, error handling med retry-funktionalitet
- Onboarding-flöden och kontextuella empty states
- Bekräftelsedialoger för kritiska operationer

### Säkerhet
- bcrypt password hashing
- HTTP-only cookies, CSRF protection
- SQL injection-skydd (Prisma)
- XSS protection (React + input sanitization)
- Rate limiting (login, registrering, bokningar, etc.)
- Strukturerad logging med security events
- Environment validation

## 🧪 Testning

**162+ tester** (35 E2E + 127 unit/integration) med **70% coverage**.

### Kör Tester

```bash
# Unit/Integration (Vitest)
npm test                  # Watch mode
npm run test:ui           # Visuellt interface
npm run test:coverage     # Med coverage

# E2E (Playwright)
npx tsx prisma/seed-test-users.ts  # Skapa testanvändare först
npm run test:e2e          # Kör E2E-tester
npm run test:e2e:ui       # Playwright UI (bäst för utveckling)
```

**Testanvändare:**
- Kund: `test@example.com` / `TestPassword123!`
- Leverantör: `provider@example.com` / `ProviderPass123!`

### Test Coverage

- **Unit Tests (52)**: sanitize, booking utils, hooks
- **Integration Tests (75)**: API routes (auth, bookings, services, providers, routes)
- **E2E Tests (35)**: Authentication, booking flow, provider flow, route planning

Se `e2e/README.md` och individuella `.test.ts` filer för detaljer.

## 🧭 Testa Appen Manuellt

**Snabb guide:**

1. **Registrera leverantör** → Lägg till tjänster → Sätt öppettider
2. **Registrera kund** → Bläddra leverantörer → Gör bokning
3. **Logga in som leverantör** → Acceptera bokning → Markera som klar
4. **Verifiera som kund** → Se uppdaterad status

Se längre guide i [CLAUDE.md](./CLAUDE.md) för steg-för-steg instruktioner.

## 🐛 Felsökning

### Port upptagen
```bash
lsof -ti:3000 | xargs kill -9
# eller
npm run dev -- -p 3001
```

### Databasfel
```bash
npm run db:reset && npm run setup
```

### TypeScript-fel
```bash
npx prisma generate
# Starta om TS server i VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Stale cache
```bash
rm -rf .next && npm run dev
```

## 🚀 Deploy till Produktion (Vercel + Supabase)

### Aktuell Infrastruktur

Equinet är konfigurerat för deployment med:
- **Hosting**: Vercel (Next.js)
- **Databas**: Supabase (PostgreSQL)

### Steg-för-steg Deployment

1. **Skapa Supabase-projekt**
   - Gå till [supabase.com](https://supabase.com) och skapa ett nytt projekt
   - Kopiera connection string: Project Settings → Database → Connection string → Session Pooler (IPv4)

2. **Anslut till Vercel**
   - Importera repo på [vercel.com](https://vercel.com)
   - Lägg till environment variables:
     ```
     DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres
     NEXTAUTH_SECRET=[generera med: openssl rand -base64 32]
     NEXTAUTH_URL=https://din-app.vercel.app
     ```

3. **Deploya**
   - Vercel kör automatiskt `prisma generate` och `next build`
   - Databas-schemat pushas automatiskt vid första deployment

### Viktigt om Connection String

Använd **Session Pooler (IPv4)** från Supabase, inte Direct Connection:
- Session Pooler fungerar med serverless (Vercel)
- Direct Connection kräver IPv6 eller Vercel-integration

### Säkerhetskrav för Produktion
- [x] Stark `NEXTAUTH_SECRET` (≥32 bytes, generera med `openssl rand -base64 32`)
- [x] HTTPS aktiverat (automatiskt på Vercel)
- [x] Redis-baserad rate limiting (Upstash) - **implementerad**
- [x] Error monitoring (Sentry) - **implementerad**
- [ ] Supabase Row Level Security (RLS) - valfritt extra skydd

Se [NFR.md](./NFR.md) för fullständiga Non-Functional Requirements.

## 📚 Dokumentation

### Huvuddokument
- **README.md** (denna fil) - Vad som är byggt, setup, testning
- **[CLAUDE.md](./CLAUDE.md)** - Utvecklingsguide, arbetsprocesser, patterns
- **[NFR.md](./NFR.md)** - Non-Functional Requirements (säkerhet, performance, etc.)

### Guider & Referens
- **[docs/GOTCHAS.md](./docs/GOTCHAS.md)** - Vanliga problem och lösningar
- **[docs/AGENTS.md](./docs/AGENTS.md)** - Agent-team guide för Claude Code
- **[docs/PRODUCTION-DEPLOYMENT.md](./docs/PRODUCTION-DEPLOYMENT.md)** - Komplett deployment-guide

### Säkerhet & Retrospectives
- **[docs/SECURITY-REVIEW-2026-01-21.md](./docs/SECURITY-REVIEW-2026-01-21.md)** - Senaste säkerhetsgranskning
- **[docs/retrospectives/](./docs/retrospectives/)** - Sprint retrospectives
- **[docs/sprints/](./docs/sprints/)** - Sprint-planer och historik

### Features
- **[features/rutt-baserad-levering.md](./features/rutt-baserad-levering.md)** - Fullständig feature-spec för rutt-funktionen

## 🔮 Roadmap

### ✅ v1.3.0 - UX Quick Wins (Sprint 1 pågår)
- ✅ Förbättrad lösenordsvalidering (F-3.1)
- ✅ Försök igen-knappar (F-3.3)
- ✅ Performance-optimering provider loading (F-3.4)
- 🚧 Onboarding Checklist (F-3.4) - återstår

### 🚧 Nästa (Fas 2-5)
- **Kartvy** - Visa beställningar och rutter på karta
- **Realtidsspårning** - Leverantörens position och ETA-uppdateringar
- **Notifikationer** - Push/Email/SMS för kunder
- **Problemhantering** - Rapportera problem, omberäkna rutter
- **Rutthistorik & Analytics** - Statistik och intelligent förslag

Se `features/rutt-baserad-levering.md` för detaljerad roadmap.

### Framtida Features (Prioritet 2-3)
- Email-notifikationer vid bokningar
- Bilduppladdning (profiler, tjänster)
- Betalningsintegration (Stripe/Klarna)
- Recensioner & betyg
- Google Calendar-synk
- Mobilapp (React Native)

---

**Skapad**: November 2025
**Version**: 1.3.0 MVP - Performance & UX
**Utvecklad med**: Next.js 15.5, TypeScript, Tailwind CSS, Claude Code 💚
