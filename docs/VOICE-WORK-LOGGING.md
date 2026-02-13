# Röstloggning / Arbetslogg

Leverantörer (hovslagare, veterinärer etc.) kan snabbt logga utfört arbete genom att diktera eller skriva fritt. AI tolkar texten och mappar till rätt bokning.

## Problemet

Fältarbetare har ofta smutsiga eller handskklädda händer efter ett besök. Att navigera formulär, välja bokning, fylla i fält -- det tar för lång tid när man har 5-10 besök om dagen. Röstloggningen löser detta med ett enda steg: berätta vad du gjort.

## Flödet steg för steg

### 1. Öppna dialogen

Leverantören klickar på knappen på sin bokningssida (`/provider/bookings`). En ResponsiveDialog (desktop) / Drawer (mobil) öppnas.

### 2. Spela in eller skriv

Två alternativ beroende på webbläsare:

**Chrome/Edge/Safari (Web Speech API finns):**
- Stor grön mic-knapp (pulserar röd vid inspelning)
- Web Speech API lyssnar på svenska (`sv-SE`, continuous mode)
- Text dyker upp live i en textarea medan leverantören pratar
- Kan redigera texten efteråt

**Firefox/äldre browsers (Speech API saknas):**
- Mic-knappen döljs helt
- Titeln byter till "Arbetslogg" istället för "Röstloggning"
- Textarea med hjälpande placeholder och instruktion att skriva fritt

### 3. Tolka

Klienten skickar `POST /api/voice-log` med transkriberingen.

**Servern:**
1. Hämtar leverantörens bokningar för dagen (via `providerId` från session)
2. Bygger en context-lista: tid, kundnamn, hästnamn, tjänst, status, ID
3. Skickar till Anthropic Claude Sonnet med ett system-prompt anpassat för svenska hästtjänsteleverantörer
4. LLM-svaret Zod-valideras (felaktiga typer, saknade fält, confidence > 1 hanteras)
5. Prompt injection-skydd: om LLM returnerar ett bookingId som inte finns i dagens bokningar nullas det

**AI:n extraherar:**

| Fält | Beskrivning | Mappas till |
|------|-------------|-------------|
| `bookingId` | Matchad bokning baserat på kund/hästnamn | Bokning |
| `workPerformed` | Sammanfattning av utfört arbete | `Booking.providerNotes` |
| `markAsCompleted` | Om leverantören sa "klar", "färdig" etc. | `Booking.status` -> completed |
| `horseObservation` | Hälsoobservationer (separerade från arbete) | `HorseNote.content` |
| `horseNoteCategory` | farrier/veterinary/general/medication | `HorseNote.category` |
| `nextVisitWeeks` | Förslag på nästa besök i veckor | Visas som toast |
| `confidence` | 0-1, hur säker matchningen är | Badge i UI |

### 4. Förhandsgranska och korrigera

Leverantören ser en preview med:
- **Matchad bokning** med confidence-badge (Hög / Medel / Låg) och vägledning
- **Dropdown** med alla dagens bokningar -- kan byta om AI matchade fel (utan nytt API-anrop)
- **Utfört arbete** -- kan redigeras inline
- **Anteckning** -- hälsoobservationer separerade från arbete
- **Nästa besök** -- förslag i veckor

### 5. Spara

Klienten skickar `POST /api/voice-log/confirm`. Servern gör upp till 3 saker:

1. **Uppdaterar providerNotes** på bokningen (via `updateProviderNotesWithAuth` -- atomär ägarskapskontroll)
2. **Markerar som completed** om leverantören/AI sa "klar" (via `BookingService.updateStatus` -- non-fatal om det misslyckas)
3. **Skapar HorseNote** om det fanns hälsoobservationer (med ownership-check: `booking.providerId === provider.id`)

Svaret visar vilka actions som lyckades: `["providerNotes", "completed", "horseNote"]`

### 6. Bulk-flöde (logga nästa)

