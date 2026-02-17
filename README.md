# Equinet - Bokningsplattform för Hästtjänster

Equinet är en modern bokningsplattform som kopplar samman hästägare med tjänsteleverantörer som hovslagare, veterinärer och andra hästspecialister.

## Getting Started

### Prerequisites

- **Node.js**: v20 eller senare
- **npm**: v10 eller senare
- **Docker Desktop**: För lokal PostgreSQL (rekommenderat)
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
   - `DATABASE_URL`: PostgreSQL connection string (lokal Docker eller Supabase)
   - `NEXTAUTH_SECRET`: Secret för NextAuth (generera med kommandot ovan)
   - `NEXTAUTH_URL`: App URL (default: `http://localhost:3000`)

   > `.env.example` har lokal Docker-DB som default. För Supabase: avkommentera alternativ 2.

4. **Starta lokal databas och seeda**
   ```bash
   # Starta PostgreSQL i Docker
   npm run db:up

   # Kör migrationer + generera Prisma Client
   npm run setup

   # Seeda med testdata
   npm run db:seed
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
   npm run typecheck       # TypeScript check
   ```

### Snabbstart (om du redan har setup)

```bash
npm run dev              # Starta utvecklingsserver
```

**Stoppa server:** `Ctrl + C`

### Testanvändare (efter seeding)

- **Kund**: test@example.com / TestPassword123!
- **Provider**: provider@example.com / ProviderPass123!

## Viktiga Kommandon

Se `package.json` för alla tillgängliga scripts. De vanligaste:

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Utvecklingsserver (port 3000) |
| `npm run db:up` | Starta lokal PostgreSQL (Docker) |
| `npm run db:down` | Stoppa lokal PostgreSQL (data bevaras) |
| `npm run db:nuke` | Radera lokal databas helt |
| `npm run db:studio` | Prisma Studio för databasinspektering |
| `npm run db:reset` | Återställ databas (raderar all data!) |
| `npm run db:backup` | Backup av Supabase-data (kräver Docker) |
| `npm run db:restore` | Återställ backup till lokal databas |
| `npm run db:drift-check` | Jämför lokala migrationer med Supabase |
| `npm test` | Unit/integration tester (watch mode) |
| `npm run test:e2e` | E2E-tester med Playwright |
| `npm run test:coverage` | Coverage report |
| `npm run deploy` | Kvalitetscheckar + drift-check + auto-backup + push |

## Quality Gates

Automatiserade quality gates säkerställer kodkvalitet:

**Lokal Gate (Husky pre-push hook):**
- Swedish character check (`npm run check:swedish`)
- Unit tests (`npm run test:run`)
- TypeScript check (`npm run typecheck`)
- Lint check (`npm run lint`)

**CI Gate (GitHub Actions):**
- Unit Tests & Coverage
- E2E Tests
- TypeScript Check
- Build Check

> **Note:** Branch protection är inaktiverat under MVP-fasen. Quality gates körs fortfarande men blockerar inte merge.

## Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **Språk**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI**: shadcn/ui + Radix UI
- **Databas**: PostgreSQL (Supabase) via Prisma ORM
- **Autentisering**: NextAuth.js v5
- **Validering**: Zod + React Hook Form
- **Testning**: Vitest (1800+ unit/integration) + Playwright (115+ E2E desktop, 82+ mobil) = 70% coverage
- **CI/CD**: GitHub Actions (quality gates, E2E tests)
- **Caching/Flaggor**: Upstash Redis (feature flags, rate limiting)
- **Grafer**: Recharts (dashboard- och insiktsgrafer)
- **Arkitektur**: DDD-Light med Repository Pattern
- **Säkerhet**: bcrypt, Upstash Redis rate limiting, input sanitization, Sentry monitoring

## Projektstruktur

```
equinet/
├── prisma/                   # Databasschema & migrationer
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # Login, registrering
│   │   ├── api/              # API routes (auth, bookings, horses, providers, ...)
│   │   ├── admin/            # Admin-sidor
│   │   ├── customer/         # Kundsidor
│   │   └── provider/         # Leverantörssidor
│   ├── components/           # React-komponenter (layout, provider, review, ui)
│   ├── domain/               # Affärslogik (booking, group-booking, notification, payment, reminder)
│   ├── infrastructure/       # Repositories (Prisma-implementationer)
│   ├── hooks/                # Custom hooks (useAuth, useNotifications)
│   ├── lib/                  # Utilities (auth, email, prisma, rate-limit, validations)
│   └── types/                # TypeScript-typer
└── e2e/                      # E2E-tester (Playwright)
```

