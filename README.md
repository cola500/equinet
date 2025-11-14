# Equinet - Bokningsplattform för Hästtjänster

Equinet är en modern bokningsplattform som kopplar samman hästägare med tjänsteleverantörer som hovslagare, veterinärer och andra hästspecialister.

## 🚀 Snabbstart

### 1. Installera beroenden
```bash
npm install
```

### 2. Sätt upp databasen
```bash
npm run setup
```

### 3. Starta utvecklingsservern
```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

### Stoppa servern
```bash
# I terminalen där servern körs
Ctrl + C

# Eller använd stop-scriptet
./scripts/stop.sh
```

## 📋 Tillgängliga Scripts

### Development Scripts
```bash
./scripts/start.sh     # Starta development server
./scripts/stop.sh      # Stoppa development server
./scripts/restart.sh   # Starta om development server
```

### NPM Scripts
| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Startar utvecklingsservern på port 3000 |
| `npm run build` | Bygger produktionsversionen av appen |
| `npm start` | Startar produktionsservern (kräver build först) |
| `npm run setup` | Sätter upp Prisma och pushar schema till databasen |
| `npm run db:reset` | Återställer databasen ⚠️ (raderar all data!) |
| `npm run db:studio` | Öppnar Prisma Studio för att inspektera databasen |
| `npm run lint` | Kör ESLint för kodkvalitetskontroll |
| `npm test` | Kör unit/integration tester i watch mode |
| `npm run test:ui` | Öppnar Vitest UI för interaktiv testning |
| `npm run test:run` | Kör unit/integration tester en gång (CI) |
| `npm run test:coverage` | Kör tester med coverage report |
| `npm run test:e2e` | Kör E2E-tester med Playwright (headless) |
| `npm run test:e2e:ui` | Öppnar Playwright UI för visuell testning |
| `npm run test:e2e:headed` | Kör E2E-tester med synlig browser |
| `npm run test:e2e:debug` | Debug mode för E2E-tester |

## 🛠️ Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **Språk**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI Komponenter**: shadcn/ui + Radix UI
- **Databas**: SQLite (via Prisma ORM)
- **Autentisering**: NextAuth.js v4
- **Form Validering**: Zod + React Hook Form
- **Datum**: date-fns med svensk locale
- **Notifikationer**: Sonner (toast)
- **Säkerhet**:
  - bcrypt (password hashing)
  - In-memory rate limiting
  - Input sanitization
  - Structured logging
  - Environment validation
- **Testning**:
  - Vitest (unit & integration tests)
  - Playwright (E2E tests)
  - 70% code coverage
  - ~150 tester totalt

## 📁 Projektstruktur

```
equinet/
├── prisma/
│   ├── schema.prisma          # Databasschema
│   └── dev.db                 # SQLite databas (genereras automatiskt)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # Autentiseringssidor (login, register)
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # NextAuth endpoints & registrering
│   │   │   ├── bookings/     # Boknings-API (GET, POST, PUT, DELETE)
│   │   │   ├── providers/    # Leverantörs-API (GET lista & detalj)
│   │   │   │   └── [id]/
│   │   │   │       ├── availability/  # Tillgänglighetskontroll API (GET tider för bokning)
│   │   │   │       └── availability-schedule/  # Öppettider-API (GET/PUT veckoschema)
│   │   │   └── services/     # Tjänste-API (CRUD)
│   │   ├── customer/         # Kundsidor
│   │   │   ├── dashboard/    # Översikt med senaste bokningar
│   │   │   ├── bookings/     # Lista alla bokningar (med avbokning)
│   │   │   └── profile/      # Kundprofilsida
│   │   ├── provider/         # Leverantörssidor
│   │   │   ├── dashboard/    # Dashboard med stats & onboarding
│   │   │   ├── services/     # CRUD för tjänster
│   │   │   ├── bookings/     # Hantera kundbokningar
│   │   │   └── profile/      # Leverantörsprofilsida med progress
│   │   ├── providers/        # Publika leverantörssidor
│   │   │   ├── page.tsx      # Lista alla leverantörer (med sökning)
│   │   │   └── [id]/         # Leverantörsdetalj & bokning
│   │   └── dashboard/        # Redirect till rätt dashboard
│   ├── components/
│   │   ├── layout/           # Layout-komponenter för konsekvent design
│   │   │   ├── Header.tsx           # Gemensam header med auth-aware navigation
│   │   │   ├── ProviderNav.tsx      # Navigation tabs för provider-sidor
│   │   │   ├── ProviderLayout.tsx   # Layout wrapper för provider-sidor
│   │   │   ├── CustomerNav.tsx      # Navigation tabs för kund-sidor
│   │   │   ├── CustomerLayout.tsx   # Layout wrapper för kund-sidor
│   │   │   └── README.md            # Användningsdokumentation
│   │   ├── provider/         # Provider-specifika komponenter
│   │   │   └── AvailabilitySchedule.tsx  # Veckoschema för öppettider
│   │   └── ui/               # shadcn/ui komponenter
│   │       ├── password-requirements.tsx  # Lösenordsstyrkeindikator
│   │       ├── alert-dialog.tsx  # Bekräftelsedialoger
│   │       └── ...           # Andra UI-komponenter
│   ├── hooks/
│   │   └── useAuth.ts        # Custom auth hook
│   ├── lib/
│   │   ├── auth.ts           # NextAuth konfiguration
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── utils.ts          # Utility funktioner (cn, etc)
│   │   ├── rate-limit.ts     # Rate limiting utilities
│   │   ├── sanitize.ts       # Input sanitization
│   │   ├── logger.ts         # Structured logging
│   │   ├── env.ts            # Environment validation
│   │   └── validations/
│   │       └── auth.ts       # Delade Zod-schemas för auth
│   └── types/
│       └── next-auth.d.ts    # TypeScript types för NextAuth
├── .env.local                # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## 🔑 Konfiguration

