# CLAUDE.md - Projektdokumentation för AI-assistent

Detta dokument innehåller viktig information om Equinet-projektet för framtida AI-assisterade utvecklingssessioner.

## 📌 Projektöversikt

**Projektnamn**: Equinet
**Typ**: Bokningsplattform för hästtjänster (MVP)
**Status**: ✅ Fungerande MVP med förbättrad UX
**Skapad**: November 2025
**Senast uppdaterad**: 2025-11-12

### Projektbeskrivning
En fullstack webbapplikation som kopplar samman hästägare med tjänsteleverantörer (hovslagare, veterinärer, etc.). Plattformen har två separata användarflöden med olika funktionalitet för kunder och leverantörer.

## 🎯 Nuvarande Status

### ✅ Fullt Implementerat

#### Autentisering & Användare
- [x] NextAuth.js v4 med credentials provider
- [x] Användarregistrering med rollval (customer/provider)
- [x] bcrypt password hashing
- [x] Session management med JWT
- [x] Custom useAuth hook (`src/hooks/useAuth.ts`)
- [x] Rollbaserad route protection

#### Databas & Backend
- [x] Prisma ORM med SQLite
- [x] Komplett databasschema (User, Provider, Service, Availability, Booking, Notification)
- [x] CRUD API routes för services (`/api/services`)
- [x] Booking API med status management (`/api/bookings`)
- [x] Provider API för publikt galleri (`/api/providers`)
- [x] Zod validation på alla API endpoints

#### Kundfunktioner
- [x] Förenklat kundflöde - leverantörsgalleriet som huvudsida
- [x] Användarmeny med dropdown (bokningar, profil, logga ut)
- [x] Publikt leverantörsgalleri (`/providers`) med avancerad sökning
- [x] Sök och filtrera leverantörer efter namn/beskrivning och ort
- [x] Automatisk sökning med debounce (500ms)
- [x] Visuella filter-badges med möjlighet att ta bort enskilda filter
- [x] Leverantörsdetaljsida med tjänster (`/providers/[id]`)
- [x] Bokningsdialog med kalenderpicker
- [x] Hästinformation och kommentarer vid bokning
- [x] Lista alla egna bokningar (`/customer/bookings`)
- [x] Avboka bokningar
- [x] Kundprofilsida för att redigera personlig information (`/customer/profile`)

#### Leverantörsfunktioner
- [x] Provider dashboard med statistik (`/provider/dashboard`)
- [x] Tjänstehantering CRUD (`/provider/services`)
- [x] Aktivera/inaktivera tjänster
- [x] Bokningshantering med filter (`/provider/bookings`)
- [x] Acceptera/avvisa/genomför bokningar
- [x] Automatisk tab-växling efter statusändringar
- [x] Detaljerad kundinfo vid bokning
- [x] Leverantörsprofilsida för företagsinformation (`/provider/profile`)

#### UI/UX
- [x] shadcn/ui komponenter (button, card, input, dropdown-menu, etc)
- [x] Responsiv design (Tailwind CSS v4)
- [x] Toast notifications (Sonner)
- [x] Svensk lokalisering (date-fns sv locale)
- [x] Loading states
- [x] Error handling
- [x] Dropdown-menyer för användare (renare navigation)
- [x] Visuella filter-badges för sökning
- [x] Automatisk sökning med debounce

## 🐛 Kända Problem & Fixar

### Problem som är Lösta

1. **Next.js 16 Params Promise Issue** (LÖST)
   - Problem: Dynamic route params är nu Promises i Next.js 15/16
   - Påverkade: `/api/services/[id]`, `/api/bookings/[id]`, `/api/providers/[id]`
   - Fix: Ändrade `{ params: { id: string } }` → `{ params: Promise<{ id: string }> }`
   - Måste awaita: `const { id } = await params`

2. **shadcn/ui Components Missing** (LÖST)
   - Problem: Komponenter installerades inte vid första setup
   - Fix: `npx shadcn@latest add button input card dialog select calendar form label textarea --yes`