## Arkitektur

Equinet använder **DDD-Light** - en pragmatisk approach till Domain-Driven Design.

### Lagerstruktur

```
src/
├── app/api/          # API Routes (HTTP-hantering)
├── domain/           # Affärslogik, entiteter, value objects
├── infrastructure/   # Repositories, externa tjänster
└── lib/              # Utilities utan affärslogik
```

### Repository Pattern

Kärndomäner (Booking, Provider, Service) använder repository pattern:

- **IBookingRepository** - Interface för bokningsoperationer
- **PrismaBookingRepository** - Prisma-implementation
- **MockBookingRepository** - In-memory för tester

**Säkerhet:** Alla auth-aware metoder använder atomära WHERE-klausuler för IDOR-prevention.

Se [CLAUDE.md](./CLAUDE.md) för fullständiga arkitekturriktlinjer.

## Databasschema

**25 tabeller** -- se `prisma/schema.prisma` för fullständig definition och [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md) för arkitekturbeskrivning.

**Kärnmodeller:**
- **User** - Användarkonton (kunder + leverantörer + admin)
- **Provider** - Leverantörsprofiler med företagsinformation och verifieringsstatus
- **Booking** - Bokningar med fast tid (kan kopplas till Horse)
- **Horse** - Hästregister med namn, ras, födelseår, kön, UELN, mikrochip, specialbehov
- **RouteOrder** - Flexibla beställningar utan fast tid
- **Review / CustomerReview** - Recensioner i båda riktningar
- **ProviderCustomerNote** - Leverantörens privata kundanteckningar
- **ProviderCustomer** - Manuellt registrerade kunder

## Implementerade Funktioner

### Kärnfunktioner
- Autentisering (rollval, email-verifiering, sessions)
- Bokning (fast tid + flexibla beställningar, mobil-först med stegvis Drawer, självservice-ombokning)
- Leverantörshantering (profil, tjänster, öppettider, kalender)
- Hästregister med hälsotidslinje och delbar hästprofil (UELN + mikrochip)
- Mobil-först UI med responsiva dialoger, 44px touch targets och stegvist bokningsflöde

### Leverantörsverktyg
- Ruttplanering med kartvy och optimering
- Kundregister med manuell kundregistrering och privata anteckningar (CRUD)
- Besöksplanering ("Dags för besök") med statusbadges
- Kompetenser och verifiering (admin-granskning)
- Stäng för nya kunder (befintliga kunder kan fortfarande boka)
- Ombokningsinställningar (tillåt/neka, tidsfönster, max antal, kräv godkännande)
- Återkommande bokningar (serier med intervall, feature flag-skyddad)
- Kundrecensioner (leverantör betygsätter kund, 1-5 stjärnor)
- Röstloggning / arbetslogg (diktera eller skriv, AI tolkar och mappar till bokningar)
- No-show-spårning (markera ej infunnit, kundvarningar vid 2+)
- AI-drivna kundinsikter (frekvens, VIP-score, riskflaggor)
- Dashboard med trendgrafer och onboarding-checklista
- Affärsinsikter (populära tjänster, tidsanalys, kundretention)

### Admin-gränssnitt
- Dashboard med KPI-kort (användare, bokningar, leverantörer, intäkter)
- Användarhantering (sök, filtrera, blockera, ge admin-rättigheter)
- Bokningshantering (lista, avboka med admin-anledning)
- Recensionsmoderation (granska, ta bort)
- Verifieringsgranskning (godkänn/avvisa med kommentar)
- Bulk-notifikationer (till alla/kunder/leverantörer)
- Systeminställningar (e-post-toggle, runtime-inställningar)

### Samarbete och kommunikation
- Recensioner och betyg (båda riktningar)
- Gruppbokning för stallgemenskaper
- In-app notifikationer + email
- Automatiska återbesökspåminnelser
- Bokningspåminnelser 24h före (med opt-out via unsubscribe-länk)