### Environment Variables

Filen `.env.local` ska finnas i projektets rot med följande innehåll:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="din-säkra-hemliga-nyckel-här"
NEXTAUTH_URL="http://localhost:3000"
```

**Generera en säker NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

## 👥 Användarroller

Equinet har två olika användarroller med separata gränssnitt:

### 🐴 Kunder (Hästägare)
- Registrera och logga in
- Bläddra bland tjänsteleverantörer
- Filtrera leverantörer efter tjänstetyp
- Se leverantörsprofiler med tjänster och priser
- Boka tjänster med datum, tid och hästinformation
- Se alla sina bokningar på dashboard
- Avboka bokningar

### 🔨 Tjänsteleverantörer (Hovslagare, Veterinärer, etc.)
- Registrera med företagsinformation
- Dashboard med statistik:
  - Antal tjänster
  - Totala bokningar
  - Väntande bokningar
  - Genomförda bokningar
- Hantera tjänster (CRUD):
  - Skapa nya tjänster
  - Redigera namn, beskrivning, pris, varaktighet
  - Aktivera/inaktivera tjänster
  - Ta bort tjänster
- Öppettider & Tillgänglighet:
  - Sätta öppettider per veckodag (måndag-söndag)
  - Markera vissa dagar som "stängt"
  - Redigera schema i realtid med visuell feedback
  - Schema visas automatiskt i bokningsflödet för kunder
- Bokningshantering:
  - Se inkommande bokningar (filtrerat efter status)
  - Automatiska flikar: "Väntar på svar", "Bekräftade", "Alla"
  - Acceptera eller avvisa bokningar
  - Markera bokningar som genomförda
  - Se kundinformation och hästdetaljer
  - Automatisk tab-växling efter statusändringar

## 🗄️ Databasschema

### Huvudsakliga Modeller

#### User
- Användarkonton (både kunder och leverantörer)
- Fält: email, password (hashed), firstName, lastName, phone, userType
- Relationer: kunde-bokningar, leverantörsprofil

#### Provider
- Utökad profil för tjänsteleverantörer
- Fält: companyName, description, address, municipality, location, isActive
- Relationer: användare, tjänster, tillgänglighet, bokningar

#### Service
- Tjänster som leverantörer erbjuder
- Fält: name, description, price, durationMinutes, isActive
- Kan aktiveras/inaktiveras utan att raderas

#### Availability
- Leverantörers tillgänglighet (veckoschema)
- Fält: dayOfWeek (0-6, 0=Måndag), startTime, endTime, isClosed, isActive
- En rad per veckodag och leverantör (unique constraint)

#### Booking
- Bokningar mellan kunder och leverantörer
- Fält: bookingDate, startTime, endTime, status, horseName, horseInfo, customerNotes
- Statusar: pending, confirmed, cancelled, completed

#### Notification
- Notifikationer (förberedd för framtida implementation)

### ER-Diagram

```
User (Customer) ──┐
                  ├──< Booking >──┐
                  │                │
                  └──> Provider <──┘
                         │
                         ├──< Service
                         ├──< Availability
                         └──< Notification