3. **Toggle Active Service Validation Error** (LÖST)
   - Problem: Hela service-objektet (inklusive Date-objekt) skickades i PUT request
   - Fix: Skicka endast required fields (name, description, price, durationMinutes, isActive)
   - Fil: `src/app/provider/services/page.tsx:137-175`

4. **Bokningar Försvinner Efter Accept** (LÖST - UX Fix)
   - Problem: Bekräftade bokningar "försvann" eftersom filtret var kvar på "pending"
   - Fix: Automatisk tab-växling efter statusändringar
   - Fil: `src/app/provider/bookings/page.tsx:66-93`

5. **TypeScript Zod Validation Errors** (LÖST)
   - Problem: `error.errors` finns inte i Zod, och felaktig enum errorMap syntax
   - Fix: Ändrade alla `error.errors` till `error.issues` och fixade enum syntax
   - Påverkade: Alla API routes med Zod validation

### Kända Begränsningar (By Design)

- Använder SQLite för lokal utveckling (byt till PostgreSQL för produktion)
- Ingen email-funktionalitet (notifikationer via UI endast)
- Ingen betalningsintegration
- Availability-modellen används ej i UI ännu (förberedd för framtida features)
- Notification-modellen används ej ännu

## 🔑 Viktiga Filer & Koncept

### Kritiska Konfigurationsfiler

1. **`.env.local`** (GIT-IGNORED)
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="[genererad secret]"
   NEXTAUTH_URL="http://localhost:3000"
   ```

2. **`prisma/schema.prisma`**
   - Databasschema med alla modeller
   - Kör `npx prisma generate` efter ändringar
   - Kör `npx prisma db push` för att uppdatera databas

3. **`src/lib/auth.ts`**
   - NextAuth konfiguration
   - Callbacks för JWT och session
   - Lägger till `userType` och `providerId` i session

### Viktiga Kodfiler

**Autentisering:**
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth handler
- `src/app/api/auth/register/route.ts` - Registrerings-endpoint
- `src/hooks/useAuth.ts` - Client-side auth hook

**API Routes:**
- `src/app/api/services/route.ts` - GET (lista), POST (skapa)
- `src/app/api/services/[id]/route.ts` - PUT (uppdatera), DELETE
- `src/app/api/bookings/route.ts` - GET (lista), POST (skapa)
- `src/app/api/bookings/[id]/route.ts` - PUT (status), DELETE
- `src/app/api/providers/route.ts` - GET (publikt galleri)
- `src/app/api/providers/[id]/route.ts` - GET (detaljer)

**Kund-sidor:**
- `src/app/customer/dashboard/page.tsx`
- `src/app/customer/bookings/page.tsx`
- `src/app/providers/page.tsx` - Publikt galleri
- `src/app/providers/[id]/page.tsx` - Provider detalj + bokning

**Leverantörs-sidor:**
- `src/app/provider/dashboard/page.tsx`
- `src/app/provider/services/page.tsx`
- `src/app/provider/bookings/page.tsx`

## 🛠️ Teknisk Stack

```
Next.js 16 (App Router)
├── TypeScript
├── Tailwind CSS v4
├── Prisma ORM
│   └── SQLite (dev)
├── NextAuth.js v4
│   └── Credentials Provider
├── shadcn/ui
│   ├── Radix UI primitives
│   └── Custom components
├── React Hook Form
│   └── Zod validation
├── date-fns (sv locale)
└── Sonner (toasts)
```

## 📝 Arbetsflöde & Kommandon

### Daglig Utveckling
```bash
npm run dev              # Starta dev server (port 3000)
npm run db:studio        # Öppna Prisma Studio (port 5555)
```

### Databasändringar
```bash
# Efter schema-ändringar
npx prisma generate      # Generera Prisma Client
npx prisma db push       # Pusha schema till databas

# Återställ databasen (RADERAR ALL DATA)
npm run db:reset
npm run setup
```

### Debugging
```bash
# Rensa Next.js cache
rm -rf .next
npm run dev

# Kolla Prisma Client
npx prisma generate