### Integrationer och säkerhet
- Betalningsabstraktion (PaymentGateway)
- Bokföringsabstraktion (Fortnox)
- Bilduppladdning (Supabase Storage)
- Rate limiting, CSRF, XSS, SQL injection-skydd
- GDPR-dataexport (JSON/CSV)
- Redis-backade feature flags med admin-toggle

Se [ANVANDARDOKUMENTATION.md](docs/ANVANDARDOKUMENTATION.md) för detaljerade beskrivningar.

## Testning

**1890+ tester** (115+ E2E desktop + 82+ E2E mobil + 1890+ unit/integration) med **70% coverage**.

### Kör Tester

```bash
# Unit/Integration (Vitest)
npm test                  # Watch mode
npm run test:ui           # Visuellt interface
npm run test:coverage     # Med coverage

# E2E (Playwright)
npm run test:e2e          # Kör E2E-tester (desktop)
npm run test:e2e:ui       # Playwright UI (bäst för utveckling)
# Mobil viewport körs automatiskt som separat Playwright-projekt (Pixel 7, Chromium)
```

**Testanvändare:**
- Kund: `test@example.com` / `TestPassword123!`
- Leverantör: `provider@example.com` / `ProviderPass123!`

Se `e2e/README.md` och individuella `.test.ts` filer för detaljer.

## Testa Appen Manuellt

**Snabb guide:**

1. **Registrera leverantör** -> Lägg till tjänster -> Sätt öppettider
2. **Registrera kund** -> Bläddra leverantörer -> Gör bokning
3. **Logga in som leverantör** -> Acceptera bokning -> Markera som klar
4. **Verifiera som kund** -> Se uppdaterad status -> Lämna recension
5. **Logga in som leverantör** -> Se recension -> Svara på recension
6. **Som kund** -> Mina hästar -> Se historik -> Lägg till anteckning
7. **Som leverantör** -> Verifiering -> Skicka ansökan

## Felsökning

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
# Starta om TS server i VS Code: Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### Stale cache
```bash
rm -rf .next && npm run dev
```

## Deploy till Produktion

Equinet är konfigurerat för **Vercel** (hosting) + **Supabase** (databas).

Kort sammanfattning:
1. Skapa Supabase-projekt och kopiera connection string (Session Pooler IPv4)
2. Importera repo på Vercel och lägg till environment variables
3. Vercel kör automatiskt `prisma generate` och `next build`

Se [PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) för fullständig steg-för-steg guide.

## Dokumentation

### Huvuddokument
- **README.md** (denna fil) - Vad som är byggt, setup, testning
- **[CLAUDE.md](./CLAUDE.md)** - Utvecklingsguide, arbetsprocesser, patterns
- **[NFR.md](./NFR.md)** - Non-Functional Requirements (säkerhet, performance, etc.)

### Guider & Referens
- **[docs/GOTCHAS.md](./docs/GOTCHAS.md)** - Vanliga problem och lösningar
- **[docs/AGENTS.md](./docs/AGENTS.md)** - Agent-team guide för Claude Code
- **[docs/PRODUCTION-DEPLOYMENT.md](./docs/PRODUCTION-DEPLOYMENT.md)** - Komplett deployment-guide
- **[docs/skalning.md](./docs/skalning.md)** - Skalningsplan för 500 användare
- **[docs/ANVANDARDOKUMENTATION.md](./docs/ANVANDARDOKUMENTATION.md)** - Detaljerade funktionsbeskrivningar

### Säkerhet & Retrospectives
- **[docs/SECURITY-REVIEW-2026-01-21.md](./docs/SECURITY-REVIEW-2026-01-21.md)** - Senaste säkerhetsgranskning
- **[docs/retrospectives/](./docs/retrospectives/)** - Sprint retrospectives
- **[docs/sprints/](./docs/sprints/)** - Sprint-planer och historik

### Features
- **[features/rutt-baserad-levering.md](./features/rutt-baserad-levering.md)** - Fullständig feature-spec för rutt-funktionen

## Roadmap

### Framtida Features
- **Realtidsspårning** - Leverantörens position och ETA-uppdateringar
- **Push/SMS-notifikationer** - Komplement till befintliga notifikationer
- **Betalningsintegration** - Swish/Stripe via PaymentGateway

Feature-backlog hanteras i Trello.

---

**Skapad**: November 2025
**Version**: v0.3.0+
**Utvecklad med**: Next.js 16, TypeScript, Tailwind CSS, Claude Code