```

## 🎨 Implementerade Funktioner

### ✅ Autentisering & Användare
- [x] Användarregistrering med rollval (kund/leverantör)
- [x] **Frontend validering med real-time feedback (React Hook Form + Zod)**
- [x] **Visuell lösenordsstyrkeindikator med krav-checklist**
- [x] Säker inloggning med bcrypt-hashade lösenord
- [x] Session-baserad autentisering via NextAuth
- [x] Rollbaserad access control (middleware)
- [x] Custom useAuth hook för enkel auth-state
- [x] **Toast-notifikation efter lyckad registrering**
- [x] Logout-funktionalitet

### ✅ Leverantörsfunktioner
- [x] Provider dashboard med real-time statistik
- [x] **Onboarding-checklista för nya leverantörer (3-stegs guide)**
- [x] **Felhantering med "Försök igen"-knappar**
- [x] Tjänstehantering (CRUD)
- [x] **Förbättrade empty states med ikoner och konkreta förslag**
- [x] Aktivera/inaktivera tjänster
- [x] **Öppettider & Tillgänglighet**
  - Sätta öppettider per veckodag (måndag-söndag)
  - Markera vissa dagar som "stängt"
  - Redigera schema i realtid med visuell feedback
  - Schema visas automatiskt i bokningsflödet för kunder
- [x] Bokningshantering med filter
- [x] Acceptera/avvisa bokningar
- [x] Markera bokningar som genomförda
- [x] Automatisk tab-växling efter statusändringar
- [x] Detaljerad kundinfo vid bokning
- [x] Leverantörsprofilsida för företagsinformation
- [x] **Profilkompletteringsindikator med visuell progress bar**

### ✅ Kundfunktioner
- [x] Förenklat kundflöde - leverantörsgalleriet som huvudsida
- [x] Användarmeny med dropdown (bokningar, profil, logga ut)
- [x] Publikt leverantörsgalleri med avancerad sökning
- [x] Sök och filtrera leverantörer efter namn/beskrivning och ort
- [x] Automatisk sökning med debounce (500ms)
- [x] **Visuell laddningsindikator under sökning (spinner + "Söker...")**
- [x] Visuella filter-badges med möjlighet att ta bort enskilda filter
- [x] **Felhantering med "Försök igen"-knappar**
- [x] **Kontextuella empty states beroende på aktiva filter**
- [x] Leverantörsdetaljsida med tjänster
- [x] Bokningsdialog med kalenderpicker
- [x] **Tillgänglighetskontroll - visar bokade tidsluckor**
- [x] **Visar leverantörens öppettider för vald dag**
- [x] **Varningstexter när leverantören är stängd**
- [x] **Server-side validering förhindrar dubbelbokningar**
- [x] Hästinformation och kundommentarer
- [x] Lista alla egna bokningar
- [x] **Avboka bokningar med bekräftelsedialog**
- [x] Kundprofilsida för att redigera personlig information

### ✅ UI/UX
- [x] Responsiv design (desktop, tablet, mobil)
- [x] Toast-notifikationer för använderfeedback
- [x] Svensk lokalisering (datum, språk)
- [x] Konsekvent färgschema (grön-vit tema)
- [x] **Omfattande loading states (spinners, skeletons, progressbars)**
- [x] **Robust error handling med retry-funktionalitet**
- [x] **Onboarding-flöden för nya användare**
- [x] **Kontextuella empty states med actionable CTAs**
- [x] **Real-time validering med visuell feedback**
- [x] **Bekräftelsedialoger för kritiska operationer**
- [x] Dropdown-menyer för användare (renare navigation)
- [x] Visuella filter-badges för sökning
- [x] Automatisk sökning med debounce

### ✅ Tekniskt
- [x] TypeScript genom hela projektet
- [x] Zod schema-validering på både client & server
- [x] API routes skyddade med auth-checks
- [x] Prisma ORM med type-safety
- [x] Next.js 16 App Router
- [x] Server & Client Components korrekt separerade

## 🔮 Framtida Förbättringar

### Prioritet 1 (Quick Wins)
- [x] ~~Blockera dubbelbokningar~~ (✅ Implementerat!)
  - Server-side validering för överlappande bokningar
  - Visuell indikation av bokade tider
- [x] ~~Implementera availability-schemat i UI~~ (✅ Implementerat!)
  - Låt leverantörer sätta öppettider per veckodag
  - Visa tillgängliga tider baserat på schema
  - Markera stängda dagar
  - Integration med bokningsflödet
- [x] ~~Förbättra Dashboard~~ (✅ Delvis implementerat!)
  - Real-time statistik istället för hårdkodad data
  - Onboarding-guide för nya leverantörer
  - [ ] Diagram/charts för statistik (återstår)
  - [ ] Senaste aktivitet (återstår)

### Prioritet 2 (Större Features)
- [ ] Email-notifikationer
  - Vid ny bokning
  - Vid statusändringar
  - Påminnelser
- [ ] Bilduppladdning
  - Profilbilder för användare
  - Företagsloggor för leverantörer
  - Bilder för tjänster
- [ ] Betalningsintegration (Stripe/Klarna)
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

## 🧪 Testa Appen - Komplett Guide

### Steg 1: Skapa en leverantör

1. Gå till [http://localhost:3000/register](http://localhost:3000/register)
2. Välj **"Tjänsteleverantör"**
3. Fyll i:
   - För- och efternamn: t.ex. "Anna Andersson"
   - Email: `anna@hovslagare.se`
   - Telefon: `070-1234567`
   - Lösenord: Välj ett säkert lösenord
   - Företagsnamn: "Annas Hovslageri"
   - Beskrivning: "Professionell hovslagare med 15 års erfarenhet"
   - Adress, kommun: t.ex. "Stockholm"
4. Klicka **"Registrera"**

### Steg 2: Lägg till tjänster

1. Du kommer automatiskt till provider dashboard
2. Klicka på **"Mina tjänster"** i navigationen
3. Klicka **"Lägg till tjänst"**
4. Skapa några tjänster:
   - **Tjänst 1**:
     - Namn: "Hovslagning"
     - Beskrivning: "Standard hovslagning med skoning"
     - Pris: 800 kr
     - Varaktighet: 60 min
   - **Tjänst 2**:
     - Namn: "Akut hovslagning"
     - Beskrivning: "Akutbesök vid behov"
     - Pris: 1500 kr
     - Varaktighet: 45 min
5. Testa att:
   - Redigera en tjänst
   - Inaktivera/aktivera en tjänst
   - Se att endast aktiva tjänster visas för kunder

### Steg 3: Skapa en kund

1. Logga ut (knappen uppe till höger)
2. Gå till [http://localhost:3000/register](http://localhost:3000/register)
3. Välj **"Hästägare"**
4. Fyll i:
   - För- och efternamn: "Kalle Karlsson"
   - Email: `kalle@example.com`
   - Telefon: `070-9876543`
   - Lösenord: Välj ett lösenord
5. Registrera dig

### Steg 4: Gör en bokning

1. Du kommer till customer dashboard
2. Klicka på **"Hitta tjänster"** eller gå till `/providers`
3. Se listan med leverantörer (Anna Andersson bör synas)
4. Klicka **"Se detaljer"** på Annas kort
5. På leverantörssidan, välj en tjänst (t.ex. "Hovslagning")
6. Fyll i bokningsformuläret:
   - Datum: Välj ett framtida datum
   - Tid: t.ex. "10:00"
   - Hästens namn: "Thunder"
   - Hästinformation: "4-årig hingst, nervös för främmande"
   - Kommentarer: "Behöver extra tid"
7. Klicka **"Boka tjänst"**
8. Du ser toast-notifikationen "Bokning skapad!"
9. Gå till **"Mina bokningar"** och se din bokning (status: "Väntar på svar")

### Steg 5: Hantera bokningen som leverantör

1. Logga ut och logga in igen som leverantör (`anna@hovslagare.se`)
2. Gå till **"Bokningar"** i navigationen
3. Se den nya bokningen under fliken **"Väntar på svar"**
4. Inspektera bokningsdetaljerna:
   - Tjänst, datum, tid
   - Kundinformation (namn, email, telefon)
   - Hästinformation
   - Kundkommentarer
5. Klicka **"Acceptera"**
6. Sidan växlar automatiskt till **"Bekräftade"**-fliken
7. Se den bekräftade bokningen
8. Testa att:
   - Klicka **"Markera som genomförd"**
   - Se att bokningen flyttas till "Alla"-fliken med status "Genomförd"

### Steg 6: Verifiera som kund

1. Logga ut och logga in som kund (`kalle@example.com`)
2. Gå till customer dashboard eller "Mina bokningar"
3. Se att bokningens status har uppdaterats till "Bekräftad" eller "Genomförd"

## 🐛 Felsökning

### Problem: Servern startar inte

**Symptom**: `Port 3000 is already in use`

**Lösning**:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

Eller starta på annan port:
```bash
npm run dev -- -p 3001
```

### Problem: Databasfel

**Symptom**: "Table does not exist", "Prisma client not found"

**Lösning**:
```bash
npm run db:reset
npm run setup
```

### Problem: NextAuth session-fel

**Symptom**: "Invalid secret", redirect loops

**Lösning**:
1. Kontrollera att `.env.local` finns och har `NEXTAUTH_SECRET`
2. Generera ny secret: `openssl rand -base64 32`
3. Starta om servern

### Problem: shadcn/ui komponenter saknas

**Symptom**: `Module not found: Can't resolve '@/components/ui/button'`