# TypeScript check
npx tsc --noEmit
```

### Testning
```bash
npm test              # Kör tester i watch mode
npm run test:ui       # Öppna Vitest UI (rekommenderas!)
npm run test:run      # Kör tester en gång (CI)
npm run test:coverage # Kör tester med coverage report
```

## 🧪 Test-Driven Development (TDD)

### ⚠️ VIKTIGT: Detta projekt följer TDD-principer

**Alla nya features och bugfixar ska utvecklas med TDD-approach.**

### TDD-cykeln (Red-Green-Refactor)

```
1. 🔴 RED: Skriv ett test som failar
   - Skriv testet INNAN du skriver koden
   - Testet ska beskriva önskat beteende
   - Kör testet och verifiera att det failar

2. 🟢 GREEN: Skriv minsta möjliga kod för att få testet att passa
   - Fokusera på att få testet grönt, inte perfekt kod
   - Håll det enkelt

3. 🔵 REFACTOR: Förbättra koden
   - Nu när testet är grönt, förbättra implementationen
   - Optimera, rensa, förbättra läsbarhet
   - Testet ska fortfarande vara grönt

4. ♻️ UPPREPA: Gå tillbaka till steg 1 för nästa feature
```

### Vad Ska Testas?

#### ✅ Testa ALLTID (High Priority)

**1. API Routes** - Mest kritiskt!
```typescript
// Exempel: src/app/api/auth/register/route.test.ts
- ✅ Happy path (successful request)
- ✅ Validation errors (invalid input)
- ✅ Edge cases (user already exists, etc)
- ✅ Error handling (database errors, etc)
```

**2. Utility Functions** - Enkelt att testa!
```typescript
// Exempel: src/lib/utils/booking.test.ts
- ✅ Pure functions (input → output)
- ✅ Business logic
- ✅ Data transformations
- ✅ Edge cases
```

**3. Custom Hooks** - Viktiga att testa
```typescript
// Exempel: src/hooks/useAuth.test.ts
- ✅ Hook return values
- ✅ State changes
- ✅ Different scenarios
```

**4. Complex Business Logic**
- Bokningslogik (overlap-checking, availability)
- Validering (utöver Zod schemas)
- Beräkningar (priser, tider, etc)

#### 🤔 Testa IBLAND (Medium Priority)

**React Components**
- Endast kritiska komponenter med komplex logik
- Formulär med avancerad validering
- Komponenter med mycket conditional rendering
- **INTE**: Enkla presentationskomponenter

**Integration Tests**
- Viktiga user flows
- API → Database → Response
- Endast för kritiska features

#### ❌ Testa INTE (Low Value)

- Enkla presentationskomponenter utan logik
- Tredjepartsbibliotek (de har sina egna tester)
- Next.js internals
- shadcn/ui komponenter (redan testade)
- CSS/styling

### Teststruktur

```
equinet/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── auth/
│   │           └── register/
│   │               ├── route.ts
│   │               └── route.test.ts        ← Test bredvid implementation
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useAuth.test.ts                  ← Test bredvid hook
│   └── lib/
│       └── utils/
│           ├── booking.ts
│           └── booking.test.ts              ← Test bredvid utility
└── tests/
    └── setup.ts                             ← Global test setup
```

### Test-naming Conventions

```typescript
describe('functionName / ComponentName / API endpoint', () => {
  it('should [expected behavior] when [condition]', () => {
    // Test implementation
  })
})
```

**Exempel:**
```typescript
describe('POST /api/bookings', () => {
  it('should create booking when valid data is provided', () => {})
  it('should return 400 when date is in the past', () => {})
  it('should return 401 when user is not authenticated', () => {})
})

describe('calculateBookingEndTime', () => {
  it('should add duration to start time correctly', () => {})
  it('should handle overnight bookings', () => {})
})
```

### Arrange-Act-Assert Pattern

**Följ AAA-pattern i alla tester:**

```typescript
it('should create a new user', async () => {
  // Arrange - Setup test data and mocks
  const mockUser = { id: '123', email: 'test@example.com' }
  vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

  // Act - Execute the function being tested
  const result = await createUser({ email: 'test@example.com' })

  // Assert - Verify the outcome
  expect(result).toEqual(mockUser)
  expect(prisma.user.create).toHaveBeenCalledWith({
    data: { email: 'test@example.com' }
  })
})
```

### Mocking Guidelines

**1. Mock External Dependencies**
```typescript
// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { create: vi.fn() }
  }
}))

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn()
}))
```

**2. Mock Environment Variables**
```typescript
// In tests/setup.ts
process.env.NEXTAUTH_SECRET = 'test-secret'
```

**3. Mock Dates/Times**
```typescript
import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-11-15T12:00:00Z'))
})
```

### TDD Workflow för Nya Features

**Exempel: Lägga till ny API endpoint**

```bash
# 1. Skapa test-filen FÖRST
touch src/app/api/new-feature/route.test.ts

