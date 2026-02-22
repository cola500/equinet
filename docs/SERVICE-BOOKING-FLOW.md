# Service Booking Flow

> Dokumentation för det kompletta bokningsflödet från kundbehov till betalning.

## Översikt

Equinet har nu ett komplett bokningsflöde som täcker hela kundresan:

```
┌─────────────────────────────────────────────────────────────┐
│                    KUNDRESA                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SÖKA TJÄNST                                             │
│     └─ /providers - Bläddra och filtrera leverantörer       │
│                                                             │
│  2. BOKA TJÄNST                                             │
│     ├─ Fixed time: Välj datum och tid                       │
│     └─ Flexible: Ange datumspann och prioritet              │
│                                                             │
│  2b. SAMMANFATTNING                                         │
│     └─ Granska tjänst, datum, tid, häst innan bekräftelse   │
│                                                             │
│  3. BEKRÄFTELSE                                             │
│     └─ Provider accepterar eller avböjer                    │
│                                                             │
│  4. GENOMFÖRANDE                                            │
│     └─ Provider markerar som slutförd                       │
│                                                             │
│  5. BETALNING                                               │
│     └─ Kund betalar via mock payment (demo)                 │
│                                                             │
│  6. KVITTO                                                  │
│     └─ HTML-kvitto med print-funktion                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementerade Komponenter

### 1. Payment Model

**Fil:** `prisma/schema.prisma`

```prisma
model Payment {
  id                String    @id @default(uuid())
  bookingId         String    @unique
  booking           Booking   @relation(...)

  amount            Float     // Belopp i SEK
  currency          String    @default("SEK")
  provider          String    @default("mock")
  providerPaymentId String?

  status            String    @default("pending")
  paidAt            DateTime?

  invoiceNumber     String?   @unique
  invoiceUrl        String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### 2. API Endpoints

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/api/bookings/[id]/payment` | POST | Genomför mock-betalning |
| `/api/bookings/[id]/payment` | GET | Hämta betalningsstatus |
| `/api/bookings/[id]/receipt` | GET | HTML-kvitto (print-ready) |

### 3. Email-notifikationer

**Filer:** `src/lib/email/`

| Händelse | Mall | Mottagare |
|----------|------|-----------|
| Ny bokning | `bookingConfirmationEmail` | Kund |
| Status ändras | `bookingStatusChangeEmail` | Kund |
| Betalning genomförd | `paymentConfirmationEmail` | Kund |

**Konfiguration:**
- Utan `RESEND_API_KEY`: Emails loggas till konsolen (mock mode)
- Med `RESEND_API_KEY`: Riktiga emails via Resend

### 4. Customer UI

**Fil:** `src/app/customer/bookings/page.tsx`

Uppdaterad med:
- "Betala X kr"-knapp för bekräftade bokningar
- "Betald"-badge med kvittonummer
- "Ladda ner kvitto"-länk
- Förhindrar avbokning av betalda bokningar

---

## Nästa Steg: Produktion

### Fas 1: Databas (Obligatoriskt)

```bash
# Applicera Payment model till databasen
npx prisma db push
npx prisma generate
```

### Fas 2: Email-konfiguration (Rekommenderat)

1. Skapa konto på [resend.com](https://resend.com)
2. Skapa API-nyckel
3. Lägg till i `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=bokningar@equinet.se
```

4. Verifiera domän i Resend dashboard (för bättre deliverability)

### Fas 3: Riktig Betalning (För produktion)

#### Alternativ A: Stripe (Rekommenderat)

**Varför Stripe?**
- Internationellt erkänt
- PCI-compliant (ingen kortdata på er server)
- Bra dokumentation
- Test mode gratis

**Implementation:**

1. Skapa Stripe-konto och aktivera test mode
2. Installera Stripe SDK:
   ```bash
   npm install stripe @stripe/stripe-js
   ```

3. Lägg till i `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_xxxxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

4. Uppdatera payment endpoint för Stripe:

```typescript
// Ersätt mock payment med:
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(booking.service.price * 100), // öre
  currency: "sek",
  metadata: { bookingId: booking.id }
})

// Spara payment med providerPaymentId
await prisma.payment.create({
  data: {
    bookingId: booking.id,
    amount: booking.service.price,
    provider: "stripe",
    providerPaymentId: paymentIntent.id,
    status: "pending"
  }
})

return { clientSecret: paymentIntent.client_secret }
```

5. Skapa webhook endpoint:

```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
  const event = stripe.webhooks.constructEvent(...)

  if (event.type === "payment_intent.succeeded") {
    await prisma.payment.update({
      where: { providerPaymentId: event.data.object.id },
      data: { status: "succeeded", paidAt: new Date() }
    })
  }
}
```

6. Uppdatera UI med Stripe Elements:

```tsx
import { PaymentElement } from "@stripe/react-stripe-js"

// I PaymentModal
<PaymentElement />
```

#### Alternativ B: Swish (Svenskt)

**Fördelar:**
- Lägre avgifter för svenska transaktioner
- Bekant för svenska kunder

**Nackdelar:**
- Endast Sverige
- Kräver svenskt företag och Swish-avtal

---

### Fas 4: PDF-kvitton (Valfritt)

Nuvarande lösning använder HTML som kan skrivas ut. För riktiga PDF:er:

```bash
npm install @react-pdf/renderer
```

```typescript
import { Document, Page, Text, pdf } from "@react-pdf/renderer"

const InvoicePDF = () => (
  <Document>
    <Page>
      <Text>Kvitto #{invoiceNumber}</Text>
      {/* ... */}
    </Page>
  </Document>
)

const pdfBuffer = await pdf(<InvoicePDF />).toBuffer()
// Spara till Supabase Storage
```

---

## Testning

### Manuell testning

1. **Skapa bokning som kund**
   - Logga in som kund
   - Gå till /providers
   - Välj tjänst och boka

2. **Bekräfta som provider**
   - Logga in som provider
   - Gå till /provider/bookings
   - Klicka "Acceptera"

3. **Betala som kund**
   - Logga in som kund
   - Gå till /customer/bookings
   - Klicka "Betala X kr"

4. **Verifiera kvitto**
   - Klicka "Ladda ner kvitto"
   - Verifiera att kvittot visas korrekt

### E2E-tester

E2E-tester för betalningsflödet finns i `e2e/payment.spec.ts`:

| Test | Beskrivning |
|------|-------------|
| `should pay for a confirmed booking` | Verifierar att kund kan betala bekräftad bokning |
| `should show receipt link after payment` | Kontrollerar att kvittolänk visas efter betalning |
| `should show invoice number after payment` | Verifierar att kvittonummer (EQ-YYYYMM-XXXX) visas |
| `should hide cancel button for paid bookings` | Kontrollerar att avbokning blockeras för betalda |
| `should not allow double payment` | Verifierar dubbelbetalningsskydd |
| `should not show pay button for pending bookings` | Pending-bokningar kan inte betalas |

Kör testerna:
```bash
npx playwright test e2e/payment.spec.ts
```

---

## Säkerhet

### Implementerade skydd

- [x] Auth check på alla payment endpoints
- [x] Ownership validation (kund kan bara betala sina egna bokningar)
- [x] Status validation (endast confirmed/completed kan betalas)
- [x] Dubbelbetalningsskydd (redan betald = 400 error)
- [x] Email/phone inte exponerade i customer view

### Produktion checklist

- [ ] Stripe webhook signature verification
- [ ] Rate limiting på payment endpoints
- [ ] Logging av alla transaktioner
- [ ] PCI compliance (använd Stripe Elements)

---

## Restid mellan bokningar

> **Implementerat: 2026-01-28**

Systemet validerar automatiskt att det finns tillräcklig restid mellan bokningar baserat på geografisk placering.

### Hur det fungerar

1. När en ny bokning skapas hämtas kundens plats (lat/lng från användarprofilen)
2. Befintliga bokningar för samma provider och dag hämtas med sina kundplatser
3. Restid beräknas med Haversine-formeln (fågelvägen × 1.2 för verklig vägsträcka)
4. Om det inte finns tillräcklig tid returneras HTTP 409

### Konfiguration

| Parameter | Värde | Beskrivning |
|-----------|-------|-------------|
| Genomsnittshastighet | 50 km/h | För restidsberäkning |
| Minimum buffert | 10 min | Även för samma plats (avslut/start) |
| Marginalfaktor | 1.2 (20%) | Kompenserar för verklig väg vs fågelväg |
| Fallback buffert | 15 min | Används när platsdata saknas |

### Platshierarki (fallback)

1. **Kundens sparade adress** (User.latitude/longitude)
2. **Providers hemadress** (Provider.latitude/longitude)
3. **Default buffert** (15 min om ingen plats finns)

### API Response vid för kort tid

```json
{
  "error": "Otillräcklig restid till föregående bokning...",
  "details": "Krävs 70 minuter mellan bokningar, endast 30 minuter tillgängligt.",
  "requiredMinutes": 70,
  "actualMinutes": 30
}
```

**HTTP Status:** `409 Conflict`

### Exempel

Provider har bokning 09:00-10:00 hos kund i Göteborg.
Ny bokning begärs 10:30-11:30 hos kund i Alingsås (~40 km bort).

**Beräkning:**
- Avstånd: 40 km (fågelväg)
- Restid: 40 km / 50 km/h × 60 = 48 min
- Med marginal: 48 × 1.2 = 58 min
- Plus buffert: 58 + 10 = 68 min krävs
- Gap tillgängligt: 30 min (10:00 → 10:30)

**Resultat:** ❌ Bokning nekas

---

## Kända begränsningar

1. **Mock payment** - Ingen riktig pengatransfer
2. **HTML-kvitto** - Inte riktigt PDF (men printbart)
3. **Inga refunds** - Måste implementeras för produktion
4. **Ingen fakturering** - Endast direktbetalning
5. **Restid använder fågelväg** - Inte verklig vägdistans (kompenseras med 20% marginal)

---

## Relaterad dokumentation

- [API.md](./API.md) - API-dokumentation
- [PRODUCTION-DEPLOYMENT.md](./PRODUCTION-DEPLOYMENT.md) - Deployment-guide
- [SECURITY-REVIEW-2026-01-21.md](./SECURITY-REVIEW-2026-01-21.md) - Säkerhetsaudit