**Lösning**:
```bash
npx shadcn@latest add button input card dialog select calendar form label textarea --yes
```

Rensa cache och starta om:
```bash
rm -rf .next
npm run dev
```

### Problem: TypeScript-fel

**Symptom**: Type errors i editorn

**Lösning**:
```bash
# Generera Prisma client
npx prisma generate

# Starta om TypeScript server i VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Problem: Stale data eller caching

**Lösning**: Hård refresh i webbläsaren
- **Windows/Linux**: `Ctrl + Shift + R`
- **macOS**: `Cmd + Shift + R`

## 📊 Databas Management

### Prisma Studio - Visuellt gränssnitt

Öppna ett webbaserat GUI för att inspektera och redigera data:

```bash
npm run db:studio
```

Öppnas på [http://localhost:5555](http://localhost:5555)

Här kan du:
- Se alla tabeller och data
- Söka och filtrera poster
- Manuellt skapa/redigera/ta bort data
- Se relationer mellan tabeller

### Återställ databasen

**⚠️ VARNING: Detta raderar ALL data!**

```bash
npm run db:reset
```

### Backup av databasen

Kopiera filen manuellt:
```bash
cp prisma/dev.db prisma/dev.db.backup
```

Återställ från backup:
```bash
cp prisma/dev.db.backup prisma/dev.db
```

## 🧪 Testning

Equinet har en komplett testsvit med **~149 tester** (22 E2E + 127 unit/integration) och **70% code coverage**.

### Testpyramiden

Projektet följer testpyramiden för optimal testning:

```
         E2E: 22 tests (Playwright) ✅ 100% pass rate
       (Hela användarflöden i browser)
                   ↑
      Integration: 75 tests (Vitest)
       (API routes + databas)
                   ↑
           Unit: 52 tests (Vitest)
       (Utilities & hooks)