# 2. Skriv tester för önskat beteende
# 3. Kör testerna - de ska faila (RED)
npm test

# 4. Skapa implementation-filen
touch src/app/api/new-feature/route.ts

# 5. Implementera minsta möjliga kod för att få testerna gröna (GREEN)
# 6. Kör testerna igen
npm test

# 7. Refaktorera koden (REFACTOR)
# 8. Kör testerna igen för att säkerställa de fortfarande är gröna
npm test
```

### Viktiga Testverktyg

**Vitest**
- Test runner (som Jest men snabbare)
- `describe()`, `it()`, `expect()`, `beforeEach()`, etc

**React Testing Library**
- Testa React components och hooks
- `renderHook()`, `render()`, `screen`, `fireEvent`

**Vitest UI**
- Grafiskt interface för att köra och debugga tester
- `npm run test:ui` - öppna i browser

### Code Coverage

**Målsättning:**
- API Routes: **≥ 80% coverage**
- Utilities: **≥ 90% coverage**
- Hooks: **≥ 80% coverage**
- Overall: **≥ 70% coverage**

```bash
# Generera coverage report
npm run test:coverage

# Öppna HTML report
open coverage/index.html
```

### Continuous Testing

**Kör tester kontinuerligt under utveckling:**

```bash
# Watch mode - kör tester automatiskt vid filändringar
npm test

# Eller använd Vitest UI för bättre overview
npm run test:ui
```

### CI/CD Integration

**Tester ska köras automatiskt i CI/CD:**

```yaml
# Exempel för GitHub Actions (framtida)
- name: Run tests
  run: npm run test:run

- name: Check coverage
  run: npm run test:coverage
```

### Tips & Best Practices

#### ✅ DO

- **Skriv tester innan kod** (TDD!)
- **Testa beteende, inte implementation** - testa vad koden gör, inte hur
- **Ett test per beteende** - håll testerna små och fokuserade
- **Använd beskrivande testnamn** - "should create booking when..." istället för "test 1"
- **Mock externa beroenden** - databas, API-anrop, etc
- **Testa edge cases** - null, undefined, tomma arrayer, extremvärden
- **Kör alla tester innan du commitar**

#### ❌ DON'T

- **Skippa inte tester för "det är bara en liten ändring"**
- **Testa inte implementation details** - testa inte interna funktioner som inte är exporterade
- **Duplicera inte tester** - om två tester gör samma sak, ta bort en
- **Lämna inte kommenterade-bort tester** - ta bort eller fixa dem
- **Gör inte tester beroende av varandra** - varje test ska kunna köras isolerat
- **Mocka inte allt** - använd riktiga funktioner när det går

### Debugging Tester

```typescript
// Logga värden under test
console.log('Result:', result)

// Använd Vitest UI för att debugga
// npm run test:ui

// Kör endast ett specifikt test
it.only('should test this specific case', () => {})

// Skippa ett test temporärt
it.skip('should test this later', () => {})

