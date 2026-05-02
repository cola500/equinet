---
title: Demo Mode
description: Hur demo-mode fungerar -- vilka features som döljs och visas
category: operations
status: active
last_updated: 2026-05-02
sections:
  - Vad demo-mode gör
  - Hur man startar
  - Vad som visas
  - Vad som döljs
  - Demo-flöde (produktion)
  - Demo-flöde (lokal)
  - Verifiera demo-läge
  - Kända begränsningar
---

# Demo Mode

Demo-mode strippar ner Equinet till kärnflödet "Equinet för hovslagare" --
en fokuserad leverantörsupplevelse utan distraktioner.

---

## Vad demo-mode gör

- **Provider-navigeringen** visar bara: Översikt, Bokningar, Kunder, Tjänster, Profil
- **Kalender, Recensioner, Mer-dropdown** döljs helt på desktop
- **Mobilens bottom-tabs** visar: Översikt, Bokningar, Kunder, Tjänster (+ Profil i "Mer")
- **Header** döljer: Registrera-knappen, NotificationBell, Stallprofil-länk, Admin-länk
- **CustomerNav** döljs helt (inga kundnavigerings-tabs)
- **BugReportFab** döljs

Inga API-routes blockeras. Demo-mode är enbart en UI-förändring.

---

## Hur man startar

Lägg till i `.env.local`:

```
NEXT_PUBLIC_DEMO_MODE=true
```

Starta dev-servern:

```bash
npm run dev
```

Eller bygg och kör:

```bash
npm run build && npm start
```

**OBS:** `NEXT_PUBLIC_`-prefix krävs för att variabeln ska vara tillgänglig i klient-komponenter.

### Stänga av demo-mode

Ta bort raden `NEXT_PUBLIC_DEMO_MODE=true` från `.env.local` och starta om.

---

## Vad som visas

### Desktop-navigering (provider)

| Flik | URL |
|------|-----|
| Översikt | `/provider/dashboard` |
| Kalender | `/provider/calendar` |
| Bokningar | `/provider/bookings` |
| Mina tjänster | `/provider/services` |
| Kunder | `/provider/customers` |

### Mobil bottom-tabs

| Tab | Ikon |
|-----|------|
| Översikt | LayoutDashboard |
| Kalender | CalendarDays |
| Bokningar | ClipboardList |
| Kunder | Users |
| Tjänster | Stethoscope |

"Mer"-drawern visar bara **Min profil**.

### Header

- Equinet-logga (länk till startsidan)
- Logga in-knapp (utloggad)
- Användarnamn + dropdown med Översikt, Min profil, Logga ut

---

## Vad som döljs

### Navigering som döljs

| Feature | Varför |
|---------|--------|
| ~~Kalender~~ | *(inkluderad -- behövs för att skapa bokningar)* |
| Recensioner | Kräver seed-data, sekundärt |
| Röstloggning | Kräver AI-tjänst |
| Ruttplanering | Kräver Mapbox + OSRM |
| Rutt-annonser | Kräver ruttplanering |
| Besöksplanering | Nischfunktion |
| Gruppbokningar | Komplext att demonstrera |
| Insikter | Kräver AI-tjänst |
| Hjälp | Inte relevant för demo |

### UI-element som döljs

| Element | Varför |
|---------|--------|
| Registrera-knappen | Demo visar befintliga konton |
| NotificationBell | Inga notiser i demo |
| Stallprofil-länk | Feature OFF |
| Admin-länk | Inte relevant för leverantörs-demo |
| BugReportFab | Intern QA-funktion |
| CustomerNav | Demo fokuserar på leverantör |

---

## Demo-flöde (produktion)

**URL:** `https://equinet-app.vercel.app/login`
**Inloggning:** `provider@example.com` / `ProviderPass123!`
**Leverantör:** Maria Lindgren, Lindgrens Hovslageri & Ridskola

### Walkthrough

1. Öppna `https://equinet-app.vercel.app/login`
2. Logga in med uppgifterna ovan
3. **Dashboard** -- statistik, kommande bokningar, pending-förfrågningar
4. **Bokningar** -- bekräfta pending, se kommande och historik
5. **Kunder** -- 4 kunder med hästar, bjud in ny kund
6. **Tjänster** -- 4 tjänster (hovslagning, hovvård, ridlektion, hälsokontroll)
7. **Kalender** -- veckoöversikt med bokade tider