```

**E2E Test Coverage:**
- ✅ Authentication (registrering, login, logout)
- ✅ Booking flow (sök, boka, avboka)
- ✅ Provider services (CRUD operations)
- ✅ Provider bookings (acceptera, avböj)
- ✅ Profile management
- ✅ Empty states och error handling

### Snabbstart - Kör Tester

#### Unit & Integration Tests (Vitest)

```bash
# Watch mode - bäst under utveckling
npm test

# Visuellt interface (rekommenderas!)
npm run test:ui

# Kör en gång
npm run test:run

# Med coverage report
npm run test:coverage
```

#### E2E Tests (Playwright)

**Viktigt:** E2E-testerna kräver att testanvändare finns i databasen.

**Steg 1: Skapa testanvändare**
```bash
npx tsx prisma/seed-test-users.ts
```

Detta skapar:
- 📧 **Kund**: `test@example.com` / `TestPassword123!`
- 📧 **Leverantör**: `provider@example.com` / `ProviderPass123!`
- 2 test-tjänster
- 1 test-bokning

**Steg 2: Kör E2E-tester**

```bash
# Alternativ 1: Auto-start (kan ta lång tid att starta)
npm run test:e2e

# Alternativ 2: Manuell start (rekommenderas)
# Terminal 1:
npm run dev

# Terminal 2 (när servern är startad):
npx playwright test

# Med visuell browser
npx playwright test --headed