Istället för att dialogen stängs automatiskt visas:
- **"Stäng"** -- klar för dagen
- **"Logga nästa"** -- nollställer state men behåller dagens bokningslista, tillbaka till steg 2

En hovslagare med 8 besök kan öppna dialogen en gång och logga alla 8 i rad.

## Exempelscenario

> Hovslagaren Erik har skonat 3 hästar idag. Han öppnar röstloggen på mobilen, trycker på mic:en och säger: *"Klar hos Anna med Stella. Verkade och raspade alla fyra. Framhovarna var lite uttorkade. Nästa besök om åtta veckor."*
>
> AI:n matchar bokning #3 (Anna Johansson, Stella, 09:00), fyller i "Verkade och raspade alla fyra hovarna" som arbetsnotering, skapar en farrier-hästnotering om uttorkade hovar, och föreslår nästa besök om 8 veckor. Erik bekräftar, trycker "Logga nästa", och dikterar nästa besök.

## Teknisk arkitektur

```
VoiceWorkLogDialog (UI)
  |
  |--> useSpeechRecognition (Web Speech API hook)
  |
  |--> POST /api/voice-log
  |      |--> ProviderRepository.findByUserId()
  |      |--> prisma.booking.findMany() (dagens bokningar)
  |      |--> VoiceInterpretationService.interpret()
  |             |--> Anthropic Claude Sonnet API
  |             |--> Zod-validering av LLM-output
  |             |--> BookingId-validering mot context
  |
  |--> POST /api/voice-log/confirm
         |--> PrismaBookingRepository.updateProviderNotesWithAuth()
         |--> BookingService.updateStatus()
         |--> prisma.horseNote.create() (med ownership-check)
```

### Nyckelfiler

| Fil | Ansvar |
|-----|--------|
| `src/components/voice-log/VoiceWorkLogDialog.tsx` | UI-komponent, stegvis dialog |
| `src/hooks/useSpeechRecognition.ts` | Web Speech API hook (sv-SE) |
| `src/app/api/voice-log/route.ts` | Interpret-endpoint |
| `src/app/api/voice-log/confirm/route.ts` | Confirm/save-endpoint |
| `src/domain/voice-log/VoiceInterpretationService.ts` | AI-tolkning + validering |

## Säkerhet

- **Rate limiting** (rateLimiters.api) på båda endpoints
- **Zod .strict()** -- avvisar extra fält i request body
- **Ägarskapskontroll** -- providerNotes uppdateras via atomär WHERE {id, providerId}
- **Horse note ownership** -- booking.providerId kontrolleras innan horseNote.create
- **LLM-output-validering** -- Zod-schema med defaults och transforms, inte as-cast
- **Prompt injection-skydd** -- bookingId från LLM valideras mot context-listan
- **Auth** -- session.user.userType === "provider" krävs

## Beroenden

- `@anthropic-ai/sdk` -- Anthropic API-klient
- `ANTHROPIC_API_KEY` -- env-variabel (dokumenterad i `.env.example`)
- Web Speech API -- webbläsare-API, ingen server-dependency (graceful fallback till text)

## Kostnad

Varje tolkning kostar ca 0.003-0.01 USD (Claude Sonnet, ~500 tokens in/out). Med rate limiting (100 req/min) och typisk användning (5-10 tolkningar/leverantör/dag) bör kostnaden vara minimal. Rekommendation: sätt spending limit i Anthropic-dashboarden.

## Kända begränsningar

- **Datum-filtrering** använder serverns tidzon (UTC i Vercel) -- kan bli fel dag om leverantör loggar sent kväll svensk tid
- **Confirm-route utan $transaction** -- 3 operationer utan transaktion, partiell failure möjligt (actions-arrayen visar vad som lyckades)
- **Horse notes via Prisma direkt** -- bryter mot repository-pattern, acceptabelt för MVP
- **Web Speech API** -- stöds inte i Firefox, många in-app-browsers, eller äldre Safari