// Debug en specifik fil
npm test booking.test.ts
```

### Exempel på Bra Tester

**Se dessa filer för exempel:**
- `src/app/api/auth/register/route.test.ts` - API route testing
- `src/lib/utils/booking.test.ts` - Utility function testing
- `src/hooks/useAuth.test.ts` - React hook testing

## 🚀 Nästa Steg & Förbättringar

### Prioritet 1 (Quick Wins)
- [ ] Implementera availability-schemat i UI
  - Låt leverantörer sätta öppettider per veckodag
  - Visa tillgängliga tider vid bokning
  - Blockera dubbelbokningar
- [ ] Lägg till profilsidor
  - Kund kan redigera sin profil
  - Leverantör kan redigera företagsinformation
- [ ] Förbättra Dashboard
  - Diagram/charts för statistik
  - Senaste aktivitet
  - Kommande bokningar
- [ ] Sökfunktion
  - Sök leverantörer efter namn eller ort
  - Filtrera efter tjänstetyp

### Prioritet 2 (Större Features)
- [ ] Email-notifikationer
  - Vid ny bokning
  - Vid statusändringar
  - Påminnelser
  - Använd Resend eller SendGrid
- [ ] Bilduppladdning
  - Profilbilder för användare
  - Företagsloggor för leverantörer
  - Bilder för tjänster
  - Använd Cloudinary eller AWS S3
- [ ] Betalningsintegration
  - Stripe eller Klarna
  - Bokningsavgift eller provision
  - Fakturering
- [ ] Recensioner & Betyg
  - Kunder kan betygsätta leverantörer
  - Visa genomsnittligt betyg
  - Skrivna recensioner

### Prioritet 3 (Avancerat)
- [ ] Realtidsnotifikationer (WebSockets/Pusher)
- [ ] SMS-påminnelser (Twilio)
- [ ] Google Calendar-synk
- [ ] Exportera bokningar (PDF/CSV)
- [ ] Mobilapp (React Native/Expo)
- [ ] Admin-panel för plattformsadministration
- [ ] Subscription-modell för leverantörer
- [ ] Geolocation-baserad sökning

## 🔒 Säkerhetsnoteringar

### Implementerat
- ✅ bcrypt password hashing (10 salt rounds)
- ✅ NextAuth session management
- ✅ HTTP-only cookies
- ✅ CSRF protection (NextAuth)
- ✅ SQL injection protection (Prisma)
- ✅ XSS protection (React escaping)
- ✅ Input validation (Zod på client & server)
- ✅ Authorization checks på API routes

### TODO för Produktion
- [ ] Rate limiting på API routes
- [ ] HTTPS enforcement
- [ ] Content Security Policy headers
- [ ] PostgreSQL istället för SQLite
- [ ] Password strength requirements
- [ ] 2FA (two-factor authentication)
- [ ] Security audit
- [ ] GDPR compliance

## 🧪 Testning

### Manual Testing Checklist

**Kund-flöde:**
- [ ] Registrera som kund
- [ ] Logga in
- [ ] Bläddra leverantörer
- [ ] Se leverantörsdetaljer
- [ ] Boka en tjänst
- [ ] Se bokningar
- [ ] Avboka

**Leverantör-flöde:**
- [ ] Registrera som leverantör
- [ ] Logga in
- [ ] Se dashboard-statistik
- [ ] Skapa tjänst
- [ ] Redigera tjänst
- [ ] Inaktivera tjänst
- [ ] Se inkommande bokning
- [ ] Acceptera bokning
- [ ] Markera som genomförd

**Edge Cases:**
- [ ] Försök boka inaktiv tjänst
- [ ] Försök accessa annans bokning
- [ ] Försök redigera annans tjänst
- [ ] Ogiltiga formulärdata
- [ ] Tom databas
- [ ] Många bokningar (pagination framtida feature)

### Automatiserad Testning (TODO)
- [ ] Jest för unit tests
- [ ] React Testing Library för component tests
- [ ] Playwright för e2e tests
- [ ] API integration tests

## 📚 Resurser & Dokumentation

### Externa Dokumentation
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Zod Docs](https://zod.dev)

### Projektets Dokumentation
- `README.md` - Användarmanual och setup guide
- `CLAUDE.md` - Detta dokument (för AI-assistenter)
- `/prisma/schema.prisma` - Databasschema med kommentarer

## 💡 Tips för Framtida Utveckling

### När du lägger till nya features:

1. **Planera först**
   - Fundera på databasschema-ändringar
   - Skissa API endpoints
   - Tänk på både kund- och leverantörsperspektiv

2. **Databas-först approach**
   - Uppdatera `schema.prisma`
   - Kör `npx prisma generate && npx prisma db push`
   - Skapa API routes
   - Bygg UI

3. **Validering på båda sidor**
   - Client-side: React Hook Form + Zod (bättre UX)
   - Server-side: Zod (säkerhet)
   - Dela gärna schema mellan client/server

4. **Error Handling**
   - Använd toast notifications för user feedback
   - Logga errors på server
   - Returnera tydliga felmeddelanden

5. **TypeScript**
   - Låt Prisma generera types
   - Använd Zod för runtime validation OCH type inference
   - Undvik `any` - använd `unknown` om nödvändigt

### Vanliga Gotchas

1. **Next.js 16 Dynamic Params**
   - Kom ihåg att `params` är en Promise nu
   - `const { id } = await params`

2. **Prisma Client**
   - Måste regenereras efter schema-ändringar
   - Använd singleton pattern (`src/lib/prisma.ts`)

3. **NextAuth Session**
   - Session uppdateras inte automatiskt
   - Använd `update()` från `useSession()` om du ändrar userdata

4. **Date Handling**
   - Använd date-fns med sv locale
   - Spara som ISO strings i databas
   - Konvertera till Date-objekt i UI

## 🎨 Design System

### Färger
- Primary: Green-600 (`#16a34a`)
- Background: Gray-50 (`#f9fafb`)
- Text: Gray-900 / Gray-600
- Error: Red-600
- Success: Green-600
- Warning: Yellow-600

