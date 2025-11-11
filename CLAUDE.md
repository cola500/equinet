# CLAUDE.md - Projektdokumentation för AI-assistent

Detta dokument innehåller viktig information om Equinet-projektet för framtida AI-assisterade utvecklingssessioner.

## 📌 Projektöversikt

**Projektnamn**: Equinet
**Typ**: Bokningsplattform för hästtjänster (MVP)
**Status**: ✅ Fungerande MVP
**Skapad**: November 2025
**Senast uppdaterad**: 2025-11-11

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
- [x] Customer dashboard med bokningsöversikt
- [x] Publikt leverantörsgalleri (`/providers`)
- [x] Leverantörsdetaljsida med tjänster (`/providers/[id]`)
- [x] Bokningsdialog med kalenderpicker
- [x] Hästinformation och kommentarer vid bokning
- [x] Lista alla egna bokningar (`/customer/bookings`)
- [x] Avboka bokningar

#### Leverantörsfunktioner
- [x] Provider dashboard med statistik (`/provider/dashboard`)
- [x] Tjänstehantering CRUD (`/provider/services`)
- [x] Aktivera/inaktivera tjänster
- [x] Bokningshantering med filter (`/provider/bookings`)
- [x] Acceptera/avvisa/genomför bokningar
- [x] Automatisk tab-växling efter statusändringar
- [x] Detaljerad kundinfo vid bokning

#### UI/UX
- [x] shadcn/ui komponenter
- [x] Responsiv design (Tailwind CSS v4)
- [x] Toast notifications (Sonner)
- [x] Svensk lokalisering (date-fns sv locale)
- [x] Loading states
- [x] Error handling

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
**Senast uppdaterad**: 2025-11-11
**För frågor**: Se README.md eller projektdokumentationen