### Demo-data (seed)

| Typ | Antal | Detaljer |
|-----|-------|---------|
| Kunder | 4 | Anna, Erik, Sofia, Johan |
| Hästar | 3 | Storm, Saga, Bella |
| Tjänster | 4 | Hovslagning, Hovvård, Ridlektion, Hälsokontroll |
| Bokningar | 8 | 2 bekräftade, 1 pending, 4 genomförda, 1 avbokad |
| Recensioner | 3 | Snittbetyg 4.7 |

Data seedas med `npx tsx prisma/seed-demo.ts --reset` (kräver DATABASE_URL mot Supabase).

---

## Demo-flöde (lokal)

1. Sätt `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local`
2. `npm run db:seed:demo:reset`
3. `npm run dev`
4. Öppna `http://localhost:3000/login`
5. Logga in med `provider@example.com` / `ProviderPass123!`

---

## Verifiera demo-läge

Två CLI-kommandon för snabb stabilitetscheck. Båda är read-only och rör inte data.

### Lokalt

```bash
npm run demo:check:local
```

Verifierar:
- Supabase CLI uppe (`supabase status`)
- `provider@example.com` finns i lokal DB
- Demo-kunder (`@demo.equinet.se`) finns
- Minst en demo-bokning finns

Exit 1 vid första fail med tydlig hint (t.ex. "Kör: `npm run db:seed:demo:reset`").

### Produktion

```bash
APP_URL=https://equinet-app.vercel.app npm run demo:check:prod
```

Verifierar (read-only HTTPS GETs, ingen DB-anslutning):
- `APP_URL` är satt och börjar med `https://`
- `GET /login` → 200 + texten "Logga in på Equinet"
- `GET /api/feature-flags` → 200 + JSON med `demo_mode`-flaggan

Exit-koder:
- **0** = alla checks OK eller bara warnings (`demo_mode` saknas/false)
- **1** = hard fail (APP_URL fel, /login svarar inte, tekniskt fel på feature-flags)

Output-format: `✓` OK, `⚠` warning, `✗` fail. Alla rader inkluderar fix-hint vid fel.

**Vercel BotID:** När prod-checken träffas av Vercel BotID / Attack Challenge (header `x-vercel-mitigated: challenge`) rapporteras träffen som `⚠ WARN` och scriptet exit:ar 0. Detta är **inte** en pass — outputen säger uttryckligen att prod demo readiness inte är fullt verifierad av scriptet. Verifiera då manuellt i browser eller kör browserbaserad smoke (`e2e/demo-flow.spec.ts`) som löser challenge:n automatiskt.

### E2E-konsistensspec

`e2e/demo-flow.spec.ts` loggar in som demo-provider och navigerar fem flikar (Översikt, Kalender, Bokningar, Kunder, Tjänster). Asserterar att UI inte läcker `DEMO-SEED`, `Test Testsson` eller "Registrera"-knappen. Förutsätter demo-seed kört.

```bash
npx playwright test e2e/demo-flow.spec.ts
```

---

## Kända begränsningar

- **Landningssidan** visas fortfarande med alla CTAs för utloggade användare.
  Workaround: navigera direkt till `/login` i demo.
- **Direktlänkar fungerar** -- om någon skriver `/provider/voice-log` i URL-fältet
  visas sidan fortfarande. Demo-mode döljer bara navigeringen, inte sidorna.
- **API-routes är inte blockerade** -- alla endpoints svarar som vanligt.
- **Seed-data krävs** -- demo-mode ger ingen testdata, bara ett renare UI.

---

## Teknisk implementation

| Fil | Ändring |
|-----|---------|
| `src/lib/demo-mode.ts` | `isDemoMode()` helper + `DEMO_ALLOWED_PATHS` |
| `src/components/layout/ProviderNav.tsx` | Filtrerar nav-items, byter mobil-tabs |
| `src/components/layout/Header.tsx` | Döljer Registrera, NotificationBell, Stall, Admin |
| `src/app/layout.tsx` | Döljer BugReportFab |

Totalt ~30 rader ändrad kod. Ingen ny feature, inga API-ändringar.