### Komponenter
Använder shadcn/ui med Tailwind. Alla komponenter i `src/components/ui/`.

### Layout Pattern
```typescript
<div className="min-h-screen bg-gray-50">
  {/* Header */}
  <header className="bg-white border-b">
    {/* Navigation & User Menu */}
  </header>

  {/* Navigation Tabs (om applicable) */}
  <nav className="bg-white border-b">
    {/* Secondary Navigation */}
  </nav>

  {/* Main Content */}
  <main className="container mx-auto px-4 py-8">
    {/* Page Content */}
  </main>
</div>
```

## 🔄 Senaste Ändringar (Changelog)

### 2025-11-12
- ✅ **Förbättrad UX för kunder:**
  - Kunder hamnar nu direkt i leverantörsgalleriet vid login (istället för dashboard)
  - Lagt till användarmeny med dropdown (bokningar, profil, logga ut)
  - Renare navigation utan onödiga flikar
  - Tagit bort `/customer/dashboard` - behövs inte längre
- ✅ **Avancerad sökfunktion:**
  - Sök och filtrera leverantörer efter namn/beskrivning
  - Filtrera leverantörer efter ort
  - Automatisk sökning med debounce (500ms)
  - Visuella filter-badges som visar aktiva filter
  - Möjlighet att ta bort enskilda filter med ×-knappen
  - "Rensa"-knapp för att ta bort alla filter
- ✅ **Profilsidor:**
  - Kundprofilsida för att redigera personlig information
  - Leverantörsprofilsida för företagsinformation
  - API routes för profilhantering (`/api/profile`, `/api/provider/profile`)
- ✅ **TypeScript-förbättringar:**
  - Fixat alla Zod validation errors (`error.errors` → `error.issues`)
  - Fixat enum errorMap syntax
  - Fixat test-fil type errors
- ✅ **Komponenter:**
  - Lagt till shadcn dropdown-menu komponent
  - Konsistent användarmeny på alla kundsidor

### 2025-11-11
- ✅ Fixat Next.js 16 params Promise issue i alla dynamic routes
- ✅ Fixat toggle active service validation error
- ✅ Lagt till automatisk tab-växling i bookings efter statusändring
- ✅ Förbättrat error logging i både client och server
- ✅ Skapat omfattande README.md
- ✅ Lagt till npm scripts (setup, db:reset, db:studio)
- ✅ Skapat CLAUDE.md för framtida sessioner

### Initial Implementation
- ✅ Grundläggande autentisering & rollhantering
- ✅ Databas setup med Prisma
- ✅ CRUD för services
- ✅ Bokningssystem
- ✅ Dashboard för både kunder och leverantörer
- ✅ Publikt leverantörsgalleri

---

**Skapad av**: Claude Code
**Senast uppdaterad**: 2025-11-12
**För frågor**: Se README.md eller projektdokumentationen
