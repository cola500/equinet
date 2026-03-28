---
title: Demo Mode
description: Hur demo-mode fungerar -- vilka features som döljs och visas
category: operations
status: active
last_updated: 2026-03-25
sections:
  - Vad demo-mode gör
  - Hur man startar
  - Vad som visas
  - Vad som döljs
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

## Demo-flöde

1. Öppna `/login`
2. Logga in med `provider@test.se` / `test123`
3. Se dashboard med statistik
4. Gå till Kunder -- se kundregister
5. Gå till Bokningar -- skapa/bekräfta/slutför bokningar
6. Gå till Tjänster -- se/redigera tjänster

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