# Specifikt test-suite
npx playwright test auth.spec.ts
npx playwright test booking.spec.ts
npx playwright test provider.spec.ts
```

**Playwright UI (bäst för utveckling)**
```bash
npm run test:e2e:ui
```

**Debug-läge (steg-för-steg)**
```bash
npm run test:e2e:debug
```

### Vad Testas?

#### Unit Tests (52 st)
- ✅ **sanitize.ts** (52 tests):
  - Email, phone, string sanitization
  - SQL injection-skydd för sökfrågor
  - XSS-skydd (script tags, event handlers)
  - URL-validering (blockerar farliga protokoll)
- ✅ **booking.ts** - Datumhantering och validering
- ✅ **useAuth.ts** - Auth hook-funktionalitet

#### Integration Tests (75 st)
- ✅ **Auth API** (6 tests):
  - Registrering (kund & leverantör)
  - Validering av input
- ✅ **Bookings API** (22 tests):
  - CRUD-operationer
  - Dubbelbokningsskydd
  - Authorization checks
- ✅ **Services API** (18 tests):
  - CRUD för tjänster
  - Provider ownership
- ✅ **Providers API** (10 tests):
  - Lista leverantörer
  - Sök och filtrera
- ✅ Övriga API routes (19 tests)

#### E2E Tests (23 st)
- ✅ **Authentication** (7 tests):
  - Registrera kund & leverantör
  - Inloggning & logout
  - Felhantering
  - Lösenordskrav-validering
- ✅ **Booking Flow** (6 tests):
  - Sök och filtrera leverantörer
  - Komplett bokningsflöde
  - Dubbelbokningsskydd
  - Avboka bokning
  - Empty states
- ✅ **Provider Flow** (10 tests):
  - Dashboard med statistik
  - CRUD tjänster
  - Hantera bokningar
  - Acceptera/avvisa bokningar
  - Uppdatera profil

### Test Coverage

```
Total Coverage: 70%

API Routes:      80-90% ⭐⭐
Utilities:       100%   ⭐⭐⭐
Hooks:           100%   ⭐⭐⭐
Components:      Varierar
```

**Högsta prioritet för testning:**
1. ✅ API routes (säkerhet & business logic)
2. ✅ Utilities (sanitization, validation)
3. ✅ Critical user flows (E2E)
4. ⏭️ React components (kan läggas till senare)

### Testdokumentation

För mer detaljerad information:
- **Unit/Integration tests**: Se individuella `.test.ts` filer
- **E2E tests**: Se `e2e/README.md`

### Playwright Codegen

Generera E2E-tester automatiskt genom att klicka runt i appen:

```bash
npx playwright codegen http://localhost:3000
```

Playwright spelar in dina klick och genererar testkod!

### Continuous Integration

För CI/CD-pipelines:

```bash
# Unit & Integration (snabbt)
npm run test:run

