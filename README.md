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
Tryck **`Ctrl + C`** i terminalen där servern körs.

## 📋 Tillgängliga Scripts

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Startar utvecklingsservern på port 3000 |
| `npm run build` | Bygger produktionsversionen av appen |
| `npm start` | Startar produktionsservern (kräver build först) |
| `npm run setup` | Sätter upp Prisma och pushar schema till databasen |
| `npm run db:reset` | Återställer databasen ⚠️ (raderar all data!) |
| `npm run db:studio` | Öppnar Prisma Studio för att inspektera databasen |
| `npm run lint` | Kör ESLint för kodkvalitetskontroll |

## 🛠️ Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **Språk**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Komponenter**: shadcn/ui + Radix UI
- **Databas**: SQLite (via Prisma ORM)
- **Autentisering**: NextAuth.js v4
- **Form Validering**: Zod + React Hook Form
- **Datum**: date-fns med svensk locale
- **Notifikationer**: Sonner (toast)
- **Lösenord**: bcrypt

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
│   │   │   └── services/     # Tjänste-API (CRUD)
│   │   ├── customer/         # Kundsidor
│   │   │   ├── dashboard/    # Översikt med senaste bokningar
│   │   │   └── bookings/     # Lista alla bokningar
│   │   ├── provider/         # Leverantörssidor
│   │   │   ├── dashboard/    # Dashboard med stats & översikt
│   │   │   ├── services/     # CRUD för tjänster
│   │   │   └── bookings/     # Hantera kundbokningar
│   │   ├── providers/        # Publika leverantörssidor
│   │   │   ├── page.tsx      # Lista alla leverantörer
│   │   │   └── [id]/         # Leverantörsdetalj & bokning
│   │   └── dashboard/        # Redirect till rätt dashboard
│   ├── components/
│   │   └── ui/               # shadcn/ui komponenter
│   ├── hooks/
│   │   └── useAuth.ts        # Custom auth hook
│   ├── lib/
│   │   ├── auth.ts           # NextAuth konfiguration
│   │   ├── prisma.ts         # Prisma client singleton
│   │   └── utils.ts          # Utility funktioner (cn, etc)
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
- Fält: dayOfWeek, startTime, endTime, isActive

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
- [x] Säker inloggning med bcrypt-hashade lösenord
- [x] Session-baserad autentisering via NextAuth
- [x] Rollbaserad access control (middleware)
- [x] Custom useAuth hook för enkel auth-state
- [x] Logout-funktionalitet

### ✅ Leverantörsfunktioner
- [x] Provider dashboard med real-time statistik
- [x] Tjänstehantering (CRUD)
- [x] Aktivera/inaktivera tjänster
- [x] Bokningshantering med filter
- [x] Acceptera/avvisa bokningar
- [x] Markera bokningar som genomförda
- [x] Automatisk tab-växling efter statusändringar
- [x] Detaljerad kundinfo vid bokning

### ✅ Kundfunktioner
- [x] Customer dashboard med senaste bokningar
- [x] Publikt leverantörsgalleri med kort
- [x] Sökning och filtrering av leverantörer
- [x] Leverantörsdetaljsida med tjänster
- [x] Bokningsdialog med kalenderpicker
- [x] Hästinformation och kundommentarer
- [x] Lista alla egna bokningar
- [x] Avboka bokningar

### ✅ UI/UX
- [x] Responsiv design (desktop, tablet, mobil)
- [x] Toast-notifikationer för använderfeedback
- [x] Svensk lokalisering (datum, språk)
- [x] Konsekvent färgschema (grön-vit tema)
- [x] Loading states
- [x] Error handling

### ✅ Tekniskt
- [x] TypeScript genom hela projektet
- [x] Zod schema-validering på både client & server
- [x] API routes skyddade med auth-checks
- [x] Prisma ORM med type-safety
- [x] Next.js 16 App Router
- [x] Server & Client Components korrekt separerade

## 🔮 Framtida Förbättringar

### Prioriterade Features
- [ ] Email-notifikationer vid bokningar & statusändringar
- [ ] Kalendervy med faktisk tillgänglighet
- [ ] Betalningsintegration (Stripe/Klarna)
- [ ] Bilduppladdning för profiler och tjänster
- [ ] Omdömen och recensioner
- [ ] Favoritmarkering av leverantörer

### Avancerade Features
- [ ] Realtidsnotifikationer (WebSockets)
- [ ] SMS-påminnelser via Twilio
- [ ] Google Calendar-synkronisering
- [ ] Exportera bokningar till PDF/CSV
- [ ] Statistik och rapporter för leverantörer
- [ ] Mobilapp (React Native)
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

## 🔐 Säkerhet

### Implementerade Säkerhetsåtgärder

- ✅ **Lösenordshantering**: bcrypt med salt rounds
- ✅ **Session Security**: HTTP-only cookies via NextAuth
- ✅ **CSRF Protection**: Inbyggt i NextAuth
- ✅ **SQL Injection**: Skyddad genom Prisma's prepared statements
- ✅ **Input Validation**: Zod schema på både client & server
- ✅ **XSS Protection**: React's automatiska escaping
- ✅ **Auth Middleware**: Route protection baserat på userType
- ✅ **API Authorization**: Kontrollerar att användare äger resursen

### Säkerhetsrekommendationer för Produktion

- [ ] Använd stark `NEXTAUTH_SECRET` (minst 32 bytes)
- [ ] Aktivera HTTPS i produktion
- [ ] Implementera rate limiting
- [ ] Lägg till CORS-policy
- [ ] Använd PostgreSQL istället för SQLite
- [ ] Implementera password strength requirements
- [ ] Lägg till 2FA (tvåfaktorsautentisering)
- [ ] Logga security events

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
**Senast uppdaterad**: 2025-11-11
**Version**: 1.0.0 MVP
