# Equinet - Bokningsplattform för Hästtjänster

Equinet är en modern bokningsplattform som kopplar samman hästägare med tjänsteleverantörer som hovslagare, veterinärer och andra hästspecialister.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20 eller senare
- **npm**: v10 eller senare
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
   # Skapa databas från schema (kör migrationer)
   npx prisma migrate dev

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

## 🔒 Quality Gates

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

**Workflow:**
1. Skapa feature branch från main
2. Gör dina ändringar och commits
3. Pre-push hook kör tests automatiskt
4. Push till remote och skapa Pull Request
5. CI kör alla checks automatiskt
6. När checks passar → merge till main

> **Note:** Branch protection är inaktiverat under MVP-fasen. Quality gates körs fortfarande men blockerar inte merge.

## 🛠️ Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **Språk**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI**: shadcn/ui + Radix UI
- **Databas**: PostgreSQL (Supabase) via Prisma ORM
- **Autentisering**: NextAuth.js v5
- **Validering**: Zod + React Hook Form
- **Testning**: Vitest (1277 unit/integration) + Playwright (66 E2E) = 70% coverage
- **CI/CD**: GitHub Actions (quality gates, E2E tests)
- **Arkitektur**: DDD-Light med Repository Pattern
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
│   │   ├── api/              # API routes (HTTP-hantering)
│   │   │   ├── auth/         # NextAuth & registrering
│   │   │   ├── bookings/     # Boknings-API
│   │   │   ├── horses/       # Hästregister-API
│   │   │   ├── providers/    # Leverantörs-API
│   │   │   │   └── [id]/availability/  # Tillgänglighetskontroll
│   │   │   ├── notifications/ # In-app notifikationer API
│   │   │   ├── reviews/      # Recensioner & betyg API (kund → leverantör)
│   │   │   ├── customer-reviews/ # Kundrecensioner API (leverantör → kund)
│   │   │   ├── services/     # Tjänste-API
│   │   │   ├── cron/         # Schemalagda jobb (påminnelser)
│   │   │   ├── route-orders/ # Rutt-beställningar API
│   │   │   ├── routes/       # Rutt-planering API
│   │   │   ├── verification-requests/ # Leverantörsverifiering API
│   │   │   ├── group-bookings/ # Gruppboknings-API (join, match, available)
│   │   │   ├── provider/     # Leverantörs-specifika API (kunder, besöksplanering, intervall)
│   │   │   └── admin/        # Admin-endpoints (verifieringsgranskning)
│   │   ├── admin/            # Admin-sidor (verifieringshantering)
│   │   ├── customer/         # Kundsidor (dashboard, bookings, profile, hästprofil)
│   │   ├── provider/         # Leverantörssidor (dashboard, services, bookings, routes, verifiering)
│   │   └── providers/        # Publika leverantörssidor
│   ├── components/
│   │   ├── layout/           # Header, navigation, layouts
│   │   ├── provider/         # Provider-specifika komponenter
│   │   ├── review/           # Recensionskomponenter (dialog, stjärnor, lista)
│   │   └── ui/               # shadcn/ui komponenter
│   ├── domain/               # Affärslogik, entiteter, value objects
│   │   ├── booking/          # BookingService, types
│   │   ├── group-booking/    # GroupBookingService (matchning, sekventiella bokningar)
│   │   ├── notification/     # NotificationService
│   │   ├── payment/          # PaymentGateway (interface + mock)
│   │   ├── reminder/         # ReminderService (återbokningspåminnelser)
│   │   └── shared/           # TimeSlot, Result, ValueObject
│   ├── infrastructure/       # Repositories, externa tjänster
│   │   └── persistence/      # Prisma-implementationer (booking, provider, service)
│   ├── hooks/
│   │   ├── useAuth.ts        # Custom auth hook
│   │   └── useNotifications.ts # Notifikationspolling och hantering
│   ├── lib/
│   │   ├── auth.ts           # NextAuth konfiguration
│   │   ├── email/            # Email-notifikationer och templates
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── rate-limit.ts     # Rate limiting
│   │   ├── sanitize.ts       # Input sanitization
│   │   └── validations/      # Delade Zod-schemas
│   └── types/
└── .env                      # Environment variables (NOT committed)
```

## 🏗️ Arkitektur

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

**Huvudmodeller (22 st):**
- **User** - Användarkonton (kunder + leverantörer + admin)
- **Provider** - Leverantörsprofiler med företagsinformation och verifieringsstatus
- **Service** - Tjänster som leverantörer erbjuder
- **Horse** - Hästregister med namn, ras, födelseår, kön, specialbehov
- **HorseNote** - Anteckningar i hästens hälsotidslinje (veterinär, hovslagare, skada, medicin, allmänt)
- **Availability** - Öppettider per veckodag
- **AvailabilityException** - Undantag från öppettider (lediga dagar, etc.)
- **Booking** - Traditionella bokningar med fast tid (kan kopplas till Horse)
- **Payment** - Betalningar kopplade till bokningar
- **Notification** - Notifikationer till användare
- **EmailVerificationToken** - Tokens för email-verifiering
- **RouteOrder** - Flexibla beställningar utan fast tid
- **Route** - Leverantörers planerade rutter
- **RouteStop** - Enskilda stopp i en rutt
- **Review** - Recensioner och betyg (1-5) med leverantörssvar
- **CustomerReview** - Leverantörens recensioner av kunder (1-5, immutabel)
- **ProviderVerification** - Kompetenser och verifieringsansökningar (utbildning, organisation, certifikat, erfarenhet, licens) med utfärdare, år och bilder
- **GroupBookingRequest** - Grupprequests för stallgemenskaper (invite code, status, period)
- **GroupBookingParticipant** - Deltagare i grupprequests (hästinfo, status, koppling till bokning)
- **HorsePassportToken** - Delbara hästpass-länkar med 30 dagars expiry
- **Upload** - Uppladdade filer (bilder) med Supabase Storage-tracking
- **HorseServiceInterval** - Individuellt återbesöksintervall per häst och leverantör (override av tjänstens default)
- **FortnoxConnection** - Fortnox OAuth-tokens (krypterade) per leverantör

Se `prisma/schema.prisma` för fullständig definition.

## ✨ Implementerade Funktioner

### Autentisering
- Registrering med rollval (kund/leverantör)
- Email-verifiering vid registrering (verify-email, resend-verification)
- Lösenordsstyrkeindikator med real-time feedback
- Session-baserad autentisering
- Rollbaserad access control

### Leverantörsfunktioner
- Dashboard med statistik och onboarding-checklista
- Tjänstehantering (CRUD)
- Öppettider & tillgänglighetskontroll
- Availability Exceptions (undantag från öppettider, CRUD)
- Kalendervy för bokningsöversikt
- Bokningshantering med filter och automatisk tab-växling
- Profilkompletteringsindikator
- **Recensioner & betyg**: Se och svara på kundrecensioner, genomsnittligt betyg, recensera kunder efter genomförda bokningar
- **Kompetenser & Verifiering**: Lägg till kompetenser (utbildning, organisation, certifikat, erfarenhet, licens) med utfärdare, år, beskrivning och bilder (max 5 per post). Redigera/ta bort pending/rejected poster. Badge på profil vid godkännande
- **Hästhälsotidslinje (read-only)**: Se medicinsk historik för hästar med bokningar (veterinär, hovslagare, medicin)
- **Kundregister**: Samlad lista över alla kunder (härledd från bokningar) med antal bokningar, hästar, senaste besök. Filter (aktiva/inaktiva) och fritextsök
- **Besöksplanering ("Dags för besök")**: Översikt över hästar som behöver återbesök, sorterade efter angelägenhet (försenad/inom 2 veckor/ej aktuell). Individuella återbesöksintervall per häst som override:ar tjänstens default
- **Grupprequests**: Se öppna grupprequests, matcha och skapa bokningar för alla deltagare
- **Rutt-planering**:
  - Visa tillgängliga flexibla beställningar sorterade efter avstånd
  - Skapa optimerade rutter (Haversine + Nearest Neighbor)
  - Köra rutter stopp-för-stopp med statusuppdateringar
  - Automatisk ETA-beräkning
  - Kartvy med Leaflet-integration

### Kundfunktioner
- Leverantörsgalleri med sökning och filtrera
- **Hästregister**: Lägg till, redigera och ta bort hästar med namn, ras, födelseår, kön, specialbehov och foto
- **Hästhälsotidslinje**: Samlad historik per häst -- bokningar + anteckningar (veterinär, hovslagare, skada, medicin, allmänt). Kategorifilter och färgkodad tidslinje.
- **Hästpass (delbar länk)**: Skapa delbar länk till hästens profil och vårdhistorik. 30 dagars expiry, integritetsskydd (privata anteckningar döljs). Print-vänlig layout.
- Traditionella bokningar med tillgänglighetskontroll och hästval (dropdown eller fritext)
- Flexibla rutt-beställningar (datum-spann, prioritet)
- Avboka bokningar med bekräftelsedialog
- Mock-betalning med kvittogenerering
- Kundprofil
- **Recensioner & betyg**: Lämna, redigera och ta bort recensioner för avslutade bokningar
- **Gruppbokningar**: Skapa grupprequests, dela invite code, se deltagare, lämna grupp
- **Dataexport (GDPR)**: Exportera all personlig data som JSON eller CSV (profil, hästar, bokningar, anteckningar, recensioner)

### Gruppbokning (stallgemenskaper)
- Kund skapar grupprequest med tjänsttyp, plats och datumperiod
- Kryptografiskt säker 8-teckens invite code (utan tvetydiga tecken)
- Andra hästägare går med via kod eller länk
- Leverantörer ser öppna grupprequests och matchar
- Matchning skapar sekventiella individuella bokningar för alla deltagare
- Notifikationer vid join, match, cancel och leave

### Admin
- **Verifieringsgranskning**: Granska, godkänna och avvisa leverantörers verifieringsansökningar med kommentarer, bilder och metadata (utfärdare, år)

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
- Rate limiting (login, registrering, bokningar, publika endpoints)
- Strukturerad logging med security events
- Environment validation

### In-app notifikationer
- Notifikationsklocka i headern med badge for olästa
- Dropdown med senaste 10 notifikationer
- Markera enskild/alla som lästa
- Automatiska notifikationer vid bokning, statusändring, betalning, recension
- Polling var 30:e sekund (serverless-kompatibelt)

### Återbokningspåminnelser
- Leverantörer sätter rekommenderat återbesöksintervall per tjänst
- Individuellt intervall per häst (override av tjänstens default) via HorseServiceInterval
- Daglig cron (Vercel Cron Jobs, kl 08:00) hittar förfallna påminnelser
- In-app notifikation + email med "Boka igen"-länk
- En påminnelse per avslutad bokning (inga dubbletter)

### Betalningsabstraktion
- PaymentGateway interface (IPaymentGateway) for framtida Swish/Stripe
- MockPaymentGateway for utveckling/demo
- Factory-funktion for att byta implementation via env-variabel

### Bilduppladdning
- Supabase Storage-integration med public bucket (equinet-uploads)
- Drag-and-drop + klick-uppladdning med preview
- Client-side komprimering (max 1MB via browser-image-compression)
- Stöd för JPEG, PNG, WebP (max 5MB)
- IDOR-skydd vid uppladdning (verifierar ägarskap)
- Återanvändbar ImageUpload-komponent med variant-stöd (square, circle, default)
- Hästfoto (square) på hästlistan och hästdetaljsidan
- Leverantörens profilbild (circle) på leverantörsprofilen
- Profilbilden visas på leverantörens publika sida (kundvyn)
- Dev-fallback: sparar till public/uploads/ utan Supabase-konfiguration

### Bokföringsabstraktion (Fortnox)
- IAccountingGateway interface (samma mönster som PaymentGateway)
- MockAccountingGateway för utveckling/demo
- FortnoxGateway med OAuth 2.0 Authorization Code Grant
- Token-kryptering med AES-256-GCM
- Automatisk token-refresh vid expiry
- InvoiceMapper (Booking -> Fortnox-faktura)
- Manuell faktura-synkning för osynkade bokningar
- Provider settings-sida för att koppla/koppla bort

### Email-notifikationer
- Bokningsbekräftelse till kunder
- Statusändringsnotifikationer (accepterad, avvisad, klar)
- Betalningsbekräftelse
- Email-verifiering vid registrering
- Återbokningspåminnelse med "Boka igen"-knapp
- HTML-templates med responsiv design

### Performance & Skalning
- Connection pooling (PgBouncer via Supabase)
- Redis-cache för geocoding-resultat
- Bounding box pre-filtering för geo-queries
- Rate limiting på publika API endpoints

## 🧪 Testning

**1340+ tester** (66 E2E + 1277 unit/integration) med **70% coverage**.

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

- **Unit Tests**: sanitize, booking utils, date-utils, geocoding, slot calculator, hooks (useAuth, useRetry, useWeekAvailability)
- **Domain Tests**: BookingService, TravelTimeService, NotificationService, ReminderService, GroupBookingService, CustomerReviewService, PaymentGateway, AccountingGateway, InvoiceMapper, TimeSlot, Location, Entity, ValueObject, Result, Guard, DomainError
- **Repository Tests**: BookingMapper, MockBookingRepository, ProviderRepository, ServiceRepository
- **Integration Tests**: API routes (auth, verify-email, bookings, horses, horse-notes, horse-timeline, horse-export, horse-passport, services, providers, availability-exceptions, availability-schedule, routes, announcements, reviews, customer-reviews, notifications, verification-requests, admin-verifications, group-bookings, export/my-data, passport, upload, integrations/fortnox, cron, provider/customers, provider/horses/interval, provider/due-for-service)
- **E2E Tests (66)**: Authentication, booking flow, provider flow, route planning, announcements, calendar, payment, flexible booking, security headers

Se `e2e/README.md` och individuella `.test.ts` filer för detaljer.

## 🧭 Testa Appen Manuellt

**Snabb guide:**

1. **Registrera leverantör** → Lägg till tjänster → Sätt öppettider
2. **Registrera kund** → Bläddra leverantörer → Gör bokning
3. **Logga in som leverantör** → Acceptera bokning → Markera som klar
4. **Verifiera som kund** → Se uppdaterad status → Lämna recension
5. **Logga in som leverantör** → Se recension → Svara på recension
6. **Som kund** → Mina hästar → Se historik → Lägg till anteckning
7. **Som leverantör** → Verifiering → Skicka ansökan

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
- **[docs/skalning.md](./docs/skalning.md)** - Skalningsplan för 500 användare

### Säkerhet & Retrospectives
- **[docs/SECURITY-REVIEW-2026-01-21.md](./docs/SECURITY-REVIEW-2026-01-21.md)** - Senaste säkerhetsgranskning
- **[docs/retrospectives/](./docs/retrospectives/)** - Sprint retrospectives
- **[docs/sprints/](./docs/sprints/)** - Sprint-planer och historik

### Features
- **[features/rutt-baserad-levering.md](./features/rutt-baserad-levering.md)** - Fullständig feature-spec för rutt-funktionen

## 🔮 Roadmap

### ✅ Implementerat (v0.2.0+)
- ✅ PostgreSQL Migration (Supabase)
- ✅ Rate Limiting (Upstash Redis)
- ✅ Förbättrad lösenordsvalidering (F-3.1)
- ✅ Avboka-funktion för kunder (F-3.2)
- ✅ Försök igen-knappar med useRetry hook (F-3.3)
- ✅ Onboarding Checklist för leverantörer (F-3.4)
- ✅ Kartvy - Visa beställningar och rutter på karta (F-1.1)
- ✅ Provider hem-position (F-1.4)
- ✅ Next.js 16 + NextAuth v5 upgrade
- ✅ Announcement/Rutter-funktionalitet (leverantörer annonserar rutter)
- ✅ Customer location support för geo-matching
- ✅ NearbyRoutesBanner på leverantörsprofiler
- ✅ Öppettider visas på leverantörsprofiler
- ✅ Skalningsoptimering för 500 användare (connection pooling, geocoding cache)
- ✅ Email-notifikationer (bokningsbekräftelse, statusändringar, betalning, verifiering)
- ✅ Email-verifiering vid registrering
- ✅ Mock-betalningssystem med kvittogenerering
- ✅ Leverantörs-kalendervy
- ✅ Availability Exceptions (undantag från öppettider)
- ✅ Recensioner & betyg (1-5 stjärnor, kommentarer, leverantörssvar)
- ✅ Hästregister med vårdhistorik (CRUD, koppling till bokningar)
- ✅ In-app notifikationer (klocka, dropdown, polling)
- ✅ Automatiska återbokningspåminnelser (cron + email + in-app)
- ✅ Betalningsabstraktion (gateway pattern for Swish/Stripe)
- ✅ Hästhälsotidslinje (anteckningar, kategorifilter, färgkodning, provider read-only)
- ✅ Leverantörsverifiering (ansökan, admin-granskning, badge, notifikation)
- ✅ Gruppbokning för stallgemenskaper (invite codes, sekventiell matchning, 7 endpoints)
- ✅ Kundregister för leverantörer (samlad kundlista, filter, sök, hästöversikt)
- ✅ Återbesöksintervall per häst (override av tjänstens default, leverantörsspecifikt)
- ✅ Besöksplanering ("Dags för besök"-vy med statusbadges, filtrering, sortering)

### Framtida Features
- **Realtidsspårning** - Leverantörens position och ETA-uppdateringar
- **Push/SMS-notifikationer** - Komplement till befintliga notifikationer
- Betalningsintegration (Swish/Stripe via PaymentGateway)

Se `BACKLOG.md` för fullständig feature-lista.

---

**Skapad**: November 2025
**Version**: v0.2.0+
**Utvecklad med**: Next.js 16, TypeScript, Tailwind CSS, Claude Code