# E2E (långsamt, kräver browser)
npm run test:e2e
```

**Tips för CI:**
- Kör unit/integration tests på varje commit
- Kör E2E tests endast på main/staging
- Använd Playwright i Docker för CI

### Felsökning

**"Test failed" - vad gör jag?**

1. **Kör testet igen** (kan vara flaky)
   ```bash
   npx vitest run --reporter=verbose
   ```

2. **Kolla loggarna**
   ```bash
   npm test -- --reporter=verbose
   ```

3. **Debug i UI**
   ```bash
   npm run test:ui  # För Vitest
   npm run test:e2e:debug  # För Playwright
   ```

4. **Kolla database state**
   ```bash
   npm run db:studio
   ```

**"E2E tests timeout"**

- Öka timeout i `playwright.config.ts`
- Starta dev-server manuellt först
- Kolla att port 3000 inte används av annat

## 🔐 Säkerhet

### Implementerade Säkerhetsåtgärder

#### Grundläggande Säkerhet
- ✅ **Lösenordshantering**: bcrypt med 10 salt rounds
- ✅ **Session Security**: HTTP-only cookies via NextAuth
- ✅ **CSRF Protection**: Inbyggt i NextAuth
- ✅ **SQL Injection**: Skyddad genom Prisma's prepared statements
- ✅ **XSS Protection**: React's automatiska escaping + input sanitization
- ✅ **Auth Middleware**: Route protection baserat på userType
- ✅ **API Authorization**: Kontrollerar att användare äger resursen

#### Avancerad Säkerhet (Nyligen tillagd)

##### 1. Rate Limiting
- ✅ **Login**: 5 försök per 15 minuter
- ✅ **Registrering**: 3 försök per timme
- ✅ **Bokningar**: 10 bokningar per timme per användare
- ✅ **Tjänsteskapande**: 10 tjänster per timme
- ✅ **Profiluppdateringar**: 20 uppdateringar per timme
- In-memory implementation (SQLite-friendly)
- Förberedd för Redis i produktion

##### 2. Input Sanitization
- ✅ **Email sanitization**: Normalisering och validering
- ✅ **String sanitization**: Tar bort null bytes och farliga tecken
- ✅ **Search query sanitization**: SQL injection-skydd
- ✅ **Phone number sanitization**: Format-validering
- ✅ **XSS stripping**: Aggressiv rensning av HTML/JavaScript
- Applicerad på alla user inputs i API endpoints

##### 3. Lösenordsstyrka
- ✅ **Minst 8 tecken** (max 72 för bcrypt)
- ✅ **Kräver**: stor bokstav, liten bokstav, siffra, specialtecken
- ✅ **Blockerar vanliga lösenord**: password123, qwerty123, etc
- ✅ **Förhindrar upprepningar**: aaaaaa inte tillåtet
- ✅ **Detekterar sekvenser**: 123456, abcdef blockeras
- Real-time visuell feedback i registreringsformulär

##### 4. Strukturerad Logging
- ✅ **Log-nivåer**: DEBUG, INFO, WARN, ERROR, FATAL
- ✅ **Context-tracking**: userId, requestId, endpoint
- ✅ **Security events**: Rate limit överträdelser, failed logins
- ✅ **JSON-format i produktion**: Lätt att parse och analysera
- ✅ **Färgkodade logs i development**: Bättre läsbarhet
- Implementerad i kritiska endpoints

##### 5. Environment Validation
- ✅ **Fail-fast**: Applikationen startar inte med felaktig config
- ✅ **Zod-validering**: Type-safe environment variables
- ✅ **Production warnings**:
  - Varnar om HTTP istället för HTTPS
  - Varnar om för kort SECRET (<64 chars)
  - Varnar om SQLite i produktion
- Se `.env.example` för required variables

### Säkerhetsrekommendationer för Produktion

#### Obligatoriska för Produktion
- [x] ~~Implementera rate limiting~~ ✅ (In-memory, fungerar för mindre load)
- [x] ~~Implementera password strength requirements~~ ✅
- [x] ~~Logga security events~~ ✅ (Strukturerad logging implementerad)
- [ ] **Använd stark `NEXTAUTH_SECRET`** (minst 64 bytes för produktion)
- [ ] **Aktivera HTTPS** i produktion (via reverse proxy/load balancer)
- [ ] **Använd PostgreSQL** istället för SQLite

#### Rekommenderat för Större Produktion
- [ ] **Redis-baserad rate limiting** (för multi-server setup)
- [ ] **External logging service** (Sentry, Datadog, CloudWatch)
- [ ] **Password breach checking** (Have I Been Pwned API)
- [ ] **2FA** (tvåfaktorsautentisering)
- [ ] **CORS-policy** (om frontend är på annan domän)
- [ ] **WAF** (Web Application Firewall)

## 🚀 Deploy till Produktion

### Förberedelser

1. **Byt databas**: Migrera från SQLite till PostgreSQL
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   ```

2. **Environment Variables**: Sätt upp på hosting-plattform
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (din production URL)

3. **Kör migrations**:
   ```bash
   npx prisma migrate deploy
   ```

### Rekommenderade Plattformar

- **Vercel** (enkelt för Next.js)
- **Railway** (inkl. PostgreSQL)
- **Heroku** (traditionell hosting)
- **DigitalOcean App Platform**

## 🤝 Bidra

Detta är ett MVP-projekt skapat som demonstration.

För bugrapporter eller förbättringsförslag:
1. Dokumentera problemet tydligt
2. Inkludera steg för att reproducera
3. Ange din miljö (OS, Node version, etc.)

## 📄 Licens

Privat projekt - Ingen licens specificerad.

## 👨‍💻 Utvecklad med

- ☕ Next.js 16 & TypeScript
- 🎨 Tailwind CSS & shadcn/ui
- 🤖 Claude Code
- 💚 Kärlek till hästar

---

**Skapad**: November 2025
**Senast uppdaterad**: 2025-11-12
**Version**: 1.1.0 MVP - UX-förbättringar
